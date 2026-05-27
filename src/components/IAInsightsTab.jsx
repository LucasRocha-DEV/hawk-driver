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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

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

function parsarHoras(horarioStr) {
  if (!horarioStr) return 0;
  const str = String(horarioStr);
  const match = str.match(/(\d+)h(\d*)/);
  if (match) {
    const horas = parseInt(match[1], 10) || 0;
    const minutos = parseInt(match[2], 10) || 0;
    return horas + minutos / 60;
  }
  return parseFloat(str) || 0;
}

export default function IAInsightsTab() {
  const { usuario } = useAuth();
  const hoje = new Date();

  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  const [apiKey, setApiKey] = useState('');
  const [tipoVeiculo, setTipoVeiculo] = useState('gasolina');
  const [showConfig, setShowConfig] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const [loading, setLoading] = useState(false);
  const [insightsData, setInsightsData] = useState(null);
  const [error, setError] = useState(null);

  // Load API Key and Vehicle Config
  useEffect(() => {
    if (!usuario) return;
    const loadConfig = async () => {
      const docRef = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'ia');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.apiKey) setApiKey(data.apiKey);
        if (data.tipoVeiculo) setTipoVeiculo(data.tipoVeiculo);
        
        if (!data.apiKey) setShowConfig(true);
      } else {
        setShowConfig(true);
      }
    };
    loadConfig();
  }, [usuario]);

  const saveConfig = async (e) => {
    e.preventDefault();
    if (!usuario) return;
    setSavingKey(true);
    try {
      await setDoc(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'ia'), {
        apiKey,
        tipoVeiculo,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
      setShowConfig(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações');
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
    setInsightsData(null);
  };

  const mesSeguinte = () => {
    if (mesAtual === 11) {
      setMesAtual(0);
      setAnoAtual((a) => a + 1);
    } else {
      setMesAtual((m) => m + 1);
    }
    setInsightsData(null);
  };

  const gerarInsights = async () => {
    if (!apiKey) {
      setShowConfig(true);
      return;
    }

    setLoading(true);
    setError(null);
    setInsightsData(null);

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
        if (r.horarioRodado) {
          totalHoras += parsarHoras(r.horarioRodado);
        } else if (r.horasTrabalhadas) {
          if (String(r.horasTrabalhadas).includes(':')) {
            const [h, m] = r.horasTrabalhadas.split(':').map(Number);
            totalHoras += h + (m / 60);
          } else {
            totalHoras += Number(r.horasTrabalhadas) || 0;
          }
        }
      });
      const liquidoUber = totalBruto - totalGastoCombustivelUber;

      let totalVariaveis = 0;
      const variaveisPorCategoria = {};
      gastosVar.forEach(g => {
        totalVariaveis += Number(g.valor);
        variaveisPorCategoria[g.categoria] = (variaveisPorCategoria[g.categoria] || 0) + Number(g.valor);
      });

      let totalFixoPessoal = 0;
      let totalFixoEmpresa = 0;
      gastosFixos.forEach(g => {
        if (g.natureza === 'EMPRESA') {
          totalFixoEmpresa += Number(g.valor);
        } else {
          totalFixoPessoal += Number(g.valor);
        }
      });
      const totalFixas = totalFixoPessoal + totalFixoEmpresa;

      const sobra = liquidoUber - totalVariaveis - totalFixas;

      // 3. Build Prompt
      let contextoVeiculo = '';
      if (tipoVeiculo === 'eletrico') {
        contextoVeiculo = 'IMPORTANTE: O veículo do motorista é ELÉTRICO. Portanto, ele não tem gastos diários com combustível fóssil, usando apenas recarga de energia que pode ser barata ou cobrada mensalmente na conta de luz. Nunca reclame ou alerte sobre "gastos muito baixos com combustível" ou "incompatibilidade de faturamento com combustível" pois para carros elétricos isso é o normal.';
      } else if (tipoVeiculo === 'gnv') {
        contextoVeiculo = 'O veículo do motorista utiliza GNV (Gás Natural Veicular), o que resulta em custos operacionais bem mais baixos que gasolina.';
      } else {
        contextoVeiculo = `O veículo do motorista utiliza ${tipoVeiculo.charAt(0).toUpperCase() + tipoVeiculo.slice(1)}.`;
      }

      let detalhamentoVariaveis = gastosVar.length > 0 
        ? gastosVar.map(g => `- ${g.descricao} (${g.categoria}): ${formatarMoeda(g.valor)}${g.observacao ? ` | Obs: ${g.observacao}` : ''}`).join('\n')
        : 'Nenhum gasto variável registrado.';

      let detalhamentoFixas = gastosFixos.length > 0 
        ? gastosFixos.map(g => `- ${g.descricao} (${g.categoria}) [${g.natureza === 'EMPRESA' ? 'Custo Empresa' : 'Custo Pessoal'}]: ${formatarMoeda(g.valor)}`).join('\n')
        : 'Nenhum gasto fixo registrado.';

      const prompt = `Você é um consultor financeiro especialista em motoristas de aplicativo (Uber/99).
O usuário deseja uma análise financeira do mês de ${MESES[mesAtual]} de ${anoAtual}.

CONTEXTO DO MOTORISTA:
${contextoVeiculo}

DADOS DO MÊS:
- Faturamento Bruto Uber: ${formatarMoeda(totalBruto)}
- Custos Operacionais Diários (Combustível/Energia/Outros na corrida): ${formatarMoeda(totalGastoCombustivelUber)}
- Lucro Líquido Operacional: ${formatarMoeda(liquidoUber)}
- Km Rodado: ${totalKm} km
- Horas Trabalhadas: ${Math.floor(totalHoras)}h (Considere isso para cálculo de ganho/hora)
- Gasto Fixo da Empresa (Veículo/Aplicativo): ${formatarMoeda(totalFixoEmpresa)}
- Gasto Fixo Pessoal/Casa: ${formatarMoeda(totalFixoPessoal)}
- Gasto Variável Total: ${formatarMoeda(totalVariaveis)}
- Sobra no Final do Mês: ${formatarMoeda(sobra)}

Gastos Variáveis por Categoria:
${Object.entries(variaveisPorCategoria).map(([cat, val]) => `- ${cat}: ${formatarMoeda(val)}`).join('\n')}

Detalhamento de Gastos Variáveis (Inclui as observações do motorista em cada lançamento):
${detalhamentoVariaveis}

Detalhamento de Gastos Fixos:
${detalhamentoFixas}

IMPORTANTE: Você DEVE retornar APENAS um objeto JSON válido, sem NENHUM texto extra fora do JSON ou formatação como \`\`\`json. O objeto deve seguir ESTRITAMENTE a seguinte estrutura (não inclua comentários):

{
  "resumoGeral": "Texto de avaliação geral do mês (Markdown permitido)",
  "metricas": {
    "ganhoPorHora": VALOR_NUMERICO_AQUI,
    "ganhoPorKm": VALOR_NUMERICO_AQUI
  },
  "graficoGeral": [
    { "name": "Faturamento", "value": VALOR_NUMERICO_AQUI },
    { "name": "Custos Ops Diários", "value": VALOR_NUMERICO_AQUI },
    { "name": "Fixo Empresa", "value": VALOR_NUMERICO_AQUI },
    { "name": "Fixo Pessoal", "value": VALOR_NUMERICO_AQUI },
    { "name": "Total Variável", "value": VALOR_NUMERICO_AQUI },
    { "name": "Sobra Limpa", "value": VALOR_NUMERICO_AQUI }
  ],
  "alertaGastos": "Identifique onde ele gastou muito e possíveis excessos. Baseie-se fortemente no detalhamento e nas observações dos gastos dele (Markdown permitido). Atenção especial à separação de Gastos Pessoais x Empresa.",
  "dicaDeOuro": "O que ele deve fazer no próximo mês para melhorar financeiramente (Markdown permitido)."
}
`;

      // 4. Call Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      // Podemos forçar um pouco a formatação pedindo JSON MIME Type caso a biblioteca suporte, mas via prompt rigoroso já funciona na maioria das vezes.
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      
      // Limpeza de blocos de markdown de JSON caso a IA ainda os inclua
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      try {
        const jsonConvertido = JSON.parse(text);
        setInsightsData(jsonConvertido);
      } catch (parseError) {
        console.error("Erro ao fazer parse do JSON do Gemini:", parseError, text);
        setError("A IA retornou um formato inesperado em vez do Dashboard estruturado. Por favor, clique em Gerar Análise novamente.");
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao gerar insights. Verifique sua conexão e API Key.');
    }
    setLoading(false);
  };

  return (
    <div className="tab-content">
      <div className="patrimonio-header">
        <h2 className="patrimonio-titulo">🧠 IA Insights Dashboard</h2>
        <p className="patrimonio-subtitulo">
          Análise financeira interativa com IA baseada nos seus dados reais e tipo de veículo.
        </p>
      </div>

      <div className="month-navigation" style={{ marginBottom: '24px' }}>
        <button className="month-nav-btn" onClick={mesAnterior}>‹</button>
        <span className="month-nav-label">{MESES[mesAtual]} {anoAtual}</span>
        <button className="month-nav-btn" onClick={mesSeguinte}>›</button>
      </div>

      {!apiKey || showConfig ? (
        <div className="card fade-in" style={{ borderTop: '4px solid #6c5ce7' }}>
          <h3 className="card-title">⚙️ Configurações da IA</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Para gerar as análises interativas, você precisa de uma API Key do Google Gemini (é gratuita!).
            <br />
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#6c5ce7', textDecoration: 'underline' }}>
              Pegue sua chave aqui
            </a>.
          </p>
          <form onSubmit={saveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                API Key do Gemini:
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="Cole sua API Key do Gemini..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                required
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                Qual o tipo do seu veículo?
              </label>
              <select 
                className="form-input" 
                value={tipoVeiculo} 
                onChange={e => setTipoVeiculo(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="gasolina">Gasolina</option>
                <option value="etanol">Etanol</option>
                <option value="gnv">GNV (Gás Natural)</option>
                <option value="eletrico">Elétrico ⚡</option>
                <option value="hibrido">Híbrido</option>
                <option value="diesel">Diesel</option>
              </select>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                A IA usará isso para análises mais reais e para ignorar "alertas" sobre gastos baixos de combustível (se elétrico).
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="submit" className="btn-primary" disabled={savingKey}>
                {savingKey ? 'Salvando...' : 'Salvar Configurações'}
              </button>
              {apiKey && (
                <button type="button" className="btn-secondary" onClick={() => setShowConfig(false)}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
          <button className="btn-primary" onClick={gerarInsights} disabled={loading} style={{ padding: '16px 24px', fontSize: '1.1rem', background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', border: 'none', minWidth: '220px' }}>
            {loading ? '🧠 Processando JSON...' : '✨ Gerar Dashboard IA'}
          </button>
          <button className="btn-secondary" onClick={() => setShowConfig(true)}>
            ⚙️ Configurações
          </button>
        </div>
      )}

      {error && (
        <div className="card fade-in" style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid #ff6b6b' }}>
          <p style={{ color: '#ff6b6b', margin: 0 }}>{error}</p>
        </div>
      )}

      {insightsData && (
        <div className="insights-dashboard fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Top Metrics Grid */}
          <div className="metric-cards-grid">
            <div className="metric-card">
              <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #00b894, #00d4aa)' }} />
              <div className="metric-card-icon">⏱️</div>
              <div className="metric-card-body">
                <span className="metric-card-label">Ganho por Hora</span>
                <span className="metric-card-value" style={{ color: '#00d4aa' }}>
                  {formatarMoeda(insightsData.metricas?.ganhoPorHora)}
                </span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #0984e3, #74b9ff)' }} />
              <div className="metric-card-icon">🛣️</div>
              <div className="metric-card-body">
                <span className="metric-card-label">Ganho por Km</span>
                <span className="metric-card-value" style={{ color: '#74b9ff' }}>
                  {formatarMoeda(insightsData.metricas?.ganhoPorKm)}
                </span>
              </div>
            </div>
          </div>

          {/* Chart Area */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '24px' }}>📊 Fluxo Financeiro Inteligente</h3>
            <div style={{ width: '100%', height: 340 }}>
              <ResponsiveContainer>
                <BarChart data={insightsData.graficoGeral} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: '#a0a0b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                  <YAxis tick={{ fill: '#a0a0b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ background: 'rgba(18, 18, 26, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    labelStyle={{ color: '#a0a0b8', marginBottom: '8px' }}
                    formatter={(value) => formatarMoeda(value)}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60} animationDuration={1500}>
                    {insightsData.graficoGeral?.map((entry, index) => {
                      let color = '#6c5ce7'; // default
                      if (entry.name === 'Faturamento') color = '#00b894';
                      if (entry.name === 'Custos Ops' || entry.name?.includes('Fixo') || entry.name?.includes('Variável')) color = '#ff6b6b';
                      if (entry.name?.includes('Sobra')) color = '#0984e3';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Texts Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            <div className="card glass-card" style={{ borderLeft: '4px solid #6c5ce7', height: '100%' }}>
              <h3 style={{ color: '#a29bfe', marginBottom: '16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📋 Resumo do Mês
              </h3>
              <div className="markdown-body" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                <ReactMarkdown>{insightsData.resumoGeral || ''}</ReactMarkdown>
              </div>
            </div>

            <div className="card glass-card" style={{ borderLeft: '4px solid #ff6b6b', height: '100%' }}>
              <h3 style={{ color: '#ff7675', marginBottom: '16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ Alertas de Gastos
              </h3>
              <div className="markdown-body" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                <ReactMarkdown>{insightsData.alertaGastos || ''}</ReactMarkdown>
              </div>
            </div>

            <div className="card glass-card" style={{ borderLeft: '4px solid #ffd93d', height: '100%' }}>
              <h3 style={{ color: '#ffeaa7', marginBottom: '16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💡 Dica de Ouro
              </h3>
              <div className="markdown-body" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                <ReactMarkdown>{insightsData.dicaDeOuro || ''}</ReactMarkdown>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
