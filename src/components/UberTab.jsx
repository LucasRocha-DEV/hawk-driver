import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import Calendar from 'react-calendar';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import ConsistenciaPanel from './ConsistenciaPanel';

const FRASES_MOTIVACIONAIS = [
  '🚗 Cada corrida é um passo mais perto dos seus sonhos!',
  '💪 Você é mais forte do que qualquer trânsito!',
  '🌟 Hoje é dia de bater metas e fazer história!',
  '🔥 Motorista de elite não para, só faz pausas estratégicas!',
  '💰 Seu esforço de hoje constrói sua liberdade de amanhã!',
  '🦅 Como um Hawk, você voa acima dos obstáculos!',
  '🎯 Foco no objetivo, o resultado vem naturalmente!',
  '⚡ Energia positiva atrai corridas positivas!',
  '🏆 Discipline é a ponte entre metas e conquistas!',
  '🌅 Cada amanhecer é uma nova chance de faturar alto!'
];

const CORES_GRAFICO = {
  bruto: '#6c5ce7',
  liquido: '#00d4aa',
  gastos: '#ff6b6b',
  viagens: '#ffd93d'
};

const CORES_PIZZA = {
  'Emergência': '#ffd93d',
  'Manutenção': '#ff6b6b',
  'Empresa': '#6c5ce7',
  'Livre': '#00b894',
  'Contas': '#0984e3'
};

