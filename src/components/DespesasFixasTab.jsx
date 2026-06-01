import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  setDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { formatarMoeda, chaveMes, despesaAtivaNoPeriodo, MESES, nomeCaixinha } from '../utils/helpers';
import NavegacaoMes from './NavegacaoMes';
import SeletorNatureza from './SeletorNatureza';
import ModalPagamento from './ModalPagamento';
import ModalCategorias from './ModalCategorias';
import { usePreferencias } from '../contexts/PreferenciasContext';

const CATEGORIAS_DEFAULT = [
  { id: 'Aluguel / Financiamento', label: '🏠 Aluguel / Financ.', cor: '#ff6b6b' },
  { id: 'Energia Elétrica', label: '⚡ Energia', cor: '#ffd93d' },
  { id: 'Água', label: '💧 Água', cor: '#00d4aa' },
  { id: 'Internet', label: '🌐 Internet', cor: '#6c5ce7' },
  { id: 'Celular', label: '📱 Celular', cor: '#a29bfe' },
  { id: 'Plano de Saúde', label: '🏥 Saúde', cor: '#fd79a8' },
  { id: 'Seguro', label: '🛡️ Seguro', cor: '#00b894' },
  { id: 'Streaming', label: '📺 Streaming', cor: '#e17055' },
  { id: 'Academia', label: '🏋️ Academia', cor: '#0984e3' },
  { id: 'Escola / Curso', label: '📚 Escola', cor: '#fdcb6e' },
  { id: 'Condomínio', label: '🏢 Condomínio', cor: '#636e72' },
  { id: 'Outros', label: '📦 Outros', cor: '#b2bec3' },
  { id: 'Apps / Ferramentas', label: '🤖 Apps / Ferramentas', cor: '#00cec9' }
];

const formInicial = {
  descricao: '',
  categoria: '',
  valor: '',
  vencimento: '',
  recorrente: true,
  mesFim: '',
  anoFim: '',
  natureza: 'PESSOAL',
  isEsposa: false,
  pessoaId: null,
  pessoaNome: '',
  pessoaEmoji: '',
  cartaoId: ''
};

function renderLabelPie({ name, percent }) {
  if (percent < 0.03) return null;
  return `${(percent * 100).toFixed(0)}%`;
}

