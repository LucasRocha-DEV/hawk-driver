import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  addDoc,
  increment
} from 'firebase/firestore';
import { formatarDataChave, somarHoras, pad, nomeCaixinha } from '../utils/helpers';
import ConsistenciaPanel from './ConsistenciaPanel';

// ── Subcomponentes Tailwind ──
import MotivationalBanner   from './uber/MotivationalBanner';
import JornadaTimer         from './uber/JornadaTimer';
import DailyForm            from './uber/DailyForm';
import DailySummary         from './uber/DailySummary';
import MonthlySummary       from './uber/MonthlySummary';
import BancoCaixinhas       from './uber/BancoCaixinhas';
import MonthlyChart         from './uber/MonthlyChart';
import PieDistribution      from './uber/PieDistribution';
import HistoricoRegistros   from './uber/HistoricoRegistros';
import RepasseModal         from './uber/RepasseModal';

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

export default function UberTab() {
  const { usuario } = useAuth();

  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [mesAtivo, setMesAtivo] = useState(new Date());
  const [registrosMap, setRegistrosMap] = useState({});
  const [fraseIndex, setFraseIndex] = useState(0);
  const [fraseVisivel, setFraseVisivel] = useState(true);
  const [saldos, setSaldos] = useState({});

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

  // ─── Repasse State ───
  const [mostrarRepasseModal, setMostrarRepasseModal] = useState(false);
  const [processandoRepasse, setProcessandoRepasse] = useState(false);
  const saldoRetido = saldos.saldoRetidoApps || 0;

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

  // pad importado de helpers
  
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

  // ─── Firestore Listener: Saldos ───
  useEffect(() => {
    if (!usuario) return;
    const saldoRef = doc(db, 'usuarios', usuario.uid, 'saldos', 'atual');
    const unsubscribe = onSnapshot(saldoRef, (docSnap) => {
      if (docSnap.exists()) setSaldos(docSnap.data());
    });
    return () => unsubscribe();
  }, [usuario]);

  // Listener de retiradas_nubank removido (coleção abandonada)

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

  // totalRetiradasMes removido (retiradas_nubank descontinuado)

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

    try {
      const brutoNum = parseFloat(totalBruto) || 0;
      const gastosNum = parseFloat(gastosGerais) || 0;
      const totalLiquido = brutoNum - gastosNum;
      
      const docRef = doc(db, 'usuarios', usuario.uid, 'registros', dataChave);
      
      const snap = await getDoc(docRef);
      let diferencaBruto = brutoNum;
      if (snap.exists()) {
        diferencaBruto = brutoNum - (Number(snap.data().totalBruto) || 0);
      }

      const dados = {
        km: parseFloat(km) || 0,
        totalBruto: brutoNum,
        gastosGerais: gastosNum,
        totalLiquido,
        viagens: parseInt(viagens, 10) || 0,
        horarioRodado: horarioRodado || '',
        horaInicio: horaInicio || '',
        horaFim: horaFim || '',
        categorias: categoriasSelecionadas || [],
        manutencaoValor: brutoNum * (pctManutencao / 100),
        data: dataChave,
        atualizadoEm: serverTimestamp()
      };
      
      if (registroDoDia && registroDoDia.caixinhasEnviadas) {
        dados.caixinhasEnviadas = true;
      } else {
        dados.caixinhasEnviadas = false;
      }
      
      await setDoc(docRef, dados, { merge: true });

      if (diferencaBruto !== 0) {
        const saldoRef = doc(db, 'usuarios', usuario.uid, 'saldos', 'atual');
        await setDoc(saldoRef, { saldoRetidoApps: increment(diferencaBruto) }, { merge: true });
      }

      alert('✅ Registro diário salvo!');
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

  // ─── Processar Repasse Semanal ───
  const processarRepasse = async () => {
    if (!usuario) return;
    setProcessandoRepasse(true);
    try {
      const diasPendentes = registrosArray.filter(r => (r.totalBruto > 0 && !r.caixinhasEnviadas));
      
      let sumBrutoPendentes = 0;
      let sumLiquidoPendentes = 0;
      
      diasPendentes.forEach(d => {
        sumBrutoPendentes += (d.totalBruto || 0);
        sumLiquidoPendentes += (d.totalLiquido || 0);
      });

      const valorParaDistribuirBruto = saldoRetido;
      const valorExtra = valorParaDistribuirBruto - sumBrutoPendentes;
      const valorParaDistribuirLiquido = sumLiquidoPendentes + valorExtra;

      const valoresCaixinhas = {
        emergencia: valorParaDistribuirBruto * (pctEmergencia / 100),
        manutencao: valorParaDistribuirBruto * (pctManutencao / 100),
        empresa: valorParaDistribuirLiquido * (pctEmpresa / 100),
        livre: valorParaDistribuirLiquido * (pctLivre / 100),
        contas: valorParaDistribuirLiquido * (pctContas / 100)
      };

      const saldoUpdates = {};
      const transacoesRef = collection(db, 'usuarios', usuario.uid, 'transacoes_patrimonio');
      const batchPromises = [];

      for (const [chaveId, valor] of Object.entries(valoresCaixinhas)) {
        if (valor > 0) {
          saldoUpdates[chaveId] = increment(valor);
          
          const nomeBonito = nomeCaixinha(chaveId);

          batchPromises.push(
            addDoc(transacoesRef, {
              caixinhaId: chaveId,
              caixinhaNome: nomeBonito,
              tipo: 'ENTRADA',
              valor: valor,
              motivo: `Repasse Semanal (Apps)`,
              data: formatarDataChave(new Date()),
              criadoEm: serverTimestamp()
            })
          );
        }
      }

      saldoUpdates.saldoRetidoApps = increment(-valorParaDistribuirBruto);
      saldoUpdates.atualizadoEm = serverTimestamp();
      
      const saldoRef = doc(db, 'usuarios', usuario.uid, 'saldos', 'atual');
      batchPromises.push(setDoc(saldoRef, saldoUpdates, { merge: true }));

      diasPendentes.forEach(d => {
        const regRef = doc(db, 'usuarios', usuario.uid, 'registros', d.id);
        batchPromises.push(setDoc(regRef, { caixinhasEnviadas: true }, { merge: true }));
      });

      await Promise.all(batchPromises);
      alert('🎉 Repasse distribuído com sucesso para o seu Patrimônio!');
      setMostrarRepasseModal(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao processar repasse: ' + err.message);
    }
    setProcessandoRepasse(false);
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
    <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 space-y-4 animate-fade-in">
      {/* ═══════ 1. FRASE MOTIVACIONAL ═══════ */}
      <MotivationalBanner frase={FRASES_MOTIVACIONAIS[fraseIndex]} visivel={fraseVisivel} />

      {/* ═══════ CRONÔMETRO DE JORNADA ═══════ */}
      <JornadaTimer
        jornadaAtiva={jornadaAtiva}
        tempoDecorrido={tempoDecorrido}
        formatarTempoTimer={formatarTempoTimer}
        onIniciar={iniciarJornada}
        onPausar={pausarJornada}
        onRetomar={retomarJornada}
        onEncerrar={encerrarJornada}
      />

      {/* ═══════ 2+3. CALENDÁRIO + FORMULÁRIO DE REGISTRO DIÁRIO ═══════ */}
      <DailyForm
        dataSelecionada={dataSelecionada}
        setDataSelecionada={setDataSelecionada}
        mesAtivo={mesAtivo}
        setMesAtivo={setMesAtivo}
        tileClassName={tileClassName}
        km={km} setKm={setKm}
        totalBruto={totalBruto} setTotalBruto={setTotalBruto}
        gastosGerais={gastosGerais} setGastosGerais={setGastosGerais}
        viagens={viagens} setViagens={setViagens}
        horaInicio={horaInicio} setHoraInicio={setHoraInicio}
        horaFim={horaFim} setHoraFim={setHoraFim}
        horarioRodado={horarioRodado} setHorarioRodado={setHorarioRodado}
        categoriasSelecionadas={categoriasSelecionadas}
        toggleCategoria={toggleCategoria}
        erro={erro}
        salvando={salvando}
        onSalvar={salvarDia}
      />
      {/* ═══════ 4. RESUMO DO DIA ═══════ */}
      <DailySummary
        dataSelecionada={dataSelecionada}
        liquidoNum={liquidoNum}
        motoristaNum={motoristaNum}
        empresaNum={empresaNum}
        kmNum={kmNum}
        viagensNum={viagensNum}
        horarioRodado={horarioRodado}
      />

      {/* ═══════ 5. RESUMO DO MÊS ═══════ */}
      <MonthlySummary mesAtivo={mesAtivo} resumoMes={resumoMes} />

      {/* ═══════ 6. BANCO CAIXINHAS ═══════ */}
      <BancoCaixinhas
        dataSelecionada={dataSelecionada}
        registroDoDia={registroDoDia}
        brutoNum={brutoNum}
        liquidoNum={liquidoNum}
        pctEmergencia={pctEmergencia} setPctEmergencia={setPctEmergencia}
        pctManutencao={pctManutencao} setPctManutencao={setPctManutencao}
        pctEmpresa={pctEmpresa}       setPctEmpresa={setPctEmpresa}
        pctLivre={pctLivre}           setPctLivre={setPctLivre}
        pctContas={pctContas}         setPctContas={setPctContas}
        saldoRetido={saldoRetido}
        salvandoConfig={salvandoConfig}
        onSalvarConfig={salvarConfiguracao}
        onAbrirRepasse={() => setMostrarRepasseModal(true)}
      />

      {/* ═══════ 7. GRÁFICO DE LINHA ═══════ */}
      <MonthlyChart mesAtivo={mesAtivo} dados={dadosGraficoLinha} />

      {/* ═══════ 8. GRÁFICO PIZZA ═══════ */}
      <PieDistribution dataSelecionada={dataSelecionada} dados={dadosGraficoPizza} />

      {/* ═══════ 9. HISTÓRICO DE REGISTROS ═══════ */}
      <HistoricoRegistros
        registrosAgrupadosPorMes={registrosAgrupadosPorMes}
        onSelectData={setDataSelecionada}
      />

      {/* ═══════ 10. PAINEL DE CONSISTÊNCIA ═══════ */}
      <ConsistenciaPanel registrosMap={registrosMap} mesAtivo={mesAtivo} />

      {/* ═══════ MODAL REPASSE SEMANAL ═══════ */}
      {mostrarRepasseModal && (
        <RepasseModal
          saldoRetido={saldoRetido}
          processando={processandoRepasse}
          onConfirmar={processarRepasse}
          onCancelar={() => setMostrarRepasseModal(false)}
        />
      )}
    </div>
  );
}