function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataChave(data) {
  const d = new Date(data);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarDataExibicao(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

function parsarHoras(horarioStr) {
  if (!horarioStr) return 0;
  const match = horarioStr.match(/(\d+)h(\d*)/);
  if (match) {
    const horas = parseInt(match[1], 10) || 0;
    const minutos = parseInt(match[2], 10) || 0;
    return horas + minutos / 60;
  }
  return parseFloat(horarioStr) || 0;
}

function somarHoras(registros) {
  let totalMinutos = 0;
  registros.forEach(r => {
    if (r.horarioRodado) {
      const match = r.horarioRodado.match(/(\d+)h(\d*)/);
      if (match) {
        totalMinutos += (parseInt(match[1], 10) || 0) * 60 + (parseInt(match[2], 10) || 0);
      }
    }
  });
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export default function UberTab() {
  const { usuario } = useAuth();

  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [mesAtivo, setMesAtivo] = useState(new Date());
  const [registrosMap, setRegistrosMap] = useState({});
  const [retiradasList, setRetiradasList] = useState([]);
  const [fraseIndex, setFraseIndex] = useState(0);
  const [fraseVisivel, setFraseVisivel] = useState(true);

  // Form state
  const [km, setKm] = useState('');
  const [totalBruto, setTotalBruto] = useState('');
  const [gastosGerais, setGastosGerais] = useState('');
  const [viagens, setViagens] = useState('');
  const [horarioRodado, setHorarioRodado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  // Caixinhas config states
  const [pctEmergencia, setPctEmergencia] = useState(10);
  const [pctManutencao, setPctManutencao] = useState(10);
  const [pctEmpresa, setPctEmpresa] = useState(30);
  const [pctLivre, setPctLivre] = useState(10);
  const [pctContas, setPctContas] = useState(20);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  // Caixinhas state
  const [manutencaoValor, setManutencaoValor] = useState('');
  const [mostrarRetirada, setMostrarRetirada] = useState(false);
  const [retiradaCaixinha, setRetiradaCaixinha] = useState('Emergência');
  const [retiradaValor, setRetiradaValor] = useState('');
  const [retiradaMotivo, setRetiradaMotivo] = useState('');
  const [retiradaData, setRetiradaData] = useState(formatarDataChave(new Date()));
  const [salvandoRetirada, setSalvandoRetirada] = useState(false);

  // ─── Motivational Phrases Rotation ───
  useEffect(() => {
    const intervalo = setInterval(() => {
      setFraseVisivel(false);
      setTimeout(() => {
        setFraseIndex(prev => (prev + 1) % FRASES_MOTIVACIONAIS.length);
        setFraseVisivel(true);
      }, 400);
    }, 10000);
    return () => clearInterval(intervalo);
  }, []);

  // ─── Firestore Listener: Caixinhas Config ───
  useEffect(() => {
    if (!usuario) return;
    const configRef = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'caixinhas');
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.pctEmergencia != null) setPctEmergencia(d.pctEmergencia);
        if (d.pctManutencao != null) setPctManutencao(d.pctManutencao);
        if (d.pctEmpresa != null) setPctEmpresa(d.pctEmpresa);
        if (d.pctLivre != null) setPctLivre(d.pctLivre);
        if (d.pctContas != null) setPctContas(d.pctContas);
      }
    });
    return () => unsubscribe();
  }, [usuario]);

  // ─── Firestore Listener: Registros ───
  useEffect(() => {
    if (!usuario) return;
    const registrosRef = collection(db, 'usuarios', usuario.uid, 'registros');
    const unsubscribe = onSnapshot(registrosRef, (snapshot) => {
      const mapa = {};
      snapshot.forEach(docSnap => {
        mapa[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
      });
      setRegistrosMap(mapa);
    });
    return () => unsubscribe();
  }, [usuario]);

  // ─── Firestore Listener: Retiradas ───
  useEffect(() => {
    if (!usuario) return;
    const retiradasRef = collection(db, 'usuarios', usuario.uid, 'retiradas_nubank');
    const q = query(retiradasRef, orderBy('criadoEm', 'desc'), limit(8));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach(docSnap => {
        lista.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRetiradasList(lista);
    });
    return () => unsubscribe();
  }, [usuario]);

  // ─── Populate form when date changes ───
  const dataChave = formatarDataChave(dataSelecionada);
  const registroDoDia = registrosMap[dataChave] || null;

  useEffect(() => {
    if (registroDoDia) {
      setKm(registroDoDia.km != null ? String(registroDoDia.km) : '');
      setTotalBruto(registroDoDia.totalBruto != null ? String(registroDoDia.totalBruto) : '');
      setGastosGerais(registroDoDia.gastosGerais != null ? String(registroDoDia.gastosGerais) : '');
      setViagens(registroDoDia.viagens != null ? String(registroDoDia.viagens) : '');
      setHorarioRodado(registroDoDia.horarioRodado || '');
      setManutencaoValor(registroDoDia.manutencaoValor != null ? String(registroDoDia.manutencaoValor) : '');
    } else {
      setKm('');
      setTotalBruto('');
      setGastosGerais('');
      setViagens('');
      setHorarioRodado('');
      setManutencaoValor('');
    }
  }, [dataChave, registroDoDia]);

  // ─── Derived values ───
  const brutoNum = parseFloat(totalBruto) || 0;
  const gastosNum = parseFloat(gastosGerais) || 0;
  const liquidoNum = brutoNum - gastosNum;
  const motoristaNum = liquidoNum * 0.7;
  const empresaNum = liquidoNum * 0.3;
  const kmNum = parseFloat(km) || 0;
  const viagensNum = parseInt(viagens, 10) || 0;

  // ─── Registros Array ───
  const registrosArray = useMemo(() => {
    return Object.values(registrosMap).sort((a, b) => {
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
  }, [registrosMap]);

  // ─── Monthly filtered records ───
  const registrosMes = useMemo(() => {
    const mesRef = mesAtivo.getMonth();
    const anoRef = mesAtivo.getFullYear();
    return registrosArray.filter(r => {
      const d = new Date(r.id + 'T12:00:00');
      return d.getMonth() === mesRef && d.getFullYear() === anoRef;
    });
  }, [registrosArray, mesAtivo]);

  // ─── Monthly totals ───
  const resumoMes = useMemo(() => {
    let totalLiquido = 0;
    let totalKm = 0;
    let totalViagens = 0;

    registrosMes.forEach(r => {
      const bruto = r.totalBruto || 0;
      const gastos = r.gastosGerais || 0;
      totalLiquido += bruto - gastos;
      totalKm += r.km || 0;
      totalViagens += r.viagens || 0;
    });

    return {
      liquido: totalLiquido,
      motorista: totalLiquido * 0.7,
      empresa: totalLiquido * 0.3,
      km: totalKm,
      viagens: totalViagens,
      horas: somarHoras(registrosMes)
    };
  }, [registrosMes]);

  // ─── Line chart data ───
  const dadosGraficoLinha = useMemo(() => {
    return registrosMes.map(r => ({
      data: r.id.slice(5),
      bruto: r.totalBruto || 0,
      liquido: (r.totalBruto || 0) - (r.gastosGerais || 0),
      gastos: r.gastosGerais || 0,
      viagens: r.viagens || 0
    }));
  }, [registrosMes]);

  // ─── Pie chart data ───
  const dadosGraficoPizza = useMemo(() => {
    const emergencia = brutoNum * (pctEmergencia / 100);
    const manutencao = brutoNum * (pctManutencao / 100);
    const empresa = liquidoNum * (pctEmpresa / 100);
    const livre = liquidoNum * (pctLivre / 100);
    const contas = liquidoNum * (pctContas / 100);
    const itens = [
      { name: 'Emergência', value: emergencia },
      { name: 'Manutenção', value: manutencao },
      { name: 'Empresa', value: empresa },
      { name: 'Livre', value: livre },
      { name: 'Contas', value: contas }
    ];
    return itens.filter(i => i.value > 0);
  }, [brutoNum, liquidoNum, pctEmergencia, pctManutencao, pctEmpresa, pctLivre, pctContas]);

  // ─── Total retiradas do mês ───
  const totalRetiradasMes = useMemo(() => {
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();
    return retiradasList
      .filter(r => {
        if (!r.data) return false;
        const d = new Date(r.data + 'T12:00:00');
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
      })
      .reduce((soma, r) => soma + (r.valor || 0), 0);
  }, [retiradasList]);

  // ─── Calendar tile class ───
  const tileClassName = useCallback(({ date, view }) => {
    if (view === 'month') {
      const chave = formatarDataChave(date);
      if (registrosMap[chave]) {
        return 'calendar-day-highlight';
      }
    }
    return null;
  }, [registrosMap]);

  // ─── Save daily entry ───
  const salvarDia = async () => {
    if (!usuario) return;
    setSalvando(true);
    setErro(null);
    try {
      const totalLiquido = brutoNum - gastosNum;
      const docRef = doc(db, 'usuarios', usuario.uid, 'registros', dataChave);
      const dados = {
        km: kmNum,
        totalBruto: brutoNum,
        gastosGerais: gastosNum,
        totalLiquido,
        viagens: viagensNum,
        horarioRodado: horarioRodado || '',
        manutencaoValor: brutoNum * (pctManutencao / 100),
        data: dataChave,
        atualizadoEm: serverTimestamp()
      };
      // Preserve caixinha sent flags if they exist
      if (registroDoDia) {
        if (registroDoDia.caixinhaEmergenciaEnviada) dados.caixinhaEmergenciaEnviada = true;
        if (registroDoDia.caixinhaManutencaoEnviada) dados.caixinhaManutencaoEnviada = true;
        if (registroDoDia.caixinhaEmpresaEnviada) dados.caixinhaEmpresaEnviada = true;
        if (registroDoDia.caixinhaLivreEnviada) dados.caixinhaLivreEnviada = true;
        if (registroDoDia.caixinhaContasEnviada) dados.caixinhaContasEnviada = true;
      }
      await setDoc(docRef, dados, { merge: true });
      alert('✅ Registro diário salvo com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar registro:', err);
      setErro(err.code || err.message || 'Erro de Gravação');
    }
    setSalvando(false);
  };

  // ─── Save caixinhas percentage configuration ───
  const salvarConfiguracao = async (e) => {
    e.preventDefault();
    if (!usuario) return;
    setSalvandoConfig(true);
    try {
      const configRef = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'caixinhas');
      await setDoc(configRef, {
        pctEmergencia: parseFloat(pctEmergencia) || 0,
        pctManutencao: parseFloat(pctManutencao) || 0,
        pctEmpresa: parseFloat(pctEmpresa) || 0,
        pctLivre: parseFloat(pctLivre) || 0,
        pctContas: parseFloat(pctContas) || 0,
        atualizadoEm: serverTimestamp()
      });
      setMostrarConfig(false);
    } catch (err) {
      console.error('Erro ao salvar configurações de caixinhas:', err);
    }
    setSalvandoConfig(false);
  };

  // ─── Caixinha toggle ───
  const toggleCaixinha = async (campo, valor) => {
    if (!usuario) return;
    try {
      const docRef = doc(db, 'usuarios', usuario.uid, 'registros', dataChave);
      await setDoc(docRef, { [campo]: valor }, { merge: true });
    } catch (err) {
      console.error('Erro ao atualizar caixinha:', err);
    }
  };

  // ─── Save retirada ───
  const salvarRetirada = async () => {
    if (!usuario || !retiradaValor) return;
    setSalvandoRetirada(true);
    try {
      const retiradasRef = collection(db, 'usuarios', usuario.uid, 'retiradas_nubank');
      await addDoc(retiradasRef, {
        caixinha: retiradaCaixinha,
        valor: parseFloat(retiradaValor) || 0,
        motivo: retiradaMotivo,
        data: retiradaData,
        criadoEm: serverTimestamp()
      });
      setRetiradaValor('');
      setRetiradaMotivo('');
      setMostrarRetirada(false);
    } catch (err) {
      console.error('Erro ao salvar retirada:', err);
    }
    setSalvandoRetirada(false);
  };

  // ─── Delete retirada ───
  const deletarRetirada = async (id) => {
    if (!usuario) return;
    try {
      await deleteDoc(doc(db, 'usuarios', usuario.uid, 'retiradas_nubank', id));
    } catch (err) {
      console.error('Erro ao deletar retirada:', err);
    }
  };

  // ─── Custom tooltip for line chart ───
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'viagens' ? entry.value : formatarMoeda(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // ─── Pie chart custom label ───
  const renderPieLabel = ({ name, percent }) => {
    return `${name} ${(percent * 100).toFixed(0)}%`;
  };

  // ─── History records sorted descending ───
  const historicoRegistros = useMemo(() => {
    return [...registrosArray].sort((a, b) => {
      if (a.id > b.id) return -1;
      if (a.id < b.id) return 1;
      return 0;
    });
  }, [registrosArray]);

  // ─── Dates with records set (for calendar highlight) ───
  const datasComRegistro = useMemo(() => {
    return new Set(Object.keys(registrosMap));
  }, [registrosMap]);

  return (
    <div className="uber-tab">
      {/* ═══════ 1. FRASE MOTIVACIONAL ═══════ */}
      <div className="motivational-banner">
        <p className={`motivational-text ${fraseVisivel ? 'fade-in' : 'fade-out'}`}>
          {FRASES_MOTIVACIONAIS[fraseIndex]}
        </p>
      </div>

      {/* ═══════ 2. CALENDÁRIO INTERATIVO ═══════ */}
      <div className="section-card">
        <h2 className="section-title">📅 Calendário</h2>
        <div className="calendar-wrapper">
          <Calendar
            onChange={setDataSelecionada}
            value={dataSelecionada}
            locale="pt-BR"
            tileClassName={tileClassName}
            onActiveStartDateChange={({ activeStartDate }) => setMesAtivo(activeStartDate)}
          />
        </div>
        <p className="calendar-selected-date">
          Data selecionada: <strong>{dataSelecionada.toLocaleDateString('pt-BR')}</strong>
        </p>
      </div>

      {/* ═══════ 3. FORMULÁRIO DE REGISTRO DIÁRIO ═══════ */}
      <div className="section-card">
        <h2 className="section-title">📝 Registro do Dia — {dataSelecionada.toLocaleDateString('pt-BR')}</h2>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Km Rodados</label>
            <input
              type="number"
              className="form-input"
              placeholder="Ex: 180"
              value={km}
              onChange={e => setKm(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Total Bruto (R$)</label>
            <input
              type="number"
              className="form-input"
              placeholder="Ex: 350.00"
              value={totalBruto}
              onChange={e => setTotalBruto(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Gastos Gerais (R$)</label>
            <input
              type="number"
              className="form-input"
              placeholder="Ex: 80.00"
              value={gastosGerais}
              onChange={e => setGastosGerais(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Viagens</label>
            <input
              type="number"
              className="form-input"
              placeholder="Ex: 15"
              value={viagens}
              onChange={e => setViagens(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Horário Rodado</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: 8h30"
              value={horarioRodado}
              onChange={e => setHorarioRodado(e.target.value)}
            />
          </div>
        </div>
        {erro && (
          <div style={{
            background: 'rgba(255, 107, 107, 0.15)',
            border: '1px solid rgba(255, 107, 107, 0.25)',
            color: '#ff6b6b',
            padding: '14px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            marginBottom: '16px',
            lineHeight: '1.5',
            textAlign: 'left'
          }}>
            <strong>⚠️ Falha ao Salvar no Firebase:</strong><br />
            {erro.includes('permission') || erro.includes('Permission') || erro.includes('permission-denied')
              ? 'Permissão negada! Suas regras do Firestore estão bloqueando gravações na nuvem. Acesse o seu Firebase Console > Firestore Database > Rules e altere para permitir leituras e gravações para usuários autenticados.'
              : `Erro: ${erro}. Verifique se o seu banco Firestore foi ativado ou confira a conexão de rede.`}
          </div>
        )}

        <button
          className="btn-primary btn-salvar"
          onClick={salvarDia}
          disabled={salvando}
        >
          {salvando ? 'Salvando...' : '💾 Salvar Dia'}
        </button>
      </div>

      {/* ═══════ 4. RESUMO DO DIA ═══════ */}
      <div className="section-card">
        <h2 className="section-title">📊 Resumo do Dia — {dataSelecionada.toLocaleDateString('pt-BR')}</h2>
        <div className="summary-grid">
          <div className="summary-card summary-green">
            <span className="summary-label">Líquido</span>
            <span className="summary-value">{formatarMoeda(liquidoNum)}</span>
          </div>
          <div className="summary-card summary-blue">
            <span className="summary-label">Valor Motorista (70%)</span>
            <span className="summary-value">{formatarMoeda(motoristaNum)}</span>
          </div>
          <div className="summary-card summary-purple">
            <span className="summary-label">Valor Empresa (30%)</span>
            <span className="summary-value">{formatarMoeda(empresaNum)}</span>
          </div>
          <div className="summary-card summary-default">
            <span className="summary-label">Km Rodados</span>
            <span className="summary-value">{kmNum} km</span>
          </div>
          <div className="summary-card summary-default">
            <span className="summary-label">Viagens</span>
            <span className="summary-value">{viagensNum}</span>
          </div>
          <div className="summary-card summary-default">
            <span className="summary-label">Horas Rodadas</span>
            <span className="summary-value">{horarioRodado || '0h00'}</span>
          </div>
        </div>
      </div>

      {/* ═══════ 5. RESUMO DO MÊS ═══════ */}
      <div className="section-card">
        <h2 className="section-title">
          📈 Resumo do Mês — {mesAtivo.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="summary-grid">
          <div className="summary-card summary-green">
            <span className="summary-label">Líquido Total</span>
            <span className="summary-value">{formatarMoeda(resumoMes.liquido)}</span>
          </div>
          <div className="summary-card summary-blue">
            <span className="summary-label">Motorista (70%)</span>
            <span className="summary-value">{formatarMoeda(resumoMes.motorista)}</span>
          </div>
          <div className="summary-card summary-purple">
            <span className="summary-label">Empresa (30%)</span>
            <span className="summary-value">{formatarMoeda(resumoMes.empresa)}</span>
          </div>
          <div className="summary-card summary-default">
            <span className="summary-label">Km Total</span>
            <span className="summary-value">{resumoMes.km} km</span>
          </div>
          <div className="summary-card summary-default">
            <span className="summary-label">Viagens Total</span>
            <span className="summary-value">{resumoMes.viagens}</span>
          </div>
          <div className="summary-card summary-default">
            <span className="summary-label">Horas Total</span>
            <span className="summary-value">{resumoMes.horas}</span>
          </div>
        </div>
      </div>

      {/* ═══════ 6. BANCO CAIXINHAS ═══════ */}
      <div className="section-card">
        <div className="flex-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 className="section-title" style={{ margin: 0 }}>🏦 Banco Caixinhas — {dataSelecionada.toLocaleDateString('pt-BR')}</h2>
          <button 
            className="caixinhas-config-toggle"
            onClick={() => setMostrarConfig(!mostrarConfig)}
          >
            {mostrarConfig ? '✕ Fechar Configurações' : '⚙️ Configurar Caixinhas'}
          </button>
        </div>

        {mostrarConfig && (
          <form className="caixinhas-config-panel" onSubmit={salvarConfiguracao}>
            <h3 className="config-title">⚙️ Ajustar Porcentagens do Banco Caixinhas</h3>
            <div className="config-grid">
              <div className="config-group">
                <label className="config-label">🚨 Emergência (% Bruto)</label>
                <div className="config-input-wrapper">
                  <input 
                    type="number" 
                    className="config-input" 
                    value={pctEmergencia} 
                    onChange={e => setPctEmergencia(e.target.value)} 
                    min="0" max="100" required
                  />
                  <span className="config-symbol">%</span>
                </div>
              </div>
              <div className="config-group">
                <label className="config-label">🔧 Manutenção (% Bruto)</label>
                <div className="config-input-wrapper">
                  <input 
                    type="number" 
                    className="config-input" 
                    value={pctManutencao} 
                    onChange={e => setPctManutencao(e.target.value)} 
                    min="0" max="100" required
                  />
                  <span className="config-symbol">%</span>
                </div>
              </div>
              <div className="config-group">
                <label className="config-label">🏢 Empresa (% Líquido)</label>
                <div className="config-input-wrapper">
                  <input 
                    type="number" 
                    className="config-input" 
                    value={pctEmpresa} 
                    onChange={e => setPctEmpresa(e.target.value)} 
                    min="0" max="100" required
                  />
                  <span className="config-symbol">%</span>
                </div>
              </div>
              <div className="config-group">
                <label className="config-label">💸 Livre - Lazer (% Líquido)</label>
                <div className="config-input-wrapper">
                  <input 
                    type="number" 
                    className="config-input" 
                    value={pctLivre} 
                    onChange={e => setPctLivre(e.target.value)} 
                    min="0" max="100" required
                  />
                  <span className="config-symbol">%</span>
                </div>
              </div>
              <div className="config-group">
                <label className="config-label">💳 Contas (% Líquido)</label>
                <div className="config-input-wrapper">
                  <input 
                    type="number" 
                    className="config-input" 
                    value={pctContas} 
                    onChange={e => setPctContas(e.target.value)} 
                    min="0" max="100" required
                  />
                  <span className="config-symbol">%</span>
                </div>
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={salvandoConfig}>
              {salvandoConfig ? 'Salvando...' : '💾 Salvar Porcentagens'}
            </button>
          </form>
        )}

        <div className="caixinhas-grid">
          {/* Emergência */}
          <div className={`caixinha-card ${registroDoDia?.caixinhaEmergenciaEnviada ? 'caixinha-enviada' : ''}`}>
            <span className="caixinha-label">🚨 Emergência ({pctEmergencia}% do Bruto)</span>
            <span className="caixinha-valor">{formatarMoeda(brutoNum * (pctEmergencia / 100))}</span>
            {registroDoDia?.caixinhaEmergenciaEnviada ? (
              <button
                className="btn-desfazer"
                onClick={() => toggleCaixinha('caixinhaEmergenciaEnviada', false)}
              >
                ↩ Desfazer
              </button>
            ) : (
              <button
                className="btn-caixinha"
                onClick={() => toggleCaixinha('caixinhaEmergenciaEnviada', true)}
              >
                ✓ Marcar como Enviado
              </button>
            )}
          </div>

          {/* Manutenção */}
          <div className={`caixinha-card ${registroDoDia?.caixinhaManutencaoEnviada ? 'caixinha-enviada' : ''}`}>
            <span className="caixinha-label">🔧 Manutenção ({pctManutencao}% do Bruto)</span>
            <span className="caixinha-valor">{formatarMoeda(brutoNum * (pctManutencao / 100))}</span>
            {registroDoDia?.caixinhaManutencaoEnviada ? (
              <button
                className="btn-desfazer"
                onClick={() => toggleCaixinha('caixinhaManutencaoEnviada', false)}
              >
                ↩ Desfazer
              </button>
            ) : (
              <button
                className="btn-caixinha"
                onClick={() => toggleCaixinha('caixinhaManutencaoEnviada', true)}
              >
                ✓ Marcar como Enviado
              </button>
            )}
          </div>

          {/* Empresa */}
          <div className={`caixinha-card ${registroDoDia?.caixinhaEmpresaEnviada ? 'caixinha-enviada' : ''}`}>
            <span className="caixinha-label">🏢 Empresa ({pctEmpresa}% do Líquido)</span>
            <span className="caixinha-valor">{formatarMoeda(liquidoNum * (pctEmpresa / 100))}</span>
            {registroDoDia?.caixinhaEmpresaEnviada ? (
              <button
                className="btn-desfazer"
                onClick={() => toggleCaixinha('caixinhaEmpresaEnviada', false)}
              >
                ↩ Desfazer
              </button>
            ) : (
              <button
                className="btn-caixinha"
                onClick={() => toggleCaixinha('caixinhaEmpresaEnviada', true)}
              >
                ✓ Marcar como Enviado
              </button>
            )}
          </div>

          {/* Livre - Lazer */}
          <div className={`caixinha-card ${registroDoDia?.caixinhaLivreEnviada ? 'caixinha-enviada' : ''}`}>
            <span className="caixinha-label">💸 Livre - Lazer ({pctLivre}% do Líquido)</span>
            <span className="caixinha-valor">{formatarMoeda(liquidoNum * (pctLivre / 100))}</span>
            {registroDoDia?.caixinhaLivreEnviada ? (
              <button
                className="btn-desfazer"
                onClick={() => toggleCaixinha('caixinhaLivreEnviada', false)}
              >
                ↩ Desfazer
              </button>
            ) : (
              <button
                className="btn-caixinha"
                onClick={() => toggleCaixinha('caixinhaLivreEnviada', true)}
              >
                ✓ Marcar como Enviado
              </button>
            )}
          </div>

          {/* Contas */}
          <div className={`caixinha-card ${registroDoDia?.caixinhaContasEnviada ? 'caixinha-enviada' : ''}`}>
            <span className="caixinha-label">💳 Contas ({pctContas}% do Líquido)</span>
            <span className="caixinha-valor">{formatarMoeda(liquidoNum * (pctContas / 100))}</span>
            {registroDoDia?.caixinhaContasEnviada ? (
              <button
                className="btn-desfazer"
                onClick={() => toggleCaixinha('caixinhaContasEnviada', false)}
              >
                ↩ Desfazer
              </button>
            ) : (
              <button
                className="btn-caixinha"
                onClick={() => toggleCaixinha('caixinhaContasEnviada', true)}
              >
                ✓ Marcar como Enviado
              </button>
            )}
          </div>
        </div>

        {/* Retirada de Caixinha */}
        <div className="retirada-section">
          <button
            className="btn-secondary"
            onClick={() => setMostrarRetirada(!mostrarRetirada)}
          >
            {mostrarRetirada ? '✕ Fechar' : '📤 Registrar Retirada'}
          </button>

          {mostrarRetirada && (
            <div className="retirada-form">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Caixinha</label>
                  <select
                    className="form-input"
                    value={retiradaCaixinha}
                    onChange={e => setRetiradaCaixinha(e.target.value)}
                  >
                    <option value="Emergência">Emergência</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Empresa">Empresa</option>
                    <option value="Livre">Livre</option>
                    <option value="Contas">Contas</option>
                    <option value="Outra">Outra</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Valor (R$)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Ex: 150.00"
                    value={retiradaValor}
                    onChange={e => setRetiradaValor(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Motivo</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Troca de pneu"
                    value={retiradaMotivo}
                    onChange={e => setRetiradaMotivo(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Data</label>
                  <input
                    type="date"
                    className="form-input"
                    value={retiradaData}
                    onChange={e => setRetiradaData(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="btn-primary"
                onClick={salvarRetirada}
                disabled={salvandoRetirada}
              >
                {salvandoRetirada ? 'Salvando...' : '💾 Salvar Retirada'}
              </button>
            </div>
          )}
        </div>

        {/* Histórico de Retiradas */}
        {retiradasList.length > 0 && (
          <div className="retiradas-historico">
            <h3 className="subsection-title">📋 Histórico de Retiradas</h3>
            <p className="retiradas-total-mes">
              Total retirado este mês: <strong>{formatarMoeda(totalRetiradasMes)}</strong>
            </p>
            <div className="retiradas-lista">
              {retiradasList.map(r => (
                <div key={r.id} className="retirada-item">
                  <div className="retirada-info">
                    <span className="retirada-caixinha-tag">{r.caixinha}</span>
                    <span className="retirada-motivo">{r.motivo || '—'}</span>
                  </div>
                  <div className="retirada-meta">
                    <span className="retirada-valor-display">{formatarMoeda(r.valor)}</span>
                    <span className="retirada-data">{r.data ? formatarDataExibicao(r.data) : '—'}</span>
                    <button
                      className="btn-delete-sm"
                      onClick={() => deletarRetirada(r.id)}
                      title="Excluir retirada"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════ 7. GRÁFICO DE LINHA ═══════ */}
      <div className="section-card">
        <h2 className="section-title">
          📉 Evolução Mensal — {mesAtivo.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h2>
        {dadosGraficoLinha.length > 0 ? (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={dadosGraficoLinha}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="data" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="bruto"
                  name="Bruto"
                  stroke={CORES_GRAFICO.bruto}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="liquido"
                  name="Líquido"
                  stroke={CORES_GRAFICO.liquido}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="gastos"
                  name="Gastos"
                  stroke={CORES_GRAFICO.gastos}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="viagens"
                  name="Viagens"
                  stroke={CORES_GRAFICO.viagens}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="empty-state">Nenhum registro encontrado neste mês.</p>
        )}
      </div>

      {/* ═══════ 8. GRÁFICO PIZZA ═══════ */}
      <div className="section-card">
        <h2 className="section-title">🥧 Distribuição das Caixinhas — {dataSelecionada.toLocaleDateString('pt-BR')}</h2>
        {dadosGraficoPizza.length > 0 ? (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosGraficoPizza}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={renderPieLabel}
                  labelLine={true}
                >
                  {dadosGraficoPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CORES_PIZZA[entry.name] || '#ccc'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatarMoeda(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="empty-state">Preencha os valores do dia para ver a distribuição.</p>
        )}
      </div>

      {/* ═══════ 9. HISTÓRICO DE REGISTROS ═══════ */}
      <div className="section-card">
        <h2 className="section-title">📜 Histórico de Registros</h2>
        {historicoRegistros.length > 0 ? (
          <div className="historico-table-wrapper">
            <table className="historico-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Km</th>
                  <th>Bruto</th>
                  <th>Gastos</th>
                  <th>Líquido</th>
                  <th>Viagens</th>
                  <th>Horas</th>
                </tr>
              </thead>
              <tbody>
                {historicoRegistros.map(r => {
                  const rBruto = r.totalBruto || 0;
                  const rGastos = r.gastosGerais || 0;
                  const rLiquido = r.totalLiquido != null ? r.totalLiquido : rBruto - rGastos;
                  return (
                    <tr key={r.id} onClick={() => setDataSelecionada(new Date(r.id + 'T12:00:00'))}>
                      <td>{formatarDataExibicao(r.id)}</td>
                      <td>{r.km != null ? r.km : 0}</td>
                      <td>{formatarMoeda(rBruto)}</td>
                      <td>{formatarMoeda(rGastos)}</td>
                      <td className="td-liquido">{formatarMoeda(rLiquido)}</td>
                      <td>{r.viagens != null ? r.viagens : 0}</td>
                      <td>{r.horarioRodado || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">Nenhum registro encontrado. Comece salvando seu primeiro dia!</p>
        )}
      </div>

      {/* ═══════ 10. PAINEL DE CONSISTÊNCIA ═══════ */}
      <ConsistenciaPanel registrosMap={registrosMap} mesAtivo={mesAtivo} />
    </div>
  );
}
