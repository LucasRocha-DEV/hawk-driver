import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  setDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { formatarMoeda, formatarData, dataHojeISO, gerarGrupoId, MESES, nomeCaixinha } from '../utils/helpers';
import NavegacaoMes from './NavegacaoMes';
import SeletorNatureza from './SeletorNatureza';
import ModalPagamento from './ModalPagamento';
import ModalCategorias from './ModalCategorias';
import { usePreferencias } from '../contexts/PreferenciasContext';

const CATEGORIAS_DEFAULT = [
  { id: 'Alimentação', label: '🍔 Alimentação', cor: '#ff6b6b' },
  { id: 'Mercado', label: '🛒 Mercado', cor: '#ffd93d' },
  { id: 'Transporte', label: '🚕 Transporte', cor: '#6c5ce7' },
  { id: 'Saúde / Farmácia', label: '💊 Saúde/Farmácia', cor: '#00d4aa' },
  { id: 'Vestuário', label: '👕 Vestuário', cor: '#fd79a8' },
  { id: 'Lazer', label: '🎉 Lazer', cor: '#e17055' },
  { id: 'Manutenção Veículo', label: '🔧 Manutenção Veíc.', cor: '#0984e3' },
  { id: 'Combustível (eventual)', label: '⛽ Combustível', cor: '#00b894' },
  { id: 'Restaurante', label: '🍽️ Restaurante', cor: '#a29bfe' },
  { id: 'Compras Online', label: '📦 Compras Online', cor: '#fdcb6e' },
  { id: 'Presente', label: '🎁 Presente', cor: '#636e72' },
  { id: 'Cartão de Crédito', label: '💳 Cartão de Créd.', cor: '#e84393' },
  { id: 'Outros', label: '📦 Outros', cor: '#b2bec3' },
  { id: 'Eletrônicos / Bens', label: '📺 Eletrônicos/Bens', cor: '#00cec9' }
];

const METODOS_PAGAMENTO = [
  'Cartão de Crédito',
  'Cartão de Débito',
  'PIX',
  'Dinheiro',
  'Boleto'
];

