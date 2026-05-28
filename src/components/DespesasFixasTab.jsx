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
  cartaoId: ''
};

function renderLabelPie({ name, percent }) {
  if (percent < 0.03) return null;
  return `${(percent * 100).toFixed(0)}%`;
}

export default function DespesasFixasTab() {
  const { usuario } = useAuth();

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

  const { total, pago, pendente, totalEmpresa, totalPessoal } = useMemo(() => {
    let t = 0;
    let p = 0;
    let emp = 0;
    let pes = 0;
    despesasDoMes.forEach((d) => {
      const val = Number(d.valor);
      t += val;
      if (isPago(d)) p += val;
      if (d.natureza === 'EMPRESA') emp += val;
      else pes += val;
    });
    return { total: t, pago: p, pendente: t - p, totalEmpresa: emp, totalPessoal: pes };
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
      isEsposa: form.isEsposa,
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
      isEsposa: despesa.isEsposa || false,
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
    <div className="tab-content">
      {/* ── Month Navigation ── */}
      <NavegacaoMes
        mesAtual={mesAtual}
        anoAtual={anoAtual}
        setMesAtual={setMesAtual}
        setAnoAtual={setAnoAtual}
        onMudouMes={cancelarEdicao}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn-sm" onClick={() => setModalCategorias(true)} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
          ⚙️ Gerenciar Categorias
        </button>
      </div>

      {/* CARD PRINCIPAL - TOTAL */}
      <div style={{ marginBottom: '16px' }}>
        <div className="metric-card" style={{ padding: '24px', justifyContent: 'center', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)' }} />
          <div className="metric-card-icon" style={{ width: '56px', height: '56px', fontSize: '1.8rem' }}>💸</div>
          <span className="metric-card-label" style={{ fontSize: '1.1rem', margin: 0 }}>Total Fixo:</span>
          <span className="metric-card-value" style={{ fontSize: 'clamp(1.5rem, 5vw, 2.2rem)', color: '#a29bfe' }}>{formatarMoeda(total)}</span>
        </div>
      </div>

      {/* CARDS SECUNDÁRIOS */}
      <div className="metric-cards-grid">
        <div className="metric-card">
          <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)' }} />
          <div className="metric-card-icon">🏢</div>
          <div className="metric-card-body">
            <span className="metric-card-label">Empresa</span>
            <span className="metric-card-value" style={{ color: '#a29bfe' }}>{formatarMoeda(totalEmpresa)}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #74b9ff, #0984e3)' }} />
          <div className="metric-card-icon">👤</div>
          <div className="metric-card-body">
            <span className="metric-card-label">Pessoal</span>
            <span className="metric-card-value" style={{ color: '#74b9ff' }}>{formatarMoeda(totalPessoal)}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #00d4aa, #00b894)' }} />
          <div className="metric-card-icon">✅</div>
          <div className="metric-card-body">
            <span className="metric-card-label">Pago</span>
            <span className="metric-card-value" style={{ color: '#00d4aa' }}>{formatarMoeda(pago)}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)' }} />
          <div className="metric-card-icon">⚠️</div>
          <div className="metric-card-body">
            <span className="metric-card-label">Pendente</span>
            <span className="metric-card-value" style={{ color: '#ff6b6b' }}>{formatarMoeda(pendente)}</span>
          </div>
        </div>
      </div>

      <form className="expense-form glass-card" onSubmit={salvar}>
        <h3 className="form-title">{editandoId ? 'Editar Despesa' : 'Nova Despesa Fixa'}</h3>

        <div className="form-grid">
          <div className="form-group form-group-wide">
            <label htmlFor="descricao">Descrição</label>
            <input
              id="descricao"
              name="descricao"
              type="text"
              placeholder="Ex: Seguro, Academia..."
              value={form.descricao}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="valor">Valor (R$)</label>
            <input
              id="valor"
              name="valor"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.valor}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="vencimento">Dia de Vencimento</label>
            <input
              id="vencimento"
              name="vencimento"
              type="number"
              min="1"
              max="31"
              placeholder="1–31"
              value={form.vencimento}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="categoria">Categoria Base</label>
            <select
              id="categoria"
              name="categoria"
              value={form.categoria}
              onChange={handleChange}
              required
            >
              <option value="">Selecione...</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="cartaoId">💳 Vinculado ao Cartão (opcional)</label>
            <select
              id="cartaoId"
              name="cartaoId"
              value={form.cartaoId}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">Nenhum (pagamento por fora, Pix, boleto)</option>
              {cartoes.map(c => (
                <option key={c.id} value={c.id}>{c.nome} ({c.bandeira})</option>
              ))}
            </select>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Se selecionado, essa assinatura será cobrada na fatura deste cartão todo mês.
            </p>
          </div>

          <SeletorNatureza
            natureza={form.natureza}
            setNatureza={(n) => setForm({...form, natureza: n})}
            isEsposa={form.isEsposa}
            setIsEsposa={(v) => setForm({...form, isEsposa: v})}
          />

          <div className="form-group form-group-toggle">
            <label className="toggle-label">
              <span className="toggle-text">
                🔁 Conta Recorrente
                <span className="toggle-hint">
                  {form.recorrente ? 'Aparece todo mês' : 'Apenas neste mês'}
                </span>
              </span>
              <div
                className={`toggle-switch ${form.recorrente ? 'toggle-on' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, recorrente: !prev.recorrente }))}
              >
                <div className="toggle-knob" />
              </div>
            </label>
          </div>

          {form.recorrente && (
            <div className="form-group form-group-wide vigencia-final">
              <label>📅 Vigência Final (opcional)</label>
              <div className="vigencia-inputs">
                <select name="mesFim" value={form.mesFim} onChange={handleChange} className="vigencia-select">
                  <option value="">Mês...</option>
                  {MESES.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
                <input name="anoFim" type="number" min="2024" max="2040" placeholder="Ano" value={form.anoFim} onChange={handleChange} className="vigencia-ano-input" />
              </div>
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {editandoId ? 'Salvar Alteração' : 'Adicionar Despesa'}
          </button>
          {editandoId && (
            <button type="button" className="btn btn-secondary" onClick={cancelarEdicao}>Cancelar</button>
          )}
        </div>
      </form>

      <div className="expense-list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Despesas de {MESES[mesAtual]} {anoAtual}
            <span className="badge-count">{despesasExibidas.length}</span>
          </h3>
          
          <div className="tab-nav" style={{ padding: 0, border: 'none', background: 'transparent' }}>
            <button type="button" className={`tab-btn ${filtroNatureza === 'TODOS' ? 'tab-active' : ''}`} onClick={() => setFiltroNatureza('TODOS')}>
              <span className="tab-label">Todas</span>
            </button>
            <button type="button" className={`tab-btn ${filtroNatureza === 'EMPRESA' ? 'tab-active' : ''}`} onClick={() => setFiltroNatureza('EMPRESA')}>
              <span className="tab-icon">🏢</span> <span className="tab-label">Empresa</span>
            </button>
            <button type="button" className={`tab-btn ${filtroNatureza === 'PESSOAL' ? 'tab-active' : ''}`} onClick={() => setFiltroNatureza('PESSOAL')}>
              <span className="tab-icon">👤</span> <span className="tab-label">Pessoal</span>
            </button>
          </div>
        </div>

        {despesasExibidas.length === 0 && (
          <p className="empty-message">Nenhuma despesa registrada para este filtro neste mês.</p>
        )}

        {despesasExibidas.map((d) => {
          const pago = isPago(d);
          const isRecorrente = d.recorrente !== false;
          
          let tagNaturezaCor = d.natureza === 'EMPRESA' ? '#a29bfe' : '#74b9ff';
          let tagNaturezaIcone = d.natureza === 'EMPRESA' ? '🏢' : '👤';
          if (d.isEsposa) { tagNaturezaCor = '#fd79a8'; tagNaturezaIcone = '👩'; }

          return (
            <div key={d.id} className={`expense-item glass-card${pago ? ' expense-paid' : ''}`}>
              <div className="expense-info">
                <div className="expense-header-row">
                  <span className="expense-descricao">
                    {d.descricao}
                    {isRecorrente && <span className="badge-recorrente" title="Conta recorrente">🔁</span>}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span className="expense-categoria-badge" style={{ backgroundColor: mapaCores[d.categoria] || '#b2bec3' }}>
                      {mapaLabels[d.categoria] || d.categoria}
                    </span>
                    <span className="expense-categoria-badge" style={{ backgroundColor: tagNaturezaCor, color: '#111' }}>
                      {tagNaturezaIcone} {d.natureza === 'EMPRESA' ? 'Empresa' : (d.isEsposa ? 'Esposa' : 'Pessoal')}
                    </span>
                  </div>
                </div>
                <div className="expense-details-row">
                  <span className="expense-valor">{formatarMoeda(d.valor)}</span>
                  {d.vencimento && (
                    <span className="expense-vencimento">Vence dia {d.vencimento}</span>
                  )}
                  {pago && <span className="expense-status-tag tag-pago">Pago</span>}
                  {!pago && <span className="expense-status-tag tag-pendente">Pendente</span>}
                </div>
              </div>

              <div className="expense-actions">
                <button
                  className={`action-btn${pago ? ' action-undo' : ' action-check'}`}
                  onClick={() => acionarPagamento(d)}
                  title={pago ? 'Desfazer Pagamento' : 'Pagar com Automação'}
                >
                  {pago ? '↩' : '✓'}
                </button>
                <button className="action-btn action-edit" onClick={() => iniciarEdicao(d)} title="Editar">✎</button>
                <button className="action-btn action-delete" onClick={() => excluir(d.id)} title="Excluir">✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {dadosGrafico.length > 0 && (
        <div className="chart-section glass-card">
          <h3 className="section-title">Distribuição por Categoria</h3>
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
