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
  addDoc,
  increment
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
  'Reserva de Emergência': '#ffd93d',
  'Manutenção': '#ff6b6b',
  'Empresa': '#6c5ce7',
  'Livre': '#00b894',
  'Contas': '#0984e3'
};

const CATEGORIAS_DISPONIVEIS = ['UberX', 'Comfort', 'Black', '99 (App)', 'Flash', 'Moto'];

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
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  // Histórico state hooks
  const [historicoExpandido, setHistoricoExpandido] = useState(false);
  const [mesesExpandidos, setMesesExpandidos] = useState({});

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

  // ─── Timer / Cronômetro State ───
  const [jornadaAtiva, setJornadaAtiva] = useState(false);
  const [jornadaInicioOriginal, setJornadaInicioOriginal] = useState(null);
  const [jornadaInicioTimer, setJornadaInicioTimer] = useState(null);
  const [jornadaAcumulada, setJornadaAcumulada] = useState(0);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);

  // ─── Carregar Cronômetro do LocalStorage ───
  useEffect(() => {
    const ativa = localStorage.getItem('hawk_driver_jornada_ativa') === 'true';
    const inicioOrig = localStorage.getItem('hawk_driver_jornada_inicio_original');
    const inicioTimer = localStorage.getItem('hawk_driver_jornada_inicio_timer');
    const acumulada = parseInt(localStorage.getItem('hawk_driver_jornada_acumulada') || '0', 10);

    setJornadaAtiva(ativa);
    setJornadaInicioOriginal(inicioOrig ? parseInt(inicioOrig, 10) : null);
    setJornadaInicioTimer(inicioTimer ? parseInt(inicioTimer, 10) : null);
    setJornadaAcumulada(acumulada);
  }, []);

  // ─── Salvar Cronômetro no LocalStorage ───
  useEffect(() => {
    localStorage.setItem('hawk_driver_jornada_ativa', jornadaAtiva.toString());
    if (jornadaInicioOriginal) {
      localStorage.setItem('hawk_driver_jornada_inicio_original', jornadaInicioOriginal.toString());
    } else {
      localStorage.removeItem('hawk_driver_jornada_inicio_original');
    }
    if (jornadaInicioTimer) {
      localStorage.setItem('hawk_driver_jornada_inicio_timer', jornadaInicioTimer.toString());
    } else {
      localStorage.removeItem('hawk_driver_jornada_inicio_timer');
    }
    localStorage.setItem('hawk_driver_jornada_acumulada', jornadaAcumulada.toString());
  }, [jornadaAtiva, jornadaInicioOriginal, jornadaInicioTimer, jornadaAcumulada]);

  // ─── Atualizar Tempo em Tela (Interval) ───
  useEffect(() => {
    let interval = null;
    if (jornadaAtiva && jornadaInicioTimer) {
      interval = setInterval(() => {
        const agora = Date.now();
        const decorridoAqui = agora - jornadaInicioTimer;
        setTempoDecorrido(jornadaAcumulada + decorridoAqui);
      }, 1000);
    } else {
      setTempoDecorrido(jornadaAcumulada);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jornadaAtiva, jornadaInicioTimer, jornadaAcumulada]);

  const pad = (num) => String(num).padStart(2, '0');
  
  const formatarTempoTimer = (ms) => {
    const totalSegundos = Math.floor(ms / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    return `${pad(horas)}:${pad(minutos)}:${pad(segundos)}`;
  };

  const iniciarJornada = () => {
    const agora = Date.now();
    const dataObj = new Date(agora);
    
    setJornadaAtiva(true);
    setJornadaInicioOriginal(agora);
    setJornadaInicioTimer(agora);
    setJornadaAcumulada(0);
    setTempoDecorrido(0);

    setHoraInicio(`${pad(dataObj.getHours())}:${pad(dataObj.getMinutes())}`);
  };

  const pausarJornada = () => {
    if (jornadaAtiva && jornadaInicioTimer) {
      const agora = Date.now();
      const acumulou = agora - jornadaInicioTimer;
      setJornadaAcumulada(prev => prev + acumulou);
      setJornadaAtiva(false);
      setJornadaInicioTimer(null);
    }
  };

  const retomarJornada = () => {
    const agora = Date.now();
    setJornadaInicioTimer(agora);
    setJornadaAtiva(true);
  };

  const encerrarJornada = () => {
    let tempoTotalMs = jornadaAcumulada;
    const agora = Date.now();
    const dataObj = new Date(agora);

    if (jornadaAtiva && jornadaInicioTimer) {
      tempoTotalMs += (agora - jornadaInicioTimer);
    }

    setJornadaAtiva(false);
    setJornadaInicioOriginal(null);
    setJornadaInicioTimer(null);
    setJornadaAcumulada(0);
    setTempoDecorrido(0);
    
    const totalSegundos = Math.floor(tempoTotalMs / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    
    setHoraFim(`${pad(dataObj.getHours())}:${pad(dataObj.getMinutes())}`);
    setHorarioRodado(`${horas}h${minutos > 0 ? pad(minutos) : '00'}`);
  };

  // ─── Handlers ───
  const toggleCategoria = (cat) => {
    setCategoriasSelecionadas(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

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
      setHoraInicio(registroDoDia.horaInicio || '');
      setHoraFim(registroDoDia.horaFim || '');
      setCategoriasSelecionadas(registroDoDia.categorias || []);
      setManutencaoValor(registroDoDia.manutencaoValor != null ? String(registroDoDia.manutencaoValor) : '');
    } else {
      setKm('');
      setTotalBruto('');
      setGastosGerais('');
      setViagens('');
      setHorarioRodado('');
      setHoraInicio('');
      setHoraFim('');
      setCategoriasSelecionadas([]);
      setManutencaoValor('');
    }
  }, [dataChave, registroDoDia]);

  // ─── Auto-calculate total hours from start/end times ───
  useEffect(() => {
    if (horaInicio && horaFim) {
      const [hStart, mStart] = horaInicio.split(':').map(Number);
      let [hEnd, mEnd] = horaFim.split(':').map(Number);

      let startMinutes = hStart * 60 + mStart;
      let endMinutes = hEnd * 60 + mEnd;

      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60; // Spans across midnight
      }

      const diffMinutes = endMinutes - startMinutes;
      const h = Math.floor(diffMinutes / 60);
      const m = diffMinutes % 60;
      setHorarioRodado(`${h}h${m > 0 ? String(m).padStart(2, '0') : '00'}`);
    }
  }, [horaInicio, horaFim]);

  // ─── Derived values ───
  const brutoNum = parseFloat(totalBruto) || 0;
  const gastosNum = parseFloat(gastosGerais) || 0;
  const liquidoNum = brutoNum - gastosNum;
  const pctEmpresaTotal = pctEmpresa; // Liquid
  const pctManutencaoTotal = pctManutencao; // Bruto
  const valorCaixinhasEmpresa = brutoNum * (pctManutencao / 100) + liquidoNum * (pctEmpresa / 100);

  const pctPessoalTotal = pctEmergencia + pctLivre + pctContas;
  const valorCaixinhasMotorista = brutoNum * (pctEmergencia / 100) + liquidoNum * (pctLivre / 100) + liquidoNum * (pctContas / 100);

  const motoristaNum = valorCaixinhasMotorista;
  const empresaNum = valorCaixinhasEmpresa;
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
    let totalBruto = 0;
    let totalKm = 0;
    let totalViagens = 0;

    registrosMes.forEach(r => {
      const bruto = r.totalBruto || 0;
      const gastos = r.gastosGerais || 0;
      totalBruto += bruto;
      totalLiquido += bruto - gastos;
      totalKm += r.km || 0;
      totalViagens += r.viagens || 0;
    });

    const totalCaixinhasEmpresa = totalBruto * (pctManutencao / 100) + totalLiquido * (pctEmpresa / 100);
    const totalCaixinhasMotorista = totalBruto * (pctEmergencia / 100) + totalLiquido * (pctLivre / 100) + totalLiquido * (pctContas / 100);

    return {
      bruto: totalBruto,
      liquido: totalLiquido,
      motorista: totalCaixinhasMotorista,
      empresa: totalCaixinhasEmpresa,
      km: totalKm,
      viagens: totalViagens,
      horas: somarHoras(registrosMes)
    };
  }, [registrosMes, pctManutencao, pctEmpresa, pctEmergencia, pctLivre, pctContas]);

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
      { name: 'Reserva de Emergência', value: emergencia },
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
      const reg = registrosMap[chave];
      if (reg) {
        if (reg.totalLiquido > 0 && !reg.caixinhasEnviadas) {
          return 'calendar-day-highlight calendar-day-pendente';
        }
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

    // Calculate duration automatically from start/end times if filled
    let duracaoRodada = horarioRodado;
    if (horaInicio && horaFim) {
      const [hStart, mStart] = horaInicio.split(':').map(Number);
      let [hEnd, mEnd] = horaFim.split(':').map(Number);

      let startMinutes = hStart * 60 + mStart;
      let endMinutes = hEnd * 60 + mEnd;

      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60; // Spans across midnight
      }

      const diffMinutes = endMinutes - startMinutes;
      const h = Math.floor(diffMinutes / 60);
      const m = diffMinutes % 60;
      duracaoRodada = `${h}h${m > 0 ? String(m).padStart(2, '0') : '00'}`;
    }

    try {
      const totalLiquido = brutoNum - gastosNum;
      const docRef = doc(db, 'usuarios', usuario.uid, 'registros', dataChave);
      const dados = {
        km: kmNum,
        totalBruto: brutoNum,
        gastosGerais: gastosNum,
        totalLiquido,
        viagens: viagensNum,
        horarioRodado: duracaoRodada || '',
        horaInicio: horaInicio || '',
        horaFim: horaFim || '',
        categorias: categoriasSelecionadas || [],
        manutencaoValor: brutoNum * (pctManutencao / 100),
        data: dataChave,
        atualizadoEm: serverTimestamp()
      };
      // Preserve caixinha sent flags if they exist
      // Preserve caixinha sent flag se existir
      if (registroDoDia && registroDoDia.caixinhasEnviadas) {
        dados.caixinhasEnviadas = true;
      } else {
        dados.caixinhasEnviadas = false;
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
    
    const sumBruto = parseFloat(pctEmergencia||0) + parseFloat(pctManutencao||0);
    const sumLiquido = parseFloat(pctEmpresa||0) + parseFloat(pctLivre||0) + parseFloat(pctContas||0);
    
    if (sumBruto > 100 || sumLiquido > 100) {
      alert("As porcentagens não podem ultrapassar 100% em suas respectivas bases (Bruto e Líquido).");
      return;
    }

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
  // ─── Confirmar Envio para Caixinhas (Patrimônio) ───
  const confirmarEnvioCaixinhas = async () => {
    if (!usuario || !registroDoDia || registroDoDia.caixinhasEnviadas) return;
    setSalvando(true);
    try {
      const valoresCaixinhas = {
        emergencia: brutoNum * (pctEmergencia / 100),
        manutencao: brutoNum * (pctManutencao / 100),
        empresa: liquidoNum * (pctEmpresa / 100),
        livre: liquidoNum * (pctLivre / 100),
        contas: liquidoNum * (pctContas / 100)
      };

      const saldoUpdates = {};
      const transacoesRef = collection(db, 'usuarios', usuario.uid, 'transacoes_patrimonio');
      const batchPromises = [];

      // Para cada caixinha que tem valor > 0, preparamos o incremento e a transação
      for (const [chaveId, valor] of Object.entries(valoresCaixinhas)) {
        if (valor > 0) {
          saldoUpdates[chaveId] = increment(valor);
          
          let nomeBonito = chaveId;
          if (chaveId === 'emergencia') nomeBonito = 'Reserva de Emergência';
          if (chaveId === 'manutencao') nomeBonito = 'Manutenção';
          if (chaveId === 'empresa') nomeBonito = 'Empresa';
          if (chaveId === 'livre') nomeBonito = 'Livre / Lazer';
          if (chaveId === 'contas') nomeBonito = 'Contas';

          batchPromises.push(
            addDoc(transacoesRef, {
              caixinhaId: chaveId,
              caixinhaNome: nomeBonito,
              tipo: 'ENTRADA',
              valor: valor,
              motivo: `Depósito automático do fechamento do dia ${dataSelecionada.toLocaleDateString('pt-BR')}`,
              data: formatarDataChave(new Date()),
              criadoEm: serverTimestamp()
            })
          );
        }
      }

      saldoUpdates.atualizadoEm = serverTimestamp();
      const saldoRef = doc(db, 'usuarios', usuario.uid, 'saldos', 'atual');
      batchPromises.push(setDoc(saldoRef, saldoUpdates, { merge: true }));

      const registroRef = doc(db, 'usuarios', usuario.uid, 'registros', dataChave);
      batchPromises.push(setDoc(registroRef, { caixinhasEnviadas: true }, { merge: true }));

      await Promise.all(batchPromises);
      alert('🎉 Dinheiro enviado com sucesso para a aba Patrimônio!');
    } catch (err) {
      console.error('Erro ao enviar caixinhas:', err);
      alert('Erro ao enviar dinheiro: ' + err.message);
    }
    setSalvando(false);
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

  // Group records by month for easier overview
  const registrosAgrupadosPorMes = useMemo(() => {
    const grupos = {};

    historicoRegistros.forEach(r => {
      const [ano, mes] = r.id.split('-');
      const chaveMes = `${ano}-${mes}`;
      if (!grupos[chaveMes]) {
        const dataObjeto = new Date(r.id + 'T12:00:00');
        const nomeMesRaw = dataObjeto.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const nomeMes = nomeMesRaw.charAt(0).toUpperCase() + nomeMesRaw.slice(1);

        grupos[chaveMes] = {
          chave: chaveMes,
          nomeMes,
          registros: [],
          totalBruto: 0,
          totalGastos: 0,
          totalLiquido: 0,
          totalKm: 0,
          totalViagens: 0
        };
      }

      const rBruto = r.totalBruto || 0;
      const rGastos = r.gastosGerais || 0;
      const rLiquido = r.totalLiquido != null ? r.totalLiquido : rBruto - rGastos;

      grupos[chaveMes].registros.push(r);
      grupos[chaveMes].totalBruto += rBruto;
      grupos[chaveMes].totalGastos += rGastos;
      grupos[chaveMes].totalLiquido += rLiquido;
      grupos[chaveMes].totalKm += r.km || 0;
      grupos[chaveMes].totalViagens += r.viagens || 0;
    });

    return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0])).map(([_, val]) => val);
  }, [historicoRegistros]);

  const toggleMesExpandido = (chaveMes) => {
    setMesesExpandidos(prev => ({
      ...prev,
      [chaveMes]: !prev[chaveMes]
    }));
  };

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

      {/* ═══════ CRONÔMETRO DE JORNADA ═══════ */}
      <div className="section-card" style={{ textAlign: 'center', padding: '32px 20px', position: 'relative', overflow: 'hidden' }}>
        <h2 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px' }}>
          ⏳ Jornada de Trabalho
        </h2>
        
        <div style={{
          fontFamily: 'monospace',
          fontSize: 'clamp(3rem, 10vw, 5rem)',
          fontWeight: 800,
          color: jornadaAtiva ? 'var(--green)' : (tempoDecorrido > 0 ? 'var(--yellow)' : 'var(--text-primary)'),
          textShadow: jornadaAtiva ? '0 0 20px var(--green-glow)' : 'none',
          marginBottom: '32px',
          letterSpacing: '2px',
          lineHeight: 1
        }}>
          {formatarTempoTimer(tempoDecorrido)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {!jornadaAtiva && tempoDecorrido === 0 && (
            <button className="btn-primary" onClick={iniciarJornada} style={{ padding: '16px 36px', fontSize: '1.1rem', borderRadius: '50px', width: '100%', maxWidth: '250px', justifyContent: 'center' }}>
              ▶ Iniciar Jornada
            </button>
          )}

          {jornadaAtiva && (
            <button onClick={pausarJornada} style={{ padding: '16px 36px', fontSize: '1.1rem', borderRadius: '50px', background: 'var(--yellow-dim)', color: 'var(--yellow)', border: '1px solid rgba(255, 217, 61, 0.3)', cursor: 'pointer', fontWeight: 600, width: '100%', maxWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'var(--transition)' }}>
              ⏸ Pausar
            </button>
          )}

          {!jornadaAtiva && tempoDecorrido > 0 && (
            <button onClick={retomarJornada} style={{ padding: '16px 36px', fontSize: '1.1rem', borderRadius: '50px', background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(0, 212, 170, 0.3)', cursor: 'pointer', fontWeight: 600, width: '100%', maxWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'var(--transition)' }}>
              ▶ Retomar
            </button>
          )}

          {(jornadaAtiva || tempoDecorrido > 0) && (
            <button onClick={encerrarJornada} style={{ padding: '16px 36px', fontSize: '1.1rem', borderRadius: '50px', background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(255, 107, 107, 0.3)', cursor: 'pointer', fontWeight: 600, width: '100%', maxWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'var(--transition)' }}>
              ⏹ Encerrar
            </button>
          )}
        </div>
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
            <label className="form-label">⏰ Início do Turno</label>
            <input
              type="time"
              className="form-input"
              value={horaInicio}
              onChange={e => setHoraInicio(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">🏁 Término do Turno</label>
            <input
              type="time"
              className="form-input"
              value={horaFim}
              onChange={e => setHoraFim(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">⏱️ Total de Horas Rodadas</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: 8h30, 8 ou 5h45"
              value={horarioRodado}
              onChange={e => setHorarioRodado(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
              Calculado se preencher Início/Término, ou digite diretamente.
            </span>
          </div>
        </div>

        {/* Categorias & Apps Selecionáveis */}
        <div style={{ marginTop: '20px', marginBottom: '24px', textAlign: 'left' }}>
          <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
            🚗 Categorias & Apps Ativos no Dia
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {CATEGORIAS_DISPONIVEIS.map(cat => {
              const ativo = categoriasSelecionadas.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategoria(cat)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '50px',
                    border: '1px solid',
                    borderColor: ativo ? 'var(--green)' : 'var(--glass-border)',
                    background: ativo ? 'var(--green-dim)' : 'var(--glass-bg)',
                    color: ativo ? 'var(--green)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    transition: 'var(--transition-fast)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  className="tag-btn-selecionar"
                >
                  {ativo ? '✓' : '+'} {cat}
                </button>
              );
            })}
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
            <span className="summary-label">Valor Pessoal / Salário</span>
            <span className="summary-value">{formatarMoeda(motoristaNum)}</span>
          </div>
          <div className="summary-card summary-purple">
            <span className="summary-label">Valor Empresa / Custo</span>
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
            <span className="summary-label">Pessoal / Salário</span>
            <span className="summary-value">{formatarMoeda(resumoMes.motorista)}</span>
          </div>
          <div className="summary-card summary-purple">
            <span className="summary-label">Empresa / Custo</span>
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
            
            <div style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span>Alocação do <strong>Bruto</strong> (Emergência + Manutenção)</span>
                  <span style={{ color: (parseFloat(pctEmergencia||0) + parseFloat(pctManutencao||0)) > 100 ? '#ff6b6b' : '#00d4aa', fontWeight: 'bold' }}>
                    {parseFloat(pctEmergencia||0) + parseFloat(pctManutencao||0)}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${Math.min(100, parseFloat(pctEmergencia||0))}%`, background: '#ffd93d' }} title="Emergência" />
                  <div style={{ width: `${Math.min(100, parseFloat(pctManutencao||0))}%`, background: '#ff6b6b' }} title="Manutenção" />
                </div>
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span>Alocação do <strong>Líquido</strong> (Empresa + Livre + Contas)</span>
                  <span style={{ color: (parseFloat(pctEmpresa||0) + parseFloat(pctLivre||0) + parseFloat(pctContas||0)) > 100 ? '#ff6b6b' : '#00d4aa', fontWeight: 'bold' }}>
                    {parseFloat(pctEmpresa||0) + parseFloat(pctLivre||0) + parseFloat(pctContas||0)}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${Math.min(100, parseFloat(pctEmpresa||0))}%`, background: '#6c5ce7' }} title="Empresa" />
                  <div style={{ width: `${Math.min(100, parseFloat(pctLivre||0))}%`, background: '#00b894' }} title="Livre" />
                  <div style={{ width: `${Math.min(100, parseFloat(pctContas||0))}%`, background: '#0984e3' }} title="Contas" />
                </div>
              </div>
            </div>

            <div className="config-grid">
              <div className="config-group">
                <label className="config-label">🚨 Reserva de Emergência (% Bruto)</label>
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

        {/* Blocos de Separação de Negócio e Salário */}
        <div style={{ marginTop: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '1.05rem', margin: '0 0 16px 0', color: 'var(--text-primary)' }}>🏢 Para a Empresa (Custos Fixos e Variáveis)</h3>
          <div className="caixinhas-grid">
            {/* Manutenção */}
            <div className={`caixinha-card ${registroDoDia?.caixinhasEnviadas ? 'caixinha-enviada' : ''}`}>
              <span className="caixinha-label">🔧 Manutenção ({pctManutencao}% Bruto)</span>
              <span className="caixinha-valor">{formatarMoeda(brutoNum * (pctManutencao / 100))}</span>
            </div>

            {/* Empresa */}
            <div className={`caixinha-card ${registroDoDia?.caixinhasEnviadas ? 'caixinha-enviada' : ''}`}>
              <span className="caixinha-label">🏢 Empresa ({pctEmpresa}% Líquido)</span>
              <span className="caixinha-valor">{formatarMoeda(liquidoNum * (pctEmpresa / 100))}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '1.05rem', margin: '0 0 16px 0', color: 'var(--text-primary)' }}>👤 Para o seu Salário (Pessoa Física)</h3>
          <div className="caixinhas-grid">
            {/* Emergência */}
            <div className={`caixinha-card ${registroDoDia?.caixinhasEnviadas ? 'caixinha-enviada' : ''}`}>
              <span className="caixinha-label">🚨 Reserva de Emergência ({pctEmergencia}% Bruto)</span>
              <span className="caixinha-valor">{formatarMoeda(brutoNum * (pctEmergencia / 100))}</span>
            </div>

            {/* Livre - Lazer */}
            <div className={`caixinha-card ${registroDoDia?.caixinhasEnviadas ? 'caixinha-enviada' : ''}`}>
              <span className="caixinha-label">💸 Livre - Lazer ({pctLivre}% Líquido)</span>
              <span className="caixinha-valor">{formatarMoeda(liquidoNum * (pctLivre / 100))}</span>
            </div>

            {/* Contas */}
            <div className={`caixinha-card ${registroDoDia?.caixinhasEnviadas ? 'caixinha-enviada' : ''}`}>
              <span className="caixinha-label">💳 Contas ({pctContas}% Líquido)</span>
              <span className="caixinha-valor">{formatarMoeda(liquidoNum * (pctContas / 100))}</span>
            </div>
          </div>
        </div>

        {/* Botão Global de Envio para Patrimônio */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          {registroDoDia?.caixinhasEnviadas ? (
            <div style={{
              background: 'rgba(0, 212, 170, 0.1)',
              border: '1px solid rgba(0, 212, 170, 0.3)',
              color: '#00d4aa',
              padding: '16px',
              borderRadius: '12px',
              fontWeight: 600,
              display: 'inline-block'
            }}>
              ✅ Distribuição enviada para a aba Patrimônio neste dia!
            </div>
          ) : liquidoNum > 0 ? (
            <button
              className="btn-primary"
              onClick={confirmarEnvioCaixinhas}
              disabled={salvando}
              style={{ fontSize: '1rem', padding: '14px 28px' }}
            >
              {salvando ? 'Processando...' : '💰 Confirmar Envio para Caixinhas (Patrimônio)'}
            </button>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>Sem lucros para distribuir neste dia.</p>
          )}
        </div>
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
        <div className="historico-header-row">
          <h2 className="section-title" style={{ margin: 0 }}>📜 Histórico de Registros</h2>
          {historicoRegistros.length > 0 && (
            <button
              className="btn-maximize"
              onClick={() => setHistoricoExpandido(!historicoExpandido)}
            >
              {historicoExpandido ? '↕️ Minimizar Histórico' : '↕️ Maximizar Histórico'}
            </button>
          )}
        </div>

        {historicoRegistros.length > 0 ? (
          !historicoExpandido ? (
            <div
              className="month-group-card"
              style={{ cursor: 'pointer', padding: '20px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)' }}
              onClick={() => setHistoricoExpandido(true)}
            >
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                📂 O histórico de registros está minimizado.
                <strong style={{ color: 'var(--purple)', marginLeft: '6px' }}>Clique para Maximizar / Visualizar</strong>.
              </p>
            </div>
          ) : (
            <div className="historico-expandido-container">
              {registrosAgrupadosPorMes.map((grupo, idx) => {
                const isExpanded = mesesExpandidos[grupo.chave] !== undefined
                  ? mesesExpandidos[grupo.chave]
                  : idx === 0; // Most recent month expanded by default

                return (
                  <div key={grupo.chave} className="month-group-card">
                    <div
                      className="month-group-header"
                      onClick={() => toggleMesExpandido(grupo.chave)}
                    >
                      <div className="month-group-title">
                        <span>📅</span>
                        {grupo.nomeMes}
                      </div>
                      <div className="month-group-summary">
                        <span>Bruto: <strong>{formatarMoeda(grupo.totalBruto)}</strong></span>
                        <span className={grupo.totalLiquido < 0 ? 'negative' : ''}>
                          Líquido: <strong>{formatarMoeda(grupo.totalLiquido)}</strong>
                        </span>
                        <span>Km: <strong>{grupo.totalKm} km</strong></span>
                      </div>
                      <span className={`month-group-arrow ${isExpanded ? 'rotated' : ''}`}>▼</span>
                    </div>

                    {isExpanded && (
                      <div className="historico-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
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
                            {grupo.registros.map(r => {
                              const rBruto = r.totalBruto || 0;
                              const rGastos = r.gastosGerais || 0;
                              const rLiquido = r.totalLiquido != null ? r.totalLiquido : rBruto - rGastos;
                              return (
                                <tr key={r.id} onClick={() => setDataSelecionada(new Date(r.id + 'T12:00:00'))}>
                                  <td>{formatarDataExibicao(r.id)}</td>
                                  <td>{r.km != null ? r.km : 0}</td>
                                  <td>{formatarMoeda(rBruto)}</td>
                                  <td>{formatarMoeda(rGastos)}</td>
                                  <td className={`td-liquido ${rLiquido < 0 ? 'negative' : ''}`}>
                                    {formatarMoeda(rLiquido)}
                                  </td>
                                  <td>{r.viagens != null ? r.viagens : 0}</td>
                                  <td>{r.horarioRodado || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <p className="empty-state">Nenhum registro encontrado. Comece salvando seu primeiro dia!</p>
        )}
      </div>

      {/* ═══════ 10. PAINEL DE CONSISTÊNCIA ═══════ */}
      <ConsistenciaPanel registrosMap={registrosMap} mesAtivo={mesAtivo} />
    </div>
  );
}
