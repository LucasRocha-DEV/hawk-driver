import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, getDocs, deleteDoc, query, orderBy, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatarMoeda, parsarHoras } from '../utils/helpers';
import ChatChart from './chat/ChatChart';
import HistoricoConversas from './chat/HistoricoConversas';

// Renderizadores customizados do react-markdown: intercepta blocos "hawkchart"
// para desenhar um gráfico nativo (Recharts) em vez de mostrar o JSON cru.
const markdownComponents = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    if (match?.[1] === 'hawkchart') {
      return <ChatChart raw={String(children).trim()} />;
    }
    return (
      <code className="bg-black/30 rounded px-1 py-0.5 text-xs" {...props}>
        {children}
      </code>
    );
  },
};

// Perguntas rápidas que o motorista pode tocar dentro do chat
const PERGUNTAS_SUGERIDAS = [
  { emoji: '📅', texto: 'Quais são meus melhores dias para rodar?' },
  { emoji: '⏰', texto: 'Qual o melhor horário pra eu trabalhar?' },
  { emoji: '💰', texto: 'Como está meu lucro este mês?' },
  { emoji: '📉', texto: 'Onde estou gastando demais?' },
  { emoji: '🎯', texto: 'Me dê uma dica pra ganhar mais hoje.' },
];

function getDiaSemanaNome(diaIdx) {
  const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return nomes[diaIdx];
}

function classificarTurno(horaInicio, horaFim) {
  if (!horaInicio || !horaFim) return 'Não Informado';
  const hS = Number(horaInicio.split(':')[0]);
  const hE = Number(horaFim.split(':')[0]);
  if (isNaN(hS) || isNaN(hE)) return 'Não Informado';

  const getNome = (h) => {
    if (h >= 0 && h < 6) return 'Madrugada';
    if (h >= 6 && h < 12) return 'Manhã';
    if (h >= 12 && h < 18) return 'Tarde';
    return 'Noite';
  };
  
  const s = getNome(hS);
  const e = getNome(hE);
  if (s === e) return s;
  return `${s} ➔ ${e}`;
}