export default function DespesasFixasTab() {
  const { usuario } = useAuth();
  const { rotuloEsposa, emojiEsposa, pessoasVinculadas } = usePreferencias();

  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());
  const [filtroNatureza, setFiltroNatureza] = useState('TODOS');

  const [todasDespesas, setTodasDespesas] = useState([]);
  const [saldos, setSaldos] = useState({});
  const [cartoes, setCartoes] = useState([]);
  const [faturasPagas, setFaturasPagas] = useState([]);
  const [form, setForm] = useState(formInicial);
  const [editandoId, setEditandoId] = useState(null);

  // Estados Modal Pagamento
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

  useEffect(() => {
    if (!usuario) return;

    // Snapshot Despesas Fixas
    const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_fixas');
    const unsubscribeDespesas = onSnapshot(colRef, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => (a.vencimento || 32) - (b.vencimento || 32));
      setTodasDespesas(lista);
    });

    // Snapshot Saldos
    const unsubSaldos = onSnapshot(doc(db, 'usuarios', usuario.uid, 'saldos', 'atual'), (docSnap) => {
      if (docSnap.exists()) {
        setSaldos(docSnap.data());
      }
    });

    // Snapshot Cartões
    const unsubCartoes = onSnapshot(collection(db, 'usuarios', usuario.uid, 'cartoes'), (snap) => {
      setCartoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Snapshot Categorias Fixas
    const unsubCategorias = onSnapshot(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'categorias_fixas'), (snap) => {
      if (snap.exists() && snap.data().lista) {
        setCategorias(snap.data().lista);
      } else {
        // Se não existir, salva os padrões no banco para o usuário poder editar depois
        setDoc(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'categorias_fixas'), { lista: CATEGORIAS_DEFAULT });
      }
    });

    // Snapshot Faturas Pagas
    const unsubFaturasPagas = onSnapshot(collection(db, 'usuarios', usuario.uid, 'faturas_pagas'), (snap) => {
      setFaturasPagas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeDespesas();
      unsubSaldos();
      unsubCartoes();
      unsubCategorias();
      unsubFaturasPagas();
    };
  }, [usuario]);

  const despesasDoMes = useMemo(() => {
    return todasDespesas.filter(d => despesaAtivaNoPeriodo(d, mesAtual, anoAtual));
  }, [todasDespesas, mesAtual, anoAtual]);

  const despesasExibidas = useMemo(() => {
    if (filtroNatureza === 'TODOS') return despesasDoMes;
    if (filtroNatureza === 'PESSOAL') {
      return despesasDoMes.filter(d => d.natureza === 'PESSOAL' || !d.natureza);
    }
    return despesasDoMes.filter(d => d.natureza === filtroNatureza);
  }, [despesasDoMes, filtroNatureza]);

  const isPago = useCallback((despesa) => {
    const chave = chaveMes(mesAtual, anoAtual);
    // Sistema novo: pagoPorMes é um mapa { "2026-04": true, ... }
    // Se o campo existir (mesmo que vazio {}), usamos SOMENTE ele.
    if (despesa.pagoPorMes != null && typeof despesa.pagoPorMes === 'object') {
      return !!despesa.pagoPorMes[chave];
    }
    // Fallback legado (despesas criadas antes da refatoração que não têm pagoPorMes)
    if (despesa.pago === true && despesa.mes === mesAtual && despesa.ano === anoAtual) {
      return true;
    }
    return false;
  }, [mesAtual, anoAtual]);

  const { total, pago, pendente, totalEmpresa, totalPessoal, totalEsposa } = useMemo(() => {
    let t = 0;
    let p = 0;
    let emp = 0;
    let pes = 0;
    let esp = 0;
    despesasDoMes.forEach((d) => {
      const val = Number(d.valor);
      t += val;
      if (isPago(d)) p += val;
      if (d.natureza === 'EMPRESA') emp += val;
      else {
        pes += val;
        if (d.isEsposa) esp += val;
      }
    });
    return { total: t, pago: p, pendente: t - p, totalEmpresa: emp, totalPessoal: pes, totalEsposa: esp };
  }, [despesasDoMes, isPago]);

  const dadosGrafico = useMemo(() => {
    const mapa = {};
    despesasDoMes.forEach((d) => {
      if (!mapa[d.categoria]) mapa[d.categoria] = 0;
      mapa[d.categoria] += Number(d.valor);
    });
    return Object.entries(mapa).map(([name, value]) => ({ name, value }));
  }, [despesasDoMes]);

  // Navegação de mês agora é feita pelo componente NavegacaoMes

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function cancelarEdicao() {
    setForm(formInicial);
    setEditandoId(null);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!usuario) return;
    if (!form.descricao.trim() || !form.categoria || !form.valor) return;

    const dados = {
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      valor: Number(form.valor),
      vencimento: form.vencimento ? Number(form.vencimento) : null,
      recorrente: form.recorrente,
      natureza: form.natureza,
      isEsposa: !!form.pessoaId,
      pessoaId: form.pessoaId || null,
      pessoaNome: form.pessoaNome || '',
      pessoaEmoji: form.pessoaEmoji || '',
      cartaoId: form.cartaoId || null
    };

    if (!form.recorrente) {
      dados.mesFim = null;
      dados.anoFim = null;
    } else if (form.mesFim !== '' && form.anoFim !== '') {
      dados.mesFim = Number(form.mesFim);
      dados.anoFim = Number(form.anoFim);
    } else {
      dados.mesFim = null;
      dados.anoFim = null;
    }

    try {
      if (editandoId) {
        const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_fixas', editandoId);
        await updateDoc(docRef, dados);
      } else {
        dados.mesInicio = mesAtual;
        dados.anoInicio = anoAtual;
        dados.mes = mesAtual;
        dados.ano = anoAtual;
        dados.pago = false;
        
        let pagoPorMesInicial = {};
        if (dados.cartaoId) {
          const chaveAtual = chaveMes(mesAtual, anoAtual);
          const seloId = `${dados.cartaoId}_${chaveAtual}`;
          const faturaJaPaga = faturasPagas.some(f => f.id === seloId && f.pago);
          if (faturaJaPaga) {
             pagoPorMesInicial[chaveAtual] = true;
          }
        }
        dados.pagoPorMes = pagoPorMesInicial;

        const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_fixas');
        await addDoc(colRef, dados);
      }
      cancelarEdicao();
    } catch (err) {
      console.error('Erro ao salvar despesa:', err);
    }
  }

  function iniciarEdicao(despesa) {
    setForm({
      descricao: despesa.descricao,
      categoria: despesa.categoria,
      valor: despesa.valor,
      vencimento: despesa.vencimento ?? '',
      recorrente: despesa.recorrente !== false,
      mesFim: despesa.mesFim ?? '',
      anoFim: despesa.anoFim ?? '',
      natureza: despesa.natureza || 'PESSOAL',
      // Pessoa: usa pessoaId salvo; legado (só isEsposa) cai na 1ª pessoa cadastrada.
      ...(despesa.pessoaId
        ? { pessoaId: despesa.pessoaId, pessoaNome: despesa.pessoaNome || rotuloEsposa, pessoaEmoji: despesa.pessoaEmoji || emojiEsposa }
        : despesa.isEsposa
        ? { pessoaId: pessoasVinculadas[0]?.id || 'principal', pessoaNome: pessoasVinculadas[0]?.nome || rotuloEsposa, pessoaEmoji: pessoasVinculadas[0]?.emoji || emojiEsposa }
        : { pessoaId: null, pessoaNome: '', pessoaEmoji: '' }),
      cartaoId: despesa.cartaoId || ''
    });
    setEditandoId(despesa.id);
  }

  async function excluir(id) {
    if (!usuario) return;
    try {
      const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_fixas', id);
      await deleteDoc(docRef);
      if (editandoId === id) cancelarEdicao();
    } catch (err) {
      console.error('Erro ao excluir despesa:', err);
    }
  }

  // ── Inteligência de Pagamentos ──
  const acionarPagamento = (despesa) => {
    const jaPago = isPago(despesa);
    if (jaPago) {
      if (window.confirm('Desfazer pagamento? Isso não devolverá o dinheiro automaticamente para a caixinha do Patrimônio, apenas marcará como pendente.')) {
         desfazerPagamento(despesa);
      }
      return;
    }
    setPagamentoModal(despesa);
  };

  const desfazerPagamento = async (despesa) => {
    const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_fixas', despesa.id);
    const chave = chaveMes(mesAtual, anoAtual);
    const pagoPorMesAtualizado = { ...(despesa.pagoPorMes || {}) };
    pagoPorMesAtualizado[chave] = false;
    await updateDoc(docRef, { pagoPorMes: pagoPorMesAtualizado });
  };

  const confirmarPagamentoHandler = async (caixinhaFonte) => {
    if (!usuario || !pagamentoModal) return;
    const valorConta = Number(pagamentoModal.valor);
    
    // 1. Dar baixa na Despesa
    const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_fixas', pagamentoModal.id);
    const chave = chaveMes(mesAtual, anoAtual);
    const pagoPorMesAtualizado = { ...(pagamentoModal.pagoPorMes || {}) };
    pagoPorMesAtualizado[chave] = true;
    await updateDoc(docRef, { pagoPorMes: pagoPorMesAtualizado });

    // 2. Se for uma caixinha válida, subtrai
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
        motivo: `Pgto Fixa: ${pagamentoModal.descricao}`,
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
      await setDoc(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'categorias_fixas'), { lista: novaLista }, { merge: true });
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
        await setDoc(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'categorias_fixas'), { lista: novaLista }, { merge: true });
      } catch (err) {
        console.error(err);
        alert('Erro ao remover categoria.');
      }
    }
  };

  function TooltipGrafico({ active, payload }) {
    if (!active || !payload || !payload.length) return null;
    const { name, value } = payload[0];
    return (
      <div className="chart-tooltip">
        <p style={{ color: payload[0].payload.fill || '#fff', fontWeight: 600 }}>{name}</p>
        <p>{formatarMoeda(value)}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 space-y-6 animate-fade-in">
      {/* ── Month Navigation ── */}
      <NavegacaoMes
        mesAtual={mesAtual}
        anoAtual={anoAtual}
        setMesAtual={setMesAtual}
        setAnoAtual={setAnoAtual}
        onMudouMes={cancelarEdicao}
      />

      {/* CARD PRINCIPAL - TOTAL */}
      <div className="rounded-3xl border border-hawk-purple/30 bg-gradient-to-br from-hawk-purple/20 to-hawk-card/90 p-8 text-center shadow-card-hover relative overflow-hidden mb-6">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="relative z-10 flex flex-col items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-widest text-hawk-purple mb-1">💸 Total Fixo:</span>
          <span className="text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(108,92,231,0.5)]">
            {formatarMoeda(total)}
          </span>
        </div>
      </div>

      {/* CARDS SECUNDÁRIOS */}
      <div className={`grid gap-4 mb-6 ${totalEsposa > 0 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-5 shadow-card flex flex-col items-center text-center hover:border-hawk-purple/30 transition-colors group">
          <div className="w-10 h-10 rounded-full bg-hawk-purple/10 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">🏢</div>
          <span className="text-[10px] font-bold text-hawk-muted uppercase tracking-wide mb-1">Empresa</span>
          <span className="text-lg font-bold text-hawk-purple">{formatarMoeda(totalEmpresa)}</span>
        </div>
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-5 shadow-card flex flex-col items-center text-center hover:border-hawk-blue/30 transition-colors group">
          <div className="w-10 h-10 rounded-full bg-hawk-blue/10 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">👤</div>
          <span className="text-[10px] font-bold text-hawk-muted uppercase tracking-wide mb-1">Pessoal</span>
          <span className="text-lg font-bold text-hawk-blue">{formatarMoeda(totalPessoal)}</span>
        </div>
        {totalEsposa > 0 && (
          <div className="rounded-2xl border border-hawk-pink/20 bg-hawk-card p-5 shadow-card flex flex-col items-center text-center hover:border-hawk-pink/40 transition-colors group">
            <div className="w-10 h-10 rounded-full bg-hawk-pink/10 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">{emojiEsposa}</div>
            <span className="text-[10px] font-bold text-hawk-muted uppercase tracking-wide mb-1">{rotuloEsposa}</span>
            <span className="text-lg font-bold text-hawk-pink">{formatarMoeda(totalEsposa)}</span>
            <span className="text-[9px] text-hawk-dim mt-0.5">incluído no Pessoal</span>
          </div>
        )}
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-5 shadow-card flex flex-col items-center text-center hover:border-hawk-green/30 transition-colors group">
          <div className="w-10 h-10 rounded-full bg-hawk-green/10 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">✅</div>
          <span className="text-[10px] font-bold text-hawk-muted uppercase tracking-wide mb-1">Pago</span>
          <span className="text-lg font-bold text-hawk-green">{formatarMoeda(pago)}</span>
        </div>
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-5 shadow-card flex flex-col items-center text-center hover:border-hawk-red/30 transition-colors group">
          <div className="w-10 h-10 rounded-full bg-hawk-red/10 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform">⚠️</div>
          <span className="text-[10px] font-bold text-hawk-muted uppercase tracking-wide mb-1">Pendente</span>
          <span className="text-lg font-bold text-hawk-red">{formatarMoeda(pendente)}</span>
        </div>
      </div>

      <form className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card space-y-4" onSubmit={salvar}>
        <h3 className="text-lg font-bold text-hawk-text flex items-center justify-between gap-2 border-b border-white/5 pb-3">
          <span className="flex items-center gap-2">{editandoId ? '✏️ Editar Despesa' : '➕ Nova Despesa Fixa'}</span>
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
            <label htmlFor="descricao" className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Descrição</label>
            <input
              id="descricao" name="descricao" type="text"
              placeholder="Ex: Seguro, Academia..."
              value={form.descricao} onChange={handleChange} required
              className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="valor" className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Valor (R$)</label>
            <input
              id="valor" name="valor" type="number" min="0" step="0.01"
              placeholder="0,00" value={form.valor} onChange={handleChange} required
              className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="vencimento" className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Dia de Vencimento</label>
            <input
              id="vencimento" name="vencimento" type="number" min="1" max="31"
              placeholder="1–31" value={form.vencimento} onChange={handleChange}
              className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="categoria" className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Categoria Base</label>
            <select
              id="categoria" name="categoria"
              value={form.categoria} onChange={handleChange} required
              className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors appearance-none"
            >
              <option value="">Selecione...</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="cartaoId" className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">💳 Vinculado ao Cartão (opcional)</label>
            <select
              id="cartaoId" name="cartaoId"
              value={form.cartaoId} onChange={handleChange}
              className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors appearance-none"
            >
              <option value="">Nenhum (pagamento por fora, Pix, boleto)</option>
              {cartoes.map(c => (
                <option key={c.id} value={c.id}>{c.nome} ({c.bandeira})</option>
              ))}
            </select>
            <p className="text-[10px] text-hawk-muted mt-1">
              Se selecionado, essa assinatura será cobrada na fatura deste cartão todo mês.
            </p>
          </div>

          <div className="md:col-span-2">
            <SeletorNatureza
              natureza={form.natureza}
              setNatureza={(n) => setForm({...form, natureza: n})}
              pessoaId={form.pessoaId}
              onSelectPessoa={(p) => setForm({
                ...form,
                pessoaId: p ? p.id : null,
                pessoaNome: p ? p.nome : '',
                pessoaEmoji: p ? p.emoji : '',
              })}
            />
          </div>

          <div className="md:col-span-2 bg-hawk-bg/30 p-4 rounded-xl border border-white/5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm text-hawk-text flex items-center gap-2">
                🔁 Conta Recorrente
              </span>
              <span className="text-xs text-hawk-muted mt-0.5">
                {form.recorrente ? 'Aparece todo mês' : 'Apenas neste mês'}
              </span>
            </div>
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.recorrente ? 'bg-hawk-purple' : 'bg-gray-600'}`}
              onClick={() => setForm(prev => ({ ...prev, recorrente: !prev.recorrente }))}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.recorrente ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {form.recorrente && (
            <div className="md:col-span-2 space-y-1.5 p-4 rounded-xl border border-hawk-purple/20 bg-hawk-purple/5 animate-fade-in">
              <label className="block text-xs font-bold text-hawk-purple uppercase tracking-widest">📅 Vigência Final (opcional)</label>
              <div className="flex gap-2">
                <select name="mesFim" value={form.mesFim} onChange={handleChange} className="flex-1 bg-hawk-input border border-hawk-purple/30 rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 appearance-none">
                  <option value="">Mês...</option>
                  {MESES.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
                <input name="anoFim" type="number" min="2024" max="2040" placeholder="Ano" value={form.anoFim} onChange={handleChange} className="w-24 bg-hawk-input border border-hawk-purple/30 rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 text-center" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t border-white/5">
          <button type="submit" className="flex-1 font-bold rounded-xl px-6 py-3 text-sm text-hawk-bg bg-hawk-purple hover:bg-hawk-purple/90 transition-all duration-200 active:scale-[0.98]">
            {editandoId ? 'Salvar Alteração' : 'Adicionar Despesa'}
          </button>
          {editandoId && (
            <button type="button" className="px-6 py-3 font-bold text-sm text-hawk-text bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors" onClick={cancelarEdicao}>Cancelar</button>
          )}
        </div>
      </form>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
          <h3 className="text-xl font-bold text-hawk-text flex items-center gap-3">
            Despesas de {MESES[mesAtual]} {anoAtual}
            <span className="bg-white/10 text-hawk-text px-2.5 py-0.5 rounded-full text-xs font-bold">{despesasExibidas.length}</span>
          </h3>
          
          <div className="flex bg-hawk-input p-1 rounded-xl border border-glass-border">
            <button 
              type="button" 
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filtroNatureza === 'TODOS' ? 'bg-hawk-card text-hawk-text shadow' : 'text-hawk-muted hover:text-hawk-text'}`} 
              onClick={() => setFiltroNatureza('TODOS')}
            >
              Todas
            </button>
            <button 
              type="button" 
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${filtroNatureza === 'EMPRESA' ? 'bg-hawk-card text-hawk-purple shadow' : 'text-hawk-muted hover:text-hawk-text'}`} 
              onClick={() => setFiltroNatureza('EMPRESA')}
            >
              <span>🏢</span> Empresa
            </button>
            <button 
              type="button" 
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${filtroNatureza === 'PESSOAL' ? 'bg-hawk-card text-hawk-blue shadow' : 'text-hawk-muted hover:text-hawk-text'}`} 
              onClick={() => setFiltroNatureza('PESSOAL')}
            >
              <span>👤</span> Pessoal
            </button>
          </div>
        </div>

        {despesasExibidas.length === 0 && (
          <div className="text-center p-8 bg-hawk-card rounded-2xl border border-glass-border border-dashed">
            <p className="text-hawk-muted text-sm italic">Nenhuma despesa registrada para este filtro neste mês.</p>
          </div>
        )}

        <div className="grid gap-3">
          {despesasExibidas.map((d) => {
            const pago = isPago(d);
            const isRecorrente = d.recorrente !== false;
            
            let tagNaturezaCor = d.natureza === 'EMPRESA' ? '#a29bfe' : '#74b9ff';
            let tagNaturezaIcone = d.natureza === 'EMPRESA' ? '🏢' : '👤';
            if (d.isEsposa) { tagNaturezaCor = '#fd79a8'; tagNaturezaIcone = d.pessoaEmoji || emojiEsposa; }
            const tagPessoaNome = d.pessoaNome || rotuloEsposa;

            return (
              <div key={d.id} className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl border transition-all duration-300 ${pago ? 'bg-hawk-green/5 border-hawk-green/20' : 'bg-hawk-card border-glass-border hover:border-hawk-purple/30 shadow-card'}`}>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-start md:items-center justify-between md:justify-start gap-3">
                    <span className="font-bold text-hawk-text text-base flex items-center gap-2">
                      {d.descricao}
                      {isRecorrente && <span title="Conta recorrente" className="text-xs opacity-70">🔁</span>}
                    </span>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#111]" style={{ backgroundColor: mapaCores[d.categoria] || '#b2bec3' }}>
                        {mapaLabels[d.categoria] || d.categoria}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#111] flex items-center gap-1" style={{ backgroundColor: tagNaturezaCor }}>
                        <span>{tagNaturezaIcone}</span> {d.natureza === 'EMPRESA' ? 'Empresa' : (d.isEsposa ? tagPessoaNome : 'Pessoal')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-black tracking-tight" style={{ color: pago ? '#00d4aa' : '#fff' }}>{formatarMoeda(d.valor)}</span>
                    {d.vencimento && (
                      <span className="text-hawk-muted text-xs">Vence dia {d.vencimento}</span>
                    )}
                    {pago ? (
                      <span className="px-2 py-0.5 bg-hawk-green/20 text-hawk-green rounded font-bold text-[10px] border border-hawk-green/30">Pago</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-hawk-red/20 text-hawk-red rounded font-bold text-[10px] border border-hawk-red/30">Pendente</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-4">
                  <button
                    className={`flex-1 md:flex-none flex items-center justify-center h-10 px-4 rounded-xl font-bold text-sm transition-all active:scale-95 border ${pago ? 'bg-hawk-input border-hawk-green/30 text-hawk-green hover:bg-hawk-green/10' : 'bg-hawk-green/10 border-hawk-green/30 text-hawk-green hover:bg-hawk-green/20'}`}
                    onClick={() => acionarPagamento(d)}
                    title={pago ? 'Desfazer Pagamento' : 'Pagar com Automação'}
                  >
                    {pago ? '↩ Desfazer' : '✓ Pagar'}
                  </button>
                  <button 
                    className="w-10 h-10 rounded-xl bg-white/5 text-hawk-blue border border-white/10 flex items-center justify-center transition-colors hover:bg-hawk-blue/10 active:scale-95" 
                    onClick={() => iniciarEdicao(d)} 
                    title="Editar"
                  >
                    ✎
                  </button>
                  <button 
                    className="w-10 h-10 rounded-xl bg-white/5 text-hawk-red border border-white/10 flex items-center justify-center transition-colors hover:bg-hawk-red/10 active:scale-95" 
                    onClick={() => excluir(d.id)} 
                    title="Excluir"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {dadosGrafico.length > 0 && (
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card">
          <h3 className="text-lg font-bold text-hawk-text mb-4 border-b border-white/5 pb-3">Distribuição por Categoria</h3>
          <ResponsiveContainer width="100%" height={360}>
            <PieChart>
              <Pie data={dadosGrafico} cx="50%" cy="50%" outerRadius={120} innerRadius={50} dataKey="value" label={renderLabelPie} labelLine={false} paddingAngle={2} strokeWidth={0}>
                {dadosGrafico.map((entry) => (
                  <Cell key={entry.name} fill={mapaCores[entry.name] || '#b2bec3'} />
                ))}
              </Pie>
              <Tooltip content={<TooltipGrafico />} />
              <Legend verticalAlign="bottom" iconType="circle" formatter={(value) => <span style={{ color: '#e0e0e0', fontSize: '0.82rem' }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* MODAL INTELIGENTE DE PAGAMENTO */}
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
          titulo="Fixas"
          categorias={categorias}
          onAdicionar={adicionarCategoria}
          onRemover={removerCategoria}
          onFechar={() => setModalCategorias(false)}
        />
      )}
    </div>
  );
}