export default function GastosVariaveisTab() {
  const { usuario } = useAuth();
  const { rotuloEsposa, emojiEsposa, pessoasVinculadas } = usePreferencias();
  const agora = new Date();

  const [mesAtual, setMesAtual] = useState(agora.getMonth());
  const [anoAtual, setAnoAtual] = useState(agora.getFullYear());

  const [gastos, setGastos] = useState([]);
  const [saldos, setSaldos] = useState({});
  const [cartoes, setCartoes] = useState([]);
  const [faturasPagas, setFaturasPagas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Form state
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(dataHojeISO());
  const [observacao, setObservacao] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  
  // Cartão Fields
  const [cartaoId, setCartaoId] = useState('');
  const [isCartaoTerceiro, setIsCartaoTerceiro] = useState(false);
  const [nomeCartaoTerceiro, setNomeCartaoTerceiro] = useState('');

  const [parcelado, setParcelado] = useState(false);
  const [totalParcelas, setTotalParcelas] = useState('');
  const [natureza, setNatureza] = useState('PESSOAL'); // EMPRESA ou PESSOAL
  // Pessoa vinculada do gasto (null = gasto próprio). isEsposa = !!pessoaId (compat).
  const [pessoaId, setPessoaId] = useState(null);
  const [pessoaNome, setPessoaNome] = useState('');
  const [pessoaEmoji, setPessoaEmoji] = useState('');
  const [salvando, setSalvando] = useState(false);

  const selecionarPessoa = (p) => {
    setPessoaId(p ? p.id : null);
    setPessoaNome(p ? p.nome : '');
    setPessoaEmoji(p ? p.emoji : '');
  };
  // Campos de pessoa para gravar no documento (mantém isEsposa para os somatórios existentes).
  const camposPessoa = () => ({
    isEsposa: !!pessoaId,
    pessoaId: pessoaId || null,
    pessoaNome: pessoaNome || '',
    pessoaEmoji: pessoaEmoji || '',
  });

  const [editandoId, setEditandoId] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  // Pagamento Inteligente
  const [pagamentoModal, setPagamentoModal] = useState(null);

  // Categorias Dinâmicas
  const [categorias, setCategorias] = useState(CATEGORIAS_DEFAULT);
  const [modalCategorias, setModalCategorias] = useState(false);

  // Mapa de cores dinâmico
  const mapaCores = useMemo(() => {
    const mapa = {};
    categorias.forEach(c => { mapa[c.id] = c.cor; });
    return mapa;
  }, [categorias]);

  // Labels dinâmicos
  const mapaLabels = useMemo(() => {
    const mapa = {};
    categorias.forEach(c => { mapa[c.id] = c.label; });
    return mapa;
  }, [categorias]);

  // Navegação de mês feita pelo componente NavegacaoMes

  useEffect(() => {
    if (!usuario) {
      setGastos([]);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_variaveis');
    const q = query(
      colRef,
      where('mes', '==', mesAtual),
      where('ano', '==', anoAtual)
    );

    const unsubscribeGastos = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      setGastos(lista);
      setCarregando(false);
    }, (error) => {
      console.error('Erro ao carregar gastos:', error);
      setCarregando(false);
    });

    const unsubSaldos = onSnapshot(doc(db, 'usuarios', usuario.uid, 'saldos', 'atual'), (docSnap) => {
      if (docSnap.exists()) setSaldos(docSnap.data());
    });

    const unsubCartoes = onSnapshot(collection(db, 'usuarios', usuario.uid, 'cartoes'), (snap) => {
      setCartoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubFaturasPagas = onSnapshot(collection(db, 'usuarios', usuario.uid, 'faturas_pagas'), (snap) => {
      setFaturasPagas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubCategorias = onSnapshot(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'categorias_variaveis'), (snap) => {
      if (snap.exists() && snap.data().lista) {
        setCategorias(snap.data().lista);
      } else {
        setDoc(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'categorias_variaveis'), { lista: CATEGORIAS_DEFAULT });
      }
    });

    return () => {
      unsubscribeGastos();
      unsubSaldos();
      unsubCartoes();
      unsubFaturasPagas();
      unsubCategorias();
    };
  }, [usuario, mesAtual, anoAtual]);

  useEffect(() => {
    setFiltroCategoria('Todas');
  }, [mesAtual, anoAtual]);

  const gastosFiltrados = useMemo(() => {
    if (filtroCategoria === 'Todas') return gastos;
    return gastos.filter(g => g.categoria === filtroCategoria);
  }, [gastos, filtroCategoria]);

  const categoriasPresentes = useMemo(() => {
    const set = new Set(gastos.map(g => g.categoria));
    return categorias.filter(c => set.has(c.id)).map(c => c.label);
  }, [gastos, categorias]);

  const resumo = useMemo(() => {
    let total = 0;
    let totalEmpresa = 0;
    let totalPessoal = 0;
    let totalEsposa = 0;

    gastos.forEach(g => {
      const v = Number(g.valor);
      total += v;
      if (g.natureza === 'EMPRESA') totalEmpresa += v;
      else {
        totalPessoal += v;
        if (g.isEsposa) totalEsposa += v;
      }
    });

    const quantidade = gastos.length;
    return { total, quantidade, totalEmpresa, totalPessoal, totalEsposa };
  }, [gastos]);

  const dadosGrafico = useMemo(() => {
    const porCategoria = {};
    gastos.forEach(g => {
      const cat = g.categoria;
      porCategoria[cat] = (porCategoria[cat] || 0) + Number(g.valor);
    });
    return Object.entries(porCategoria)
      .map(([categoria, total]) => ({
        categoria,
        label: mapaLabels[categoria] || categoria,
        total,
        cor: mapaCores[categoria] || '#b2bec3'
      }))
      .sort((a, b) => b.total - a.total);
  }, [gastos, mapaCores, mapaLabels]);

  const top5 = useMemo(() => {
    return [...gastos]
      .sort((a, b) => Number(b.valor) - Number(a.valor))
      .slice(0, 5);
  }, [gastos]);

  const limparFormulario = () => {
    setDescricao('');
    setCategoria('');
    setValor('');
    setData(dataHojeISO());
    setObservacao('');
    setMetodoPagamento('');
    setCartaoId('');
    setIsCartaoTerceiro(false);
    setNomeCartaoTerceiro('');
    setParcelado(false);
    setTotalParcelas('');
    setNatureza('PESSOAL');
    setPessoaId(null);
    setPessoaNome('');
    setPessoaEmoji('');
    setEditandoId(null);
  };

  const iniciarEdicao = (gasto) => {
    setDescricao(gasto.descricao);
    setCategoria(gasto.categoria);
    setValor(String(gasto.valor));
    setData(gasto.data);
    setObservacao(gasto.observacao || '');
    setMetodoPagamento(gasto.metodoPagamento || '');
    setCartaoId(gasto.cartaoId || '');
    setIsCartaoTerceiro(gasto.isCartaoTerceiro || false);
    setNomeCartaoTerceiro(gasto.nomeCartaoTerceiro || '');
    setParcelado(!!gasto.parcelado);
    setTotalParcelas(gasto.totalParcelas ? String(gasto.totalParcelas) : '');
    setNatureza(gasto.natureza || 'PESSOAL');
    // Pessoa: usa pessoaId salvo; se for legado (só isEsposa), cai na 1ª pessoa cadastrada.
    if (gasto.pessoaId) {
      setPessoaId(gasto.pessoaId);
      setPessoaNome(gasto.pessoaNome || rotuloEsposa);
      setPessoaEmoji(gasto.pessoaEmoji || emojiEsposa);
    } else if (gasto.isEsposa) {
      const p = pessoasVinculadas[0];
      setPessoaId(p?.id || 'principal');
      setPessoaNome(p?.nome || rotuloEsposa);
      setPessoaEmoji(p?.emoji || emojiEsposa);
    } else {
      setPessoaId(null);
      setPessoaNome('');
      setPessoaEmoji('');
    }
    setEditandoId(gasto.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const salvarGasto = async (e) => {
    e.preventDefault();
    if (!descricao.trim() || !categoria || !valor || !data) return;

    setSalvando(true);

    const [anoData, mesData] = data.split('-').map(Number);

    const calcularFaturaRef = (data, diaFechamento) => {
      const [ano, mes, dia] = data.split('-').map(Number);
      let mesFatura = mes;
      let anoFatura = ano;
      if (dia > diaFechamento) {
        mesFatura += 1;
        if (mesFatura > 12) {
          mesFatura = 1;
          anoFatura += 1;
        }
      }
      return `${anoFatura}-${String(mesFatura).padStart(2, '0')}`;
    };

    let cartao = null;
    let baseFaturaRef = null;
    if (metodoPagamento === 'Cartão de Crédito' && cartaoId && !isCartaoTerceiro) {
      cartao = cartoes.find(c => c.id === cartaoId);
      if (cartao) {
        baseFaturaRef = calcularFaturaRef(data, cartao.diaFechamento);
      }
    }

    try {
      if (editandoId) {
        const dadosGasto = {
          descricao: descricao.trim(),
          categoria,
          valor: parseFloat(valor),
          data,
          observacao: observacao.trim(),
          metodoPagamento: metodoPagamento || null,
          cartaoId: metodoPagamento === 'Cartão de Crédito' ? (isCartaoTerceiro ? null : cartaoId) : null,
          isCartaoTerceiro: metodoPagamento === 'Cartão de Crédito' ? isCartaoTerceiro : false,
          nomeCartaoTerceiro: metodoPagamento === 'Cartão de Crédito' && isCartaoTerceiro ? nomeCartaoTerceiro : null,
          faturaRef: baseFaturaRef,
          mes: mesData - 1,
          ano: anoData,
          natureza,
          ...camposPessoa()
        };
        const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', editandoId);
        await updateDoc(docRef, dadosGasto);
      } else if (parcelado && totalParcelas && valor) {
        const nParcelas = parseInt(totalParcelas, 10);
        const vParcela = parseFloat(valor);
        const vTotal = vParcela * nParcelas;
        const grupoId = gerarGrupoId();
        const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_variaveis');

        let [baseAnoStr, baseMesStr] = baseFaturaRef ? baseFaturaRef.split('-') : [String(anoData), String(mesData)];
        let faturaAno = Number(baseAnoStr);
        let faturaMes = Number(baseMesStr);

        for (let i = 0; i < nParcelas; i++) {
          let parcelaMes = (mesData - 1) + i;
          let parcelaAno = anoData;
          while (parcelaMes > 11) {
            parcelaMes -= 12;
            parcelaAno += 1;
          }

          let calcFaturaMes = faturaMes + i;
          let calcFaturaAno = faturaAno;
          while (calcFaturaMes > 12) {
            calcFaturaMes -= 12;
            calcFaturaAno += 1;
          }
          const currFaturaRef = baseFaturaRef ? `${calcFaturaAno}-${String(calcFaturaMes).padStart(2, '0')}` : null;

          const diaOriginal = data.split('-')[2];
          const parcelaData = `${parcelaAno}-${String(parcelaMes + 1).padStart(2, '0')}-${diaOriginal}`;
          
          let ehPago = false;
          if (cartaoId && currFaturaRef) {
            const seloId = `${cartaoId}_${currFaturaRef}`;
            ehPago = faturasPagas.some(f => f.id === seloId && f.pago);
          }

          await addDoc(colRef, {
            descricao: descricao.trim(),
            categoria,
            valor: vParcela,
            valorTotal: vTotal,
            data: parcelaData,
            observacao: observacao.trim(),
            metodoPagamento: metodoPagamento || 'Cartão de Crédito',
            cartaoId: metodoPagamento === 'Cartão de Crédito' ? (isCartaoTerceiro ? null : cartaoId) : null,
            isCartaoTerceiro: metodoPagamento === 'Cartão de Crédito' ? isCartaoTerceiro : false,
            nomeCartaoTerceiro: metodoPagamento === 'Cartão de Crédito' && isCartaoTerceiro ? nomeCartaoTerceiro : null,
            faturaRef: currFaturaRef,
            mes: parcelaMes,
            ano: parcelaAno,
            parcelado: true,
            parcelaAtual: i + 1,
            totalParcelas: nParcelas,
            grupoParcelamento: grupoId,
            natureza,
            ...camposPessoa(),
            pago: ehPago
          });
        }
      } else {
        let ehPago = false;
        if (cartaoId && baseFaturaRef) {
          const seloId = `${cartaoId}_${baseFaturaRef}`;
          ehPago = faturasPagas.some(f => f.id === seloId && f.pago);
        }

        const dadosGasto = {
          descricao: descricao.trim(),
          categoria,
          valor: parseFloat(valor),
          data,
          observacao: observacao.trim(),
          metodoPagamento: metodoPagamento || null,
          cartaoId: metodoPagamento === 'Cartão de Crédito' ? (isCartaoTerceiro ? null : cartaoId) : null,
          isCartaoTerceiro: metodoPagamento === 'Cartão de Crédito' ? isCartaoTerceiro : false,
          nomeCartaoTerceiro: metodoPagamento === 'Cartão de Crédito' && isCartaoTerceiro ? nomeCartaoTerceiro : null,
          faturaRef: baseFaturaRef,
          mes: mesData - 1,
          ano: anoData,
          parcelado: false,
          natureza,
          ...camposPessoa(),
          pago: ehPago
        };
        const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_variaveis');
        await addDoc(colRef, dadosGasto);
      }

      limparFormulario();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSalvando(false);
    }
  };

  const excluirGasto = async (gasto) => {
    if (gasto.parcelado && gasto.grupoParcelamento) {
      setConfirmarExclusao(gasto);
    } else {
      await excluirGastoUnico(gasto.id);
    }
  };

  const excluirGastoUnico = async (id) => {
    try {
      const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', id);
      await deleteDoc(docRef);
      if (editandoId === id) limparFormulario();
    } catch (error) { console.error(error); }
  };

  const excluirTodasParcelas = async (grupoId) => {
    try {
      const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_variaveis');
      const q = query(colRef, where('grupoParcelamento', '==', grupoId));
      const snapshot = await getDocs(q);
      const batch = [];
      snapshot.forEach(docSnap => batch.push(deleteDoc(doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', docSnap.id))));
      await Promise.all(batch);
      limparFormulario();
    } catch (error) { console.error(error); }
  };

  const excluirParcelasRestantes = async (gasto) => {
    try {
      const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_variaveis');
      const q = query(colRef, where('grupoParcelamento', '==', gasto.grupoParcelamento));
      const snapshot = await getDocs(q);
      const batch = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d.parcelaAtual >= gasto.parcelaAtual) {
          batch.push(deleteDoc(doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', docSnap.id)));
        }
      });
      await Promise.all(batch);
      limparFormulario();
    } catch (error) { console.error(error); }
  };

  // ── Automação de Pagamentos ──
  const acionarPagamento = (gasto) => {
    if (gasto.pago) {
      if (window.confirm('Desfazer pagamento? Não devolverá o saldo ao Patrimônio automaticamente.')) {
        desfazerPagamento(gasto);
      }
      return;
    }
    setPagamentoModal(gasto);
  };

  const desfazerPagamento = async (gasto) => {
    const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', gasto.id);
    await updateDoc(docRef, { pago: false });
  };

  const confirmarPagamentoHandler = async (caixinhaFonte) => {
    if (!usuario || !pagamentoModal) return;
    const valorConta = Number(pagamentoModal.valor);
    
    const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', pagamentoModal.id);
    await updateDoc(docRef, { pago: true });

    if (caixinhaFonte !== 'NENHUMA') {
      await setDoc(doc(db, 'usuarios', usuario.uid, 'saldos', 'atual'), {
        [caixinhaFonte]: increment(-valorConta),
        atualizadoEm: serverTimestamp()
      }, { merge: true });

      await addDoc(collection(db, 'usuarios', usuario.uid, 'transacoes_patrimonio'), {
        caixinhaId: caixinhaFonte,
        caixinhaNome: nomeCaixinha(caixinhaFonte),
        tipo: 'SAIDA',
        valor: valorConta,
        motivo: `Pgto Variável: ${pagamentoModal.descricao}`,
        data: new Date().toISOString().split('T')[0],
        criadoEm: serverTimestamp()
      });
    }
    setPagamentoModal(null);
  };

  // ── Gerenciamento de Categorias ──
  const adicionarCategoria = async (nome, cor) => {
    if (!usuario) return;
    try {
      const novaCat = { id: nome, label: nome, cor };
      const novaLista = [...categorias, novaCat];
      await setDoc(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'categorias_variaveis'), { lista: novaLista }, { merge: true });
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar categoria.');
    }
  };

  const removerCategoria = async (catId) => {
    if (!usuario) return;
    if (window.confirm(`Tem certeza que deseja remover a categoria "${catId}"? (Suas despesas antigas continuarão funcionando)`)) {
      try {
        const novaLista = categorias.filter(c => c.id !== catId);
        await setDoc(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'categorias_variaveis'), { lista: novaLista }, { merge: true });
      } catch (err) {
        console.error(err);
        alert('Erro ao remover categoria.');
      }
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(18, 18, 26, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', backdropFilter: 'blur(10px)' }}>
          <p style={{ color: '#fff', margin: 0, fontSize: '13px', fontFamily: 'DM Sans' }}>{payload[0].payload.categoria}</p>
          <p style={{ color: '#00d4aa', margin: '4px 0 0', fontSize: '14px', fontWeight: 600, fontFamily: 'DM Sans' }}>{formatarMoeda(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 space-y-6 animate-fade-in">
      <NavegacaoMes
        mesAtual={mesAtual}
        anoAtual={anoAtual}
        setMesAtual={setMesAtual}
        setAnoAtual={setAnoAtual}
      />
      
      {/* CARD PRINCIPAL - TOTAL */}
      <div className="rounded-3xl border border-hawk-red/30 bg-gradient-to-br from-hawk-red/20 to-hawk-card/90 p-8 text-center shadow-card-hover relative overflow-hidden mb-6">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="relative z-10 flex flex-col items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-widest text-hawk-red mb-1">💸 Total do Mês:</span>
          <span className="text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,107,107,0.5)]">
            {formatarMoeda(resumo.total)}
          </span>
        </div>
      </div>

      {/* CARDS SECUNDÁRIOS */}
      <div className={`grid gap-4 mb-6 ${resumo.totalEsposa > 0 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-5 shadow-card flex flex-col items-center text-center hover:border-hawk-purple/30 transition-colors group">
          <div className="w-10 h-10 rounded-full bg-hawk-purple/10 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">🏢</div>
          <span className="text-[10px] font-bold text-hawk-muted uppercase tracking-wide mb-1">Empresa</span>
          <span className="text-lg font-bold text-hawk-purple">{formatarMoeda(resumo.totalEmpresa)}</span>
        </div>
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-5 shadow-card flex flex-col items-center text-center hover:border-hawk-blue/30 transition-colors group">
          <div className="w-10 h-10 rounded-full bg-hawk-blue/10 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">👤</div>
          <span className="text-[10px] font-bold text-hawk-muted uppercase tracking-wide mb-1">Pessoal</span>
          <span className="text-lg font-bold text-hawk-blue">{formatarMoeda(resumo.totalPessoal)}</span>
        </div>
        {resumo.totalEsposa > 0 && (
          <div className="rounded-2xl border border-hawk-pink/20 bg-hawk-card p-5 shadow-card flex flex-col items-center text-center hover:border-hawk-pink/40 transition-colors group">
            <div className="w-10 h-10 rounded-full bg-hawk-pink/10 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">{emojiEsposa}</div>
            <span className="text-[10px] font-bold text-hawk-muted uppercase tracking-wide mb-1">{rotuloEsposa}</span>
            <span className="text-lg font-bold text-hawk-pink">{formatarMoeda(resumo.totalEsposa)}</span>
            <span className="text-[9px] text-hawk-dim mt-0.5">incluído no Pessoal</span>
          </div>
        )}
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-5 shadow-card flex flex-col items-center text-center hover:border-hawk-green/30 transition-colors group">
          <div className="w-10 h-10 rounded-full bg-hawk-green/10 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">📊</div>
          <span className="text-[10px] font-bold text-hawk-muted uppercase tracking-wide mb-1">Quantidade</span>
          <span className="text-lg font-bold text-hawk-green">{resumo.quantidade}</span>
        </div>
      </div>

      <form className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card space-y-4" onSubmit={salvarGasto}>
        <h3 className="text-lg font-bold text-hawk-text flex items-center justify-between gap-2 border-b border-white/5 pb-3">
          <span className="flex items-center gap-2">{editandoId ? '✏️ Editar Gasto' : '➕ Novo Gasto Variável'}</span>
          <button
            type="button"
            onClick={() => setModalCategorias(true)}
            title="Gerenciar Categorias"
            className="flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-xl border border-white/10 bg-white/5 text-hawk-muted hover:text-hawk-text hover:bg-white/10 transition-colors flex items-center gap-1.5"
          >
            <span>⚙️</span> <span className="hidden sm:inline">Categorias</span>
          </button>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Descrição</label>
            <input 
              type="text" 
              className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors" 
              placeholder="Ex: Farmácia, Sapato..." 
              value={descricao} onChange={e => setDescricao(e.target.value)} required 
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Categoria</label>
            <select 
              className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors appearance-none" 
              value={categoria} onChange={e => setCategoria(e.target.value)} required
            >
              <option value="">Selecione...</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <SeletorNatureza
              natureza={natureza}
              setNatureza={setNatureza}
              pessoaId={pessoaId}
              onSelectPessoa={selecionarPessoa}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">💳 Método de Pagamento</label>
            <select 
              className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors appearance-none" 
              value={metodoPagamento} onChange={e => setMetodoPagamento(e.target.value)}
            >
              <option value="">Selecione...</option>
              {METODOS_PAGAMENTO.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {metodoPagamento === 'Cartão de Crédito' && (
            <div className="md:col-span-2 bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
              <label className="block text-xs font-bold text-hawk-text uppercase tracking-widest">Qual Cartão?</label>
              
              <div className="flex gap-3 items-center">
                <input 
                  type="checkbox" 
                  id="cartaoTerceiro" 
                  checked={isCartaoTerceiro} 
                  onChange={(e) => setIsCartaoTerceiro(e.target.checked)} 
                  className="w-5 h-5 accent-hawk-purple bg-hawk-input border-glass-border rounded focus:ring-hawk-purple/50"
                />
                <label htmlFor="cartaoTerceiro" className="text-sm cursor-pointer text-hawk-text">Usar cartão de terceiro (ex: Mãe, Cônjuge)</label>
              </div>

              {isCartaoTerceiro ? (
                <input 
                  type="text" 
                  className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors" 
                  placeholder="Nome do dono do cartão (Ex: Cartão da Mãe)" 
                  value={nomeCartaoTerceiro} 
                  onChange={e => setNomeCartaoTerceiro(e.target.value)} 
                  required 
                />
              ) : (
                <select 
                  className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors appearance-none" 
                  value={cartaoId} onChange={e => setCartaoId(e.target.value)} required={!isCartaoTerceiro}
                >
                  <option value="">Selecione um dos seus cartões...</option>
                  {cartoes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({c.bandeira})</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Data</label>
            <input 
              type="date" 
              className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors" 
              value={data} onChange={e => setData(e.target.value)} required 
            />
          </div>

          {!editandoId && (
            <div className="md:col-span-2 bg-hawk-bg/30 p-4 rounded-xl border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-hawk-text flex items-center gap-2">
                    💳 Compra Parcelada?
                  </span>
                  <span className="text-xs text-hawk-muted mt-0.5">
                    {parcelado ? 'Sim, criar parcelas' : 'Não, compra à vista'}
                  </span>
                </div>
                <button
                  type="button"
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${parcelado ? 'bg-hawk-purple' : 'bg-gray-600'}`}
                  onClick={() => setParcelado(!parcelado)}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${parcelado ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              
              {parcelado && (
                <div className="mt-3 bg-hawk-red/10 border-l-4 border-hawk-red p-3 rounded-r-lg text-xs text-hawk-red/90 font-medium">
                  <strong>Dica para compras antigas:</strong> Se você parcelou algo meses atrás (ex: comprou a TV em Janeiro) e está registrando agora, certifique-se de colocar a <strong>Data</strong> original da compra (ex: 15/01/2026). Assim, o aplicativo vai jogar as parcelas 1, 2, 3 nos meses passados corretamente nas faturas certas!
                </div>
              )}
            </div>
          )}

          {editandoId && (
            <div className="md:col-span-2 bg-hawk-bg/30 p-4 rounded-xl border border-white/5 flex items-center justify-between">
              <span className="font-bold text-sm text-hawk-text">📋 Já é uma parcela em andamento?</span>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${parcelado ? 'bg-hawk-purple' : 'bg-gray-600'}`}
                onClick={() => setParcelado(!parcelado)}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${parcelado ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {(parcelado && !editandoId) ? (
            <>
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-xs font-bold text-hawk-purple uppercase tracking-widest">💰 Valor de CADA Parcela (R$)</label>
                <input 
                  type="number" 
                  className="w-full bg-hawk-input border border-hawk-purple/30 rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors" 
                  step="0.01" min="0.01" placeholder="Ex: 50,00" value={valor} onChange={e => setValor(e.target.value)} required={parcelado} 
                />
              </div>
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-xs font-bold text-hawk-purple uppercase tracking-widest">🔢 Quantidade de Parcelas</label>
                <input 
                  type="number" 
                  className="w-full bg-hawk-input border border-hawk-purple/30 rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors" 
                  min="2" max="48" placeholder="Ex: 10" value={totalParcelas} onChange={e => setTotalParcelas(e.target.value)} required={parcelado} 
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Valor (R$)</label>
              <input 
                type="number" 
                className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors" 
                step="0.01" min="0.01" value={valor} onChange={e => setValor(e.target.value)} required 
              />
            </div>
          )}

          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Observação (opcional)</label>
            <input 
              type="text" 
              className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors" 
              value={observacao} onChange={e => setObservacao(e.target.value)} 
            />
          </div>

          <div className="md:col-span-2 flex gap-3 pt-4 border-t border-white/5">
            <button type="submit" className="flex-1 font-bold rounded-xl px-6 py-3 text-sm text-hawk-bg bg-hawk-red hover:bg-hawk-red/90 transition-all duration-200 active:scale-[0.98]" disabled={salvando}>
              {salvando ? 'Salvando...' : editandoId ? '💾 Salvar Alteração' : parcelado ? `💳 Criar ${totalParcelas || '?'}x Parcelas` : '➕ Adicionar Gasto'}
            </button>
            {editandoId && <button type="button" className="px-6 py-3 font-bold text-sm text-hawk-text bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors" onClick={limparFormulario}>Cancelar</button>}
          </div>
        </div>
      </form>

      {dadosGrafico.length > 0 && (
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card">
          <h3 className="text-lg font-bold text-hawk-text mb-4 border-b border-white/5 pb-3">📊 Total por Categoria</h3>
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer>
              <BarChart data={dadosGrafico} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: '#a0a0b8', fontSize: 11 }} angle={-45} textAnchor="end" interval={0} height={80} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#a0a0b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={50}>
                  {dadosGrafico.map((entry, index) => <Cell key={index} fill={entry.cor} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-hawk-text flex items-center gap-3 border-b border-white/5 pb-4">
          📋 Gastos de {MESES[mesAtual]}
        </h3>
        
        {carregando ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-hawk-purple border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : gastosFiltrados.length === 0 ? (
          <div className="text-center p-8 bg-hawk-card rounded-2xl border border-glass-border border-dashed">
            <p className="text-hawk-muted text-sm italic">Nenhum gasto registrado neste mês.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {gastosFiltrados.map(gasto => {
              let tagNaturezaCor = gasto.natureza === 'EMPRESA' ? '#a29bfe' : '#74b9ff';
              let tagNaturezaIcone = gasto.natureza === 'EMPRESA' ? '🏢' : '👤';
              if (gasto.isEsposa) { tagNaturezaCor = '#fd79a8'; tagNaturezaIcone = gasto.pessoaEmoji || emojiEsposa; }
              const tagPessoaNome = gasto.pessoaNome || rotuloEsposa;

              return (
                <div key={gasto.id} className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl border transition-all duration-300 ${gasto.pago ? 'bg-hawk-green/5 border-hawk-green/20' : 'bg-hawk-card border-glass-border hover:border-hawk-purple/30 shadow-card'}`}>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-start md:items-center justify-between md:justify-start gap-3">
                      <div className="flex flex-col md:flex-row md:items-center gap-2">
                        <span className="text-xs text-hawk-muted font-medium bg-black/20 px-2 py-0.5 rounded border border-white/5">{formatarData(gasto.data)}</span>
                        <span className={`font-bold text-base flex items-center gap-2 ${gasto.pago ? 'text-hawk-muted line-through' : 'text-hawk-text'}`}>
                          {gasto.descricao}
                          {gasto.parcelado && <span className="bg-hawk-purple/20 text-hawk-purple border border-hawk-purple/30 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider leading-none">{gasto.parcelaAtual}/{gasto.totalParcelas}</span>}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#111]" style={{ background: mapaCores[gasto.categoria] || '#b2bec3' }}>
                        {mapaLabels[gasto.categoria] || gasto.categoria}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#111] flex items-center gap-1" style={{ backgroundColor: tagNaturezaCor }}>
                        <span>{tagNaturezaIcone}</span> {gasto.natureza === 'EMPRESA' ? 'Empresa' : (gasto.isEsposa ? tagPessoaNome : 'Pessoal')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-4">
                    <div className="flex flex-col items-end">
                      <span className={`font-black tracking-tight text-lg ${gasto.pago ? 'text-hawk-muted' : 'text-hawk-red'}`}>
                        {formatarMoeda(gasto.valor)}
                      </span>
                      {gasto.pago ? (
                        <div className="text-[10px] text-hawk-green font-bold flex items-center gap-1"><span>✅</span> Pago</div>
                      ) : (
                        <div className="text-[10px] text-hawk-red font-medium">Pendente</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className={`w-10 h-10 rounded-xl font-bold text-sm transition-all active:scale-95 border flex items-center justify-center ${gasto.pago ? 'bg-hawk-input border-hawk-green/30 text-hawk-green hover:bg-hawk-green/10' : 'bg-hawk-green/10 border-hawk-green/30 text-hawk-green hover:bg-hawk-green/20'}`}
                        onClick={() => acionarPagamento(gasto)}
                        title={gasto.pago ? 'Desfazer Pagamento' : 'Pagar com Automação'}
                      >
                        {gasto.pago ? '↩' : '✓'}
                      </button>
                      <button 
                        className="w-10 h-10 rounded-xl bg-white/5 text-hawk-blue border border-white/10 flex items-center justify-center transition-colors hover:bg-hawk-blue/10 active:scale-95" 
                        onClick={() => iniciarEdicao(gasto)} 
                        title="Editar"
                      >
                        ✎
                      </button>
                      <button 
                        className="w-10 h-10 rounded-xl bg-white/5 text-hawk-red border border-white/10 flex items-center justify-center transition-colors hover:bg-hawk-red/10 active:scale-95" 
                        onClick={() => excluirGasto(gasto)} 
                        title="Excluir"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirmarExclusao && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 animate-fade-in" onClick={() => setConfirmarExclusao(null)}>
          <div className="bg-hawk-card w-full max-w-md rounded-2xl p-6 shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
              <span>🗑️</span> Excluir Parcela
            </h3>
            <p className="text-sm text-hawk-muted mb-6">
              <strong className="text-white">{confirmarExclusao.descricao}</strong> — Parcela {confirmarExclusao.parcelaAtual}/{confirmarExclusao.totalParcelas}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-hawk-text" 
                onClick={async () => { await excluirGastoUnico(confirmarExclusao.id); setConfirmarExclusao(null); }}
              >
                Excluir Apenas Esta Parcela
              </button>
              <button 
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-hawk-blue/10 border border-hawk-blue/30 hover:bg-hawk-blue/20 transition-colors text-hawk-blue" 
                onClick={async () => { await excluirParcelasRestantes(confirmarExclusao); setConfirmarExclusao(null); }}
              >
                Excluir Esta e as Seguintes
              </button>
              <button 
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-hawk-red/10 border border-hawk-red/30 hover:bg-hawk-red/20 transition-colors text-hawk-red" 
                onClick={async () => { await excluirTodasParcelas(confirmarExclusao.grupoParcelamento); setConfirmarExclusao(null); }}
              >
                Excluir Todas as Parcelas
              </button>
              <button 
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-hawk-purple hover:bg-hawk-purple/90 transition-colors text-hawk-bg mt-2" 
                onClick={() => setConfirmarExclusao(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {pagamentoModal && (
        <ModalPagamento
          despesa={pagamentoModal}
          saldos={saldos}
          onConfirmar={confirmarPagamentoHandler}
          onFechar={() => setPagamentoModal(null)}
        />
      )}

      {/* MODAL GERENCIAR CATEGORIAS */}
      {modalCategorias && (
        <ModalCategorias
          titulo="Variáveis"
          categorias={categorias}
          onAdicionar={adicionarCategoria}
          onRemover={removerCategoria}
          onFechar={() => setModalCategorias(false)}
        />
      )}
    </div>
  );
}