export default function AnaliseTab() {
  const { usuario } = useAuth();
  
  // Dados do app
  const [registrosMap, setRegistrosMap] = useState({});
  const [despesasFixas, setDespesasFixas] = useState([]);
  const [despesasVariaveis, setDespesasVariaveis] = useState([]);
  
  // UI States
  const [filtroMes, setFiltroMes] = useState('todos');
  
  // Chatbot Config & State
  const [apiKey, setApiKey] = useState('');
  const [tipoVeiculo, setTipoVeiculo] = useState('gasolina');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // ─── Histórico de Conversas (estilo ChatGPT) ───
  const [conversas, setConversas] = useState([]);
  const [conversaAtivaId, setConversaAtivaId] = useState(null);
  const [showHistorico, setShowHistorico] = useState(false);

  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      }
    };
    loadConfig();
  }, [usuario]);

  // ─── Listener: lista de conversas salvas (ordenadas pela mais recente) ───
  useEffect(() => {
    if (!usuario) return;
    const ref = collection(db, 'usuarios', usuario.uid, 'conversas');
    const q = query(ref, orderBy('atualizadoEm', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setConversas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [usuario]);

  // ─── Helpers de conversa ───
  const novaConversa = () => {
    setMessages([]);
    setConversaAtivaId(null);
    setShowHistorico(false);
  };

  const carregarConversa = (c) => {
    setMessages(c.mensagens || []);
    setConversaAtivaId(c.id);
    setShowHistorico(false);
  };

  const apagarConversa = async (id) => {
    if (!usuario) return;
    try {
      await deleteDoc(doc(db, 'usuarios', usuario.uid, 'conversas', id));
      if (id === conversaAtivaId) novaConversa();
    } catch (err) {
      console.error('Erro ao apagar conversa:', err);
    }
  };

  // Gera um título curto (3-5 palavras) em background; silencioso se falhar.
  const gerarTituloIA = async (genAI, pergunta, resposta) => {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `Resuma o tema desta conversa em 3 a 5 palavras, em português, sem aspas e sem ponto final.\n\nPergunta: ${pergunta}\nResposta: ${resposta}`;
      const result = await model.generateContent(prompt);
      const titulo = result.response.text().trim().replace(/^["']|["']$/g, '').slice(0, 50);
      return titulo || null;
    } catch (err) {
      console.error('Erro ao gerar título:', err);
      return null;
    }
  };

  // Load All Data for Dashboard and AI
  useEffect(() => {
    if (!usuario) return;

    // Registros Uber (Real-time para gráficos)
    const registrosRef = collection(db, 'usuarios', usuario.uid, 'registros');
    const unsubRegistros = onSnapshot(registrosRef, (snapshot) => {
      const mapa = {};
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          mapa[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        }
      });
      setRegistrosMap(mapa);
    });

    // Despesas Fixas (One-time fetch for AI Context)
    const fetchFixas = async () => {
      const fixasRef = collection(db, 'usuarios', usuario.uid, 'despesas_fixas');
      const snap = await getDocs(fixasRef);
      setDespesasFixas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    
    // Despesas Variáveis (One-time fetch for AI Context)
    const fetchVariaveis = async () => {
      const varRef = collection(db, 'usuarios', usuario.uid, 'despesas_variaveis');
      const snap = await getDocs(varRef);
      setDespesasVariaveis(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    fetchFixas();
    fetchVariaveis();

    return () => {
      unsubRegistros();
    };
  }, [usuario]);

  const saveConfig = async (e) => {
    e.preventDefault();
    if (!usuario) return;
    try {
      await setDoc(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'ia'), {
        apiKey,
        tipoVeiculo
      }, { merge: true });
      setIsConfigOpen(false);
    } catch (err) {
      alert('Erro ao salvar configurações');
    }
  };

  const mesesDisponiveis = useMemo(() => {
    const chaves = Object.keys(registrosMap);
    const mesesSet = new Set();
    chaves.forEach(chave => {
      if (chave && chave.includes('-')) {
        const parts = chave.split('-');
        if (parts.length >= 2) {
          mesesSet.add(`${parts[0]}-${parts[1]}`);
        }
      }
    });
    return Array.from(mesesSet).sort((a, b) => b.localeCompare(a));
  }, [registrosMap]);

  const registrosFiltrados = useMemo(() => {
    const todos = Object.values(registrosMap).filter(r => r && r.id);
    if (filtroMes === 'todos') return todos;
    return todos.filter(r => r.id.startsWith(filtroMes));
  }, [registrosMap, filtroMes]);

  // ANÁLISE MACRO (Cards Topo)
  const macroMetricas = useMemo(() => {
    let totalLiquido = 0;
    let totalHoras = 0;
    let totalKm = 0;

    registrosFiltrados.forEach(r => {
      const liq = r.totalLiquido != null ? Number(r.totalLiquido) : (Number(r.totalBruto||0) - Number(r.gastosGerais||0));
      const hr = parsarHoras(r.horarioRodado);
      const km = Number(r.km || 0);

      totalLiquido += liq;
      totalHoras += hr;
      totalKm += km;
    });

    return {
      ganhoPorHora: totalHoras > 0 ? totalLiquido / totalHoras : 0,
      ganhoPorKm: totalKm > 0 ? totalLiquido / totalKm : 0,
      totalHoras,
      totalKm,
      totalLiquido
    };
  }, [registrosFiltrados]);

  // ANÁLISE POR DIA DA SEMANA
  const analiseDiasDaSemana = useMemo(() => {
    const diasArray = Array(7).fill(0).map((_, i) => ({
      idx: i,
      nome: getDiaSemanaNome(i),
      shortNome: getDiaSemanaNome(i).slice(0, 3),
      qtd: 0,
      totalLiquido: 0,
      totalHoras: 0
    }));

    registrosFiltrados.forEach(r => {
      const d = new Date(r.id + 'T12:00:00');
      if (isNaN(d.getTime())) return;
      
      const diaSemana = d.getDay();
      const liq = r.totalLiquido != null ? Number(r.totalLiquido) : (Number(r.totalBruto||0) - Number(r.gastosGerais||0));
      const hr = parsarHoras(r.horarioRodado);

      diasArray[diaSemana].qtd += 1;
      diasArray[diaSemana].totalLiquido += liq;
      diasArray[diaSemana].totalHoras += hr;
    });

    return diasArray.map(d => ({
      ...d,
      mediaDiaria: d.qtd > 0 ? d.totalLiquido / d.qtd : 0,
      ganhoHora: d.totalHoras > 0 ? d.totalLiquido / d.totalHoras : 0
    }));
  }, [registrosFiltrados]);

  // ANÁLISE DE TURNOS
  const analiseTurnos = useMemo(() => {
    const turnos = {};
    registrosFiltrados.forEach(r => {
      const turno = classificarTurno(r.horaInicio, r.horaFim);
      if (turno === 'Não Informado') return;
      
      if (!turnos[turno]) turnos[turno] = { nome: turno, qtd: 0, totalLiquido: 0, totalHoras: 0, somaInicio: 0, somaFim: 0 };
      
      const liq = r.totalLiquido != null ? Number(r.totalLiquido) : (Number(r.totalBruto||0) - Number(r.gastosGerais||0));
      const hr = parsarHoras(r.horarioRodado);
      
      let valInicio = r.horaInicio ? Number(r.horaInicio.split(':')[0]) + Number(r.horaInicio.split(':')[1])/60 : 0;
      let valFim = r.horaFim ? Number(r.horaFim.split(':')[0]) + Number(r.horaFim.split(':')[1])/60 : 0;
      if (valFim < valInicio) valFim += 24;

      turnos[turno].qtd += 1;
      turnos[turno].totalLiquido += liq;
      turnos[turno].totalHoras += hr;
      turnos[turno].somaInicio += valInicio;
      turnos[turno].somaFim += valFim;
    });

    return Object.values(turnos).map(t => {
      let mInicio = t.somaInicio / t.qtd;
      let mFim = t.somaFim / t.qtd;
      return {
        ...t,
        mediaInicio: mInicio,
        mediaFim: mFim,
        ganhoHora: t.totalHoras > 0 ? t.totalLiquido / t.totalHoras : 0
      };
    }).sort((a, b) => b.ganhoHora - a.ganhoHora);
  }, [registrosFiltrados]);

  const handleExportarApagarAntigos = async () => {
    if (!window.confirm("Deseja gerar a planilha com os registros UBER de 2024 e APAGÁ-LOS do sistema?")) return;

    try {
      setIsChatLoading(true);
      
      const anoMinimo = 2026;
      const antigos = Object.values(registrosMap).filter(r => parseInt(r.id.split('-')[0], 10) < anoMinimo);
      
      if (antigos.length === 0) {
        alert("Você não tem dados antigos (anteriores a " + anoMinimo + ") no momento.");
        setIsChatLoading(false);
        return;
      }

      // Montar CSV
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Data,Km,Horas,Total Bruto,Gastos Gerais,Total Liquido\n";
      antigos.forEach(r => {
        const d = r.id || '';
        const km = r.km || 0;
        const hrs = r.horarioRodado || r.horasTrabalhadas || '';
        const bruto = r.totalBruto || 0;
        const gastos = r.gastosGerais || 0;
        const liq = r.totalLiquido != null ? r.totalLiquido : (Number(r.totalBruto||0) - Number(r.gastosGerais||0));
        csvContent += `${d},${km},${hrs},${bruto},${gastos},${liq}\n`;
      });

      // Baixar
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "uber_historico_antigo.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Deletar
      for (const r of antigos) {
        await deleteDoc(doc(db, 'usuarios', usuario.uid, 'registros', r.id));
      }
      
      alert("Sucesso! Os registros antigos foram salvos em CSV e apagados do aplicativo.");
    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro ao processar os dados antigos.");
    } finally {
      setIsChatLoading(false);
    }
  };

  // Função para lidar com o envio de mensagem ao Chatbot
  const handleSendMessage = async (e, presetText) => {
    if (e) e.preventDefault();

    const userMsg = (presetText ?? inputMessage).trim();
    if (!userMsg || !apiKey || isChatLoading) return;

    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Filtrar dados antigos (antes de 2026) para não confundir a IA com época do carro a combustão
      const anoMinimo = 2026;
      
      const registrosAtuais = Object.values(registrosMap).filter(r => {
        const ano = parseInt(r.id.split('-')[0], 10);
        return ano >= anoMinimo;
      }).reduce((acc, r) => { acc[r.id] = r; return acc; }, {});

      const despesasFixasAtuais = despesasFixas; // Despesas fixas são contínuas
      
      const despesasVariaveisAtuais = despesasVariaveis.filter(d => {
        return d.ano >= anoMinimo;
      });

      // Contexto gigante para a IA
      const systemInstruction = `Você é um consultor financeiro e especialista em motoristas de aplicativo (Uber/99).
O usuário deseja dicas, análises, e estratégias sobre sua rotina, ganhos e gastos.
Abaixo estão os dados financeiros registrados pelo usuário no sistema (filtrados de ${anoMinimo} em diante). Analise-os para responder às perguntas de forma precisa e personalizada.
Responda sempre em português, com tom amigável, motivacional e direto. Use formatação Markdown (negrito, listas).
Seja inteligente: correlacione os dias mais rentáveis, gastos que estão altos, etc.

REGRAS DE RESPOSTA (MUITO IMPORTANTE — o público são motoristas na correria, com pouco tempo):
- Seja CURTO e objetivo. No máximo 4 a 6 linhas por resposta.
- Vá direto ao ponto. Nada de introduções longas nem explicações genéricas.
- Use bullets curtos (•) com os números/dados mais importantes em **negrito**.
- Destaque sempre 1 ação prática que o motorista pode fazer hoje.
- Use no máximo 1 ou 2 emojis. Evite parágrafos longos.

=== GRÁFICOS ===
Quando um gráfico ajudar a responder (comparar dias/turnos/categorias, evolução no tempo, distribuição, ou destacar UM número), inclua EXATAMENTE UM bloco de código com a linguagem "hawkchart" contendo JSON válido. Regras:
- Use SEMPRE números reais extraídos dos dados do usuário acima. Nunca invente valores.
- Máximo 7 pontos de dados. Rótulos curtos.
- Coloque o bloco logo após uma frase curta de contexto. Não repita os números no texto.
- Se um gráfico não ajudar, responda só em texto.

Formato do JSON:
{ "type": "bar" | "line" | "pie" | "kpi", "title": "Título curto", "unit": "R$" (ou "" / "km" / "viagens"), "data": [ { "label": "Seg", "value": 120.5 } ] }
Para "kpi", use um único item em data, ex.: [ { "label": "por hora", "value": 28.5 } ].

Exemplo de resposta:
Seus melhores dias por ganho/hora:
\`\`\`hawkchart
{"type":"bar","title":"Ganho por hora","unit":"R$","data":[{"label":"Sex","value":32.4},{"label":"Sáb","value":29.1},{"label":"Dom","value":24.8}]}
\`\`\`

TIPO DE VEÍCULO DO USUÁRIO: ${tipoVeiculo}
${tipoVeiculo === 'eletrico' ? '(Lembre-se que veículos elétricos têm gastos com "combustível" quase nulos. Não alerte sobre gastos baixos com isso).' : ''}

=== DADOS DO USUÁRIO (JSON) ===
REGISTROS UBER/99 (Ganhos e Horários por dia):
${JSON.stringify(registrosAtuais)}

DESPESAS FIXAS (Custos mensais):
${JSON.stringify(despesasFixasAtuais)}

DESPESAS VARIÁVEIS (Gastos diários esporádicos):
${JSON.stringify(despesasVariaveisAtuais)}
`;

      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: systemInstruction 
      });

      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userMsg);
      const response = await result.response;
      const resposta = response.text();

      // Estado completo da conversa após esta troca (para UI + persistência)
      const novas = [...messages, { role: 'user', text: userMsg }, { role: 'model', text: resposta }];
      setMessages(novas);

      // ─── Persistir no Firestore ───
      if (usuario) {
        if (conversaAtivaId) {
          await updateDoc(doc(db, 'usuarios', usuario.uid, 'conversas', conversaAtivaId), {
            mensagens: novas,
            atualizadoEm: serverTimestamp(),
          });
        } else {
          const ref = await addDoc(collection(db, 'usuarios', usuario.uid, 'conversas'), {
            titulo: userMsg.slice(0, 40),   // título provisório (truncado)
            tituloGerado: false,
            mensagens: novas,
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
          });
          setConversaAtivaId(ref.id);
          // Upgrade do título em background (não trava a UI)
          gerarTituloIA(genAI, userMsg, resposta).then((t) => {
            if (t) updateDoc(ref, { titulo: t, tituloGerado: true }).catch(() => {});
          });
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: 'Desculpe, ocorreu um erro ao gerar a resposta. Verifique sua API Key ou sua conexão.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const CustomTooltipRecharts = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#1e1e24', padding: '12px', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{label}</p>
          <p style={{ margin: '4px 0', color: payload[0].color }}>Rendimento: {formatarMoeda(payload[0].value)}/h</p>
          <p style={{ margin: '4px 0', color: '#aaa' }}>Média de Ganho do Dia: {formatarMoeda(payload[0].payload.mediaDiaria)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-6 py-4 space-y-6 animate-fade-in">
      
      {/* HEADER & FILTER */}
      <div className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-hawk-text tracking-tight mb-1 flex items-center gap-2">
            <span>📊</span> Análise Uber & IA
          </h2>
          <p className="text-hawk-muted text-sm">
            Inteligência de rendimento, horários e Chatbot assistente financeiro.
          </p>
        </div>
        <div className="w-full md:w-auto min-w-[200px]">
          <select
            className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors appearance-none cursor-pointer"
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value)}
          >
            <option value="todos">📅 Todo o Histórico</option>
            {mesesDisponiveis.map(m => {
              const parts = m.split('-');
              const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 15);
              const l = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
              return <option key={m} value={m}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>;
            })}
          </select>
        </div>
      </div>

      {/* MACRO METRICS (Ganho Hora/Km) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card flex items-center gap-4 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-hawk-green/5 rounded-full blur-2xl -mr-16 -mt-16 transition-all duration-500 group-hover:bg-hawk-green/10" />
          <div className="w-12 h-12 rounded-xl bg-hawk-green/10 text-hawk-green flex items-center justify-center text-2xl border border-hawk-green/20">
            ⏱️
          </div>
          <div>
            <span className="block text-sm font-semibold text-hawk-muted mb-1">Média de Ganho por Hora</span>
            <span className="block text-2xl font-black text-hawk-green tracking-tight">
              {formatarMoeda(macroMetricas.ganhoPorHora)}
            </span>
            <span className="text-xs text-hawk-dim">Considera o filtro selecionado</span>
          </div>
        </div>
        
        <div className="relative overflow-hidden rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card flex items-center gap-4 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-hawk-blue/5 rounded-full blur-2xl -mr-16 -mt-16 transition-all duration-500 group-hover:bg-hawk-blue/10" />
          <div className="w-12 h-12 rounded-xl bg-hawk-blue/10 text-hawk-blue flex items-center justify-center text-2xl border border-hawk-blue/20">
            🛣️
          </div>
          <div>
            <span className="block text-sm font-semibold text-hawk-muted mb-1">Média de Ganho por Km</span>
            <span className="block text-2xl font-black text-hawk-blue tracking-tight">
              {formatarMoeda(macroMetricas.ganhoPorKm)}
            </span>
            <span className="text-xs text-hawk-dim">Considera o filtro selecionado</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LADO ESQUERDO: GRÁFICOS */}
        <div className="space-y-6">
          {/* Gráfico de Barras: Melhores Dias */}
          <div className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card">
            <h3 className="text-lg font-bold text-hawk-text mb-1">📅 Rendimento por Hora (Dias)</h3>
            <p className="text-xs text-hawk-muted mb-6">
              Dias da semana mais lucrativos por hora rodada.
            </p>
            <div className="h-[250px] w-full">
              <ResponsiveContainer>
                <BarChart data={analiseDiasDaSemana} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="shortNome" stroke="#888" fontSize={12} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickFormatter={(val) => `R$${val}`} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltipRecharts />} />
                  <Bar dataKey="ganhoHora" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {analiseDiasDaSemana.map((entry, index) => {
                      const color = (entry.idx === 0 || entry.idx === 6) ? '#6c5ce7' : '#00d4aa';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ranking de Turnos */}
          <div className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card overflow-hidden">
            <h3 className="text-lg font-bold text-hawk-text mb-1">⏱️ Performance por Turnos</h3>
            <p className="text-xs text-hawk-muted mb-4">
              Turnos que entregam mais rentabilidade.
            </p>
            {analiseTurnos.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full text-left border-collapse min-w-[400px]">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5 text-xs text-hawk-muted uppercase tracking-wider font-bold">
                      <th className="p-3">Turno</th>
                      <th className="p-3">Regs</th>
                      <th className="p-3">R$/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {analiseTurnos.map((t, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 font-bold text-hawk-text">{t.nome}</td>
                        <td className="p-3 text-hawk-muted">{t.qtd}</td>
                        <td className="p-3 font-bold text-hawk-green">{formatarMoeda(t.ganhoHora)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-hawk-muted text-sm italic">Registre horas de início e término na aba de Ganhos.</p>
            )}
          </div>
        </div>

        {/* LADO DIREITO: CHATBOT IA */}
        <div className="relative rounded-2xl border border-hawk-purple/30 bg-gradient-to-br from-hawk-bg to-hawk-card p-0 shadow-card flex flex-col h-[700px] lg:h-auto overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-glass-border bg-hawk-purple/10 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-hawk-text flex items-center gap-2">
                <span>🧠</span> Hawk AI Chat
              </h3>
              <p className="text-xs text-hawk-muted">
                Pergunte sobre seus dados, dicas e estratégias.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHistorico(true)}
                className="text-hawk-muted hover:text-hawk-purple transition-colors p-2 rounded-lg hover:bg-hawk-purple/10"
                title="Conversas salvas"
              >
                ☰
              </button>
              <button
                onClick={novaConversa}
                className="text-hawk-muted hover:text-hawk-purple transition-colors p-2 rounded-lg hover:bg-hawk-purple/10"
                title="Nova conversa"
              >
                ＋
              </button>
              <button
                onClick={() => setIsConfigOpen(!isConfigOpen)}
                className="text-hawk-muted hover:text-hawk-purple transition-colors p-2 rounded-lg hover:bg-hawk-purple/10"
                title="Configurações da IA"
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Drawer de histórico (desliza sobre o painel) */}
          {showHistorico && (
            <HistoricoConversas
              conversas={conversas}
              conversaAtivaId={conversaAtivaId}
              onSelecionar={carregarConversa}
              onApagar={apagarConversa}
              onNova={novaConversa}
              onFechar={() => setShowHistorico(false)}
            />
          )}

          {/* Configurações Dropdown */}
          {isConfigOpen && (
            <div className="p-4 border-b border-glass-border bg-hawk-card/90">
              <form onSubmit={saveConfig} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-hawk-muted block mb-1">API Key Gemini:</label>
                  <input type="password" required value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Sua chave..." className="w-full bg-hawk-input border border-glass-border rounded-lg px-3 py-2 text-sm text-hawk-text focus:outline-none focus:border-hawk-purple" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-hawk-muted block mb-1">Tipo de Veículo:</label>
                  <select value={tipoVeiculo} onChange={e => setTipoVeiculo(e.target.value)} className="w-full bg-hawk-input border border-glass-border rounded-lg px-3 py-2 text-sm text-hawk-text focus:outline-none focus:border-hawk-purple cursor-pointer">
                    <option value="gasolina">Gasolina</option>
                    <option value="etanol">Etanol</option>
                    <option value="gnv">GNV (Gás Natural)</option>
                    <option value="eletrico">Elétrico ⚡</option>
                    <option value="hibrido">Híbrido</option>
                    <option value="diesel">Diesel</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-hawk-purple hover:bg-hawk-purple/90 text-white font-semibold py-2 rounded-lg text-sm transition-all active:scale-95">Salvar Configurações</button>
              </form>
              
              <div className="mt-4 pt-4 border-t border-glass-border">
                <p className="text-xs text-hawk-muted mb-2 font-medium">Limpeza de Dados Antigos:</p>
                <button 
                  onClick={handleExportarApagarAntigos} 
                  className="w-full bg-hawk-red/10 border border-hawk-red/20 hover:bg-hawk-red/20 text-hawk-red font-semibold py-2 rounded-lg text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Exportar UBER (2025 e 2024) e Apagar
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-hawk-muted">
                <span className="text-4xl mb-2 opacity-50">🤖</span>
                <p className="text-sm opacity-50">Olá! Eu sou sua IA Financeira.</p>
                <p className="text-xs max-w-[250px] mt-1 text-center opacity-50">Eu conheço 100% dos seus dados de ganhos, gastos fixos e variáveis. Toque numa pergunta abaixo:</p>
                {apiKey && (
                  <div className="flex flex-col gap-2 w-full max-w-[320px] mt-5">
                    {PERGUNTAS_SUGERIDAS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(null, p.texto)}
                        className="flex items-center gap-2 text-left text-xs text-hawk-text bg-hawk-input border border-glass-border hover:border-hawk-purple hover:bg-hawk-purple/10 rounded-xl px-3 py-2.5 transition-all active:scale-[0.98]"
                      >
                        <span className="text-base">{p.emoji}</span>
                        <span>{p.texto}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-hawk-purple text-white rounded-br-none' : 'bg-hawk-input border border-glass-border text-hawk-text rounded-bl-none'}`}>
                    <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-strong:text-current">
                      <ReactMarkdown components={markdownComponents}>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-none px-4 py-3 bg-hawk-input border border-glass-border text-hawk-muted flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-hawk-purple rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-hawk-purple rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-hawk-purple rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-glass-border bg-hawk-bg">
            {!apiKey ? (
              <button onClick={() => setIsConfigOpen(true)} className="w-full text-center text-sm text-hawk-purple underline">
                Configure sua API Key para começar a usar a IA
              </button>
            ) : (
              <>
                {!isChatLoading && (
                  <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-thin">
                    {PERGUNTAS_SUGERIDAS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(null, p.texto)}
                        className="flex items-center gap-1.5 whitespace-nowrap text-xs text-hawk-text bg-hawk-input border border-glass-border hover:border-hawk-purple hover:bg-hawk-purple/10 rounded-full px-3 py-1.5 transition-all active:scale-95"
                      >
                        <span>{p.emoji}</span>
                        <span>{p.texto}</span>
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  placeholder="Pergunte sobre seus ganhos, melhores dias..."
                  className="flex-1 bg-hawk-input border border-glass-border rounded-xl px-4 py-3 text-sm text-hawk-text focus:outline-none focus:border-hawk-purple transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isChatLoading}
                  className="bg-hawk-purple hover:bg-hawk-purple/90 text-white rounded-xl px-4 py-3 disabled:opacity-50 transition-all flex items-center justify-center"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
                </form>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
