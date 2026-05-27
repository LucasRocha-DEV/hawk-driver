import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function despesaAtivaNoPeriodo(despesa, mes, ano) {
  const mesInicio = despesa.mesInicio ?? despesa.mes ?? 0;
  const anoInicio = despesa.anoInicio ?? despesa.ano ?? 2020;
  const periodoAtual = ano * 12 + mes;
  const periodoInicio = anoInicio * 12 + mesInicio;
  if (periodoAtual < periodoInicio) return false;
  if (despesa.recorrente === false) {
    return periodoAtual === periodoInicio;
  }
  if (despesa.mesFim != null && despesa.anoFim != null && despesa.mesFim !== '' && despesa.anoFim !== '') {
    const periodoFim = Number(despesa.anoFim) * 12 + Number(despesa.mesFim);
    if (periodoAtual > periodoFim) return false;
  }
  return true;
}

export default function IAInsightsTab() {
  const { usuario } = useAuth();
  const hoje = new Date();

  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  const [apiKey, setApiKey] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState('');
  const [error, setError] = useState(null);

  // Load API Key
  useEffect(() => {
    if (!usuario) return;
    const loadConfig = async () => {
      const docRef = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'ia');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().apiKey) {
        setApiKey(docSnap.data().apiKey);
      } else {
        setShowConfig(true);
      }
    };
    loadConfig();
  }, [usuario]);

  const saveApiKey = async (e) => {
    e.preventDefault();
    if (!usuario) return;
    setSavingKey(true);
    try {
      await setDoc(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'ia'), {
        apiKey,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
      setShowConfig(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar API Key');
    }
    setSavingKey(false);
  };

  const mesAnterior = () => {
    if (mesAtual === 0) {
      setMesAtual(11);
      setAnoAtual((a) => a - 1);
    } else {
      setMesAtual((m) => m - 1);
    }
    setInsights('');
  };

  const mesSeguinte = () => {
    if (mesAtual === 11) {
      setMesAtual(0);
      setAnoAtual((a) => a + 1);
    } else {
      setMesAtual((m) => m + 1);
    }
    setInsights('');
  };

  const gerarInsights = async () => {
    if (!apiKey) {
      setShowConfig(true);
      return;
    }

    setLoading(true);
    setError(null);
    setInsights('');

    try {
      // 1. Fetch Data
      // Uber
      const mesStr = String(mesAtual + 1).padStart(2, '0');
      const prefixoData = `${anoAtual}-${mesStr}`;
      const qUber = query(collection(db, 'usuarios', usuario.uid, 'registros'));
      const snapUber = await getDocs(qUber);
      const ganhosMes = snapUber.docs
        .map(d => d.data())
        .filter(r => r.data && r.data.startsWith(prefixoData));

      // Variáveis
      const qVar = query(
        collection(db, 'usuarios', usuario.uid, 'despesas_variaveis'),
        where('mes', '==', mesAtual),
        where('ano', '==', anoAtual)
      );
      const snapVar = await getDocs(qVar);
      const gastosVar = snapVar.docs.map(d => d.data());

      // Fixas
      const qFixas = query(collection(db, 'usuarios', usuario.uid, 'despesas_fixas'));
      const snapFixas = await getDocs(qFixas);
      const gastosFixos = snapFixas.docs
        .map(d => d.data())
        .filter(d => despesaAtivaNoPeriodo(d, mesAtual, anoAtual));

      // 2. Aggregate Data for AI Context
      let totalBruto = 0;
      let totalGastoCombustivelUber = 0;
      let totalHoras = 0;
      let totalKm = 0;
      ganhosMes.forEach(r => {
        totalBruto += Number(r.totalBruto || 0);
        totalGastoCombustivelUber += Number(r.gastosGerais || 0);
        totalKm += Number(r.km || 0);
        if (r.horasTrabalhadas) {
          const [h, m] = r.horasTrabalhadas.split(':').map(Number);
          totalHoras += h + (m / 60);
        }
      });
      const liquidoUber = totalBruto - totalGastoCombustivelUber;

      let totalVariaveis = 0;
      const variaveisPorCategoria = {};
      gastosVar.forEach(g => {
        totalVariaveis += Number(g.valor);
        variaveisPorCategoria[g.categoria] = (variaveisPorCategoria[g.categoria] || 0) + Number(g.valor);
      });

      let totalFixas = 0;
      gastosFixos.forEach(g => {
        totalFixas += Number(g.valor);
      });

      const sobra = liquidoUber - totalVariaveis - totalFixas;

      // 3. Build Prompt
      const prompt = `Você é um consultor financeiro especialista em motoristas de aplicativo (Uber/99).
O usuário deseja uma análise financeira do mês de ${MESES[mesAtual]} de ${anoAtual}.

DADOS DO MÊS:
- Faturamento Bruto Uber: ${formatarMoeda(totalBruto)}
- Custos Operacionais (Combustível, etc na corrida): ${formatarMoeda(totalGastoCombustivelUber)}
- Lucro Líquido Operacional: ${formatarMoeda(liquidoUber)}
- Km Rodado: ${totalKm} km
- Horas Trabalhadas: ${Math.floor(totalHoras)}h
- Gasto Fixo Pessoal/Casa: ${formatarMoeda(totalFixas)}
- Gasto Variável: ${formatarMoeda(totalVariaveis)}
- Sobra no Final do Mês: ${formatarMoeda(sobra)}

Gastos Variáveis por Categoria:
${Object.entries(variaveisPorCategoria).map(([cat, val]) => `- ${cat}: ${formatarMoeda(val)}`).join('\n')}

Forneça um relatório conciso, amigável e direto ao ponto em formato Markdown:
1. Resumo do Mês (Como ele foi?).
2. Desempenho Operacional (Avalie o ganho por hora e por km).
3. Alerta de Gastos (Identifique onde ele gastou muito).
4. Dica de Ouro (O que ele deve fazer no próximo mês para melhorar).

Use formatação Markdown, emojis, e seja motivador, mas realista.`;

      // 4. Call Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      setInsights(response.text());

    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao gerar insights. Verifique sua API Key.');
    }
    setLoading(false);
  };

  return (
    <div className="tab-content">
      <div className="patrimonio-header">
        <h2 className="patrimonio-titulo">🧠 IA Insights</h2>
        <p className="patrimonio-subtitulo">
          Receba conselhos financeiros personalizados baseados nos seus dados do mês.
        </p>
      </div>

      <div className="month-navigation" style={{ marginBottom: '24px' }}>
        <button className="month-nav-btn" onClick={mesAnterior}>‹</button>
        <span className="month-nav-label">{MESES[mesAtual]} {anoAtual}</span>
        <button className="month-nav-btn" onClick={mesSeguinte}>›</button>
      </div>

      {!apiKey || showConfig ? (
        <div className="card" style={{ borderTop: '4px solid #6c5ce7' }}>
          <h3 className="card-title">⚙️ Configuração da IA</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Para gerar análises, você precisa de uma API Key do Google Gemini (é gratuita!).
            <br />
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#6c5ce7', textDecoration: 'underline' }}>
              Pegue sua chave aqui
            </a>.
          </p>
          <form onSubmit={saveApiKey} style={{ display: 'flex', gap: '12px' }}>
            <input
              type="password"
              className="form-input"
              placeholder="Cole sua API Key do Gemini..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-primary" disabled={savingKey}>
              {savingKey ? 'Salvando...' : 'Salvar Chave'}
            </button>
            {apiKey && (
              <button type="button" className="btn-secondary" onClick={() => setShowConfig(false)}>
                Cancelar
              </button>
            )}
          </form>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
          <button className="btn-primary" onClick={gerarInsights} disabled={loading} style={{ padding: '16px 24px', fontSize: '1.1rem', background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', border: 'none' }}>
            {loading ? '🧠 Pensando...' : '✨ Gerar Análise do Mês'}
          </button>
          <button className="btn-secondary" onClick={() => setShowConfig(true)}>
            ⚙️ Configurar API Key
          </button>
        </div>
      )}

      {error && (
        <div className="card" style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid #ff6b6b' }}>
          <p style={{ color: '#ff6b6b', margin: 0 }}>{error}</p>
        </div>
      )}

      {insights && (
        <div className="card" style={{ background: 'rgba(108, 92, 231, 0.05)', border: '1px solid rgba(108, 92, 231, 0.3)' }}>
          <div className="markdown-body" style={{ color: '#fff', lineHeight: '1.6' }}>
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
