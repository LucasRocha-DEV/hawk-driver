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

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const CATEGORIAS = [
  'Aluguel / Financiamento',
  'Energia Elétrica',
  'Água',
  'Internet',
  'Celular',
  'Plano de Saúde',
  'Seguro',
  'Streaming',
  'Academia',
  'Escola / Curso',
  'Condomínio',
  'Outros'
];

const CORES_CATEGORIAS = {
  'Aluguel / Financiamento': '#ff6b6b',
  'Energia Elétrica': '#ffd93d',
  'Água': '#00d4aa',
  'Internet': '#6c5ce7',
  'Celular': '#a29bfe',
  'Plano de Saúde': '#fd79a8',
  'Seguro': '#00b894',
  'Streaming': '#e17055',
  'Academia': '#0984e3',
  'Escola / Curso': '#fdcb6e',
  'Condomínio': '#636e72',
  'Outros': '#b2bec3'
};

const formInicial = {
  descricao: '',
  categoria: '',
  valor: '',
  vencimento: '',
  recorrente: true,
  mesFim: '',
  anoFim: '',
  natureza: 'PESSOAL', // EMPRESA ou PESSOAL
  isEsposa: false,
  cartaoId: ''
};

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderLabelPie({ name, percent }) {
  if (percent < 0.03) return null;
  return `${(percent * 100).toFixed(0)}%`;
}

function chaveMes(mes, ano) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
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

export default function DespesasFixasTab() {
  const { usuario } = useAuth();

  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  const [todasDespesas, setTodasDespesas] = useState([]);
  const [saldos, setSaldos] = useState({});
  const [cartoes, setCartoes] = useState([]);
  const [form, setForm] = useState(formInicial);
  const [editandoId, setEditandoId] = useState(null);

  // Estados Modal Pagamento
  const [pagamentoModal, setPagamentoModal] = useState(null);
  const [caixinhaFonte, setCaixinhaFonte] = useState('');
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

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

    return () => {
      unsubscribeDespesas();
      unsubSaldos();
      unsubCartoes();
    };
  }, [usuario]);

  const despesasDoMes = useMemo(() => {
    return todasDespesas.filter(d => despesaAtivaNoPeriodo(d, mesAtual, anoAtual));
  }, [todasDespesas, mesAtual, anoAtual]);

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

  const { total, pago, pendente } = useMemo(() => {
    const t = despesasDoMes.reduce((s, d) => s + Number(d.valor), 0);
    const p = despesasDoMes.reduce((s, d) => (isPago(d) ? s + Number(d.valor) : s), 0);
    return { total: t, pago: p, pendente: t - p };
  }, [despesasDoMes, isPago]);

  const dadosGrafico = useMemo(() => {
    const mapa = {};
    despesasDoMes.forEach((d) => {
      if (!mapa[d.categoria]) mapa[d.categoria] = 0;
      mapa[d.categoria] += Number(d.valor);
    });
    return Object.entries(mapa).map(([name, value]) => ({ name, value }));
  }, [despesasDoMes]);

  function mesAnterior() {
    if (mesAtual === 0) {
      setMesAtual(11);
      setAnoAtual((a) => a - 1);
    } else {
      setMesAtual((m) => m - 1);
    }
    cancelarEdicao();
  }

  function mesSeguinte() {
    if (mesAtual === 11) {
      setMesAtual(0);
      setAnoAtual((a) => a + 1);
    } else {
      setMesAtual((m) => m + 1);
    }
    cancelarEdicao();
  }

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
        dados.pagoPorMes = {};

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
      // Se já está pago, permitir desfazer (NÃO devolve dinheiro automaticamente para evitar bugs, apenas muda status visual)
      if (window.confirm('Desfazer pagamento? Isso não devolverá o dinheiro automaticamente para a caixinha do Patrimônio, apenas marcará como pendente.')) {
         desfazerPagamento(despesa);
      }
      return;
    }
    // Abrir Modal
    setPagamentoModal(despesa);
    setCaixinhaFonte('');
  };

  const desfazerPagamento = async (despesa) => {
    const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_fixas', despesa.id);
    const chave = chaveMes(mesAtual, anoAtual);
    const pagoPorMesAtualizado = { ...(despesa.pagoPorMes || {}) };
    pagoPorMesAtualizado[chave] = false;
    await updateDoc(docRef, { pagoPorMes: pagoPorMesAtualizado });
  };

  const confirmarPagamento = async (e) => {
    e.preventDefault();
    if (!usuario || !pagamentoModal || !caixinhaFonte) return;
    
    setProcessandoPagamento(true);
    try {
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

        let nomeCaixinhaFonte = caixinhaFonte.charAt(0).toUpperCase() + caixinhaFonte.slice(1);
        if (caixinhaFonte === 'saldoConta') nomeCaixinhaFonte = 'Conta Principal';
        
        await addDoc(collection(db, 'usuarios', usuario.uid, 'transacoes_patrimonio'), {
          caixinhaId: caixinhaFonte,
          caixinhaNome: nomeCaixinhaFonte,
          tipo: 'SAIDA',
          valor: valorConta,
          motivo: `Pgto Fixa: ${pagamentoModal.descricao}`,
          data: new Date().toISOString().split('T')[0],
          criadoEm: serverTimestamp()
        });
      }

      setPagamentoModal(null);
    } catch (err) {
      console.error(err);
      alert('Falha ao processar pagamento inteligente.');
    }
    setProcessandoPagamento(false);
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
      <div className="month-navigation">
        <button className="month-nav-btn" onClick={mesAnterior} aria-label="Mês anterior">‹</button>
        <h2 className="month-title">{MESES[mesAtual]} {anoAtual}</h2>
        <button className="month-nav-btn" onClick={mesSeguinte} aria-label="Próximo mês">›</button>
      </div>

      <div className="metric-cards-grid">
        <div className="metric-card">
          <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)' }} />
          <div className="metric-card-icon">💸</div>
          <div className="metric-card-body">
            <span className="metric-card-label">Total Fixo</span>
            <span className="metric-card-value" style={{ color: '#a29bfe' }}>{formatarMoeda(total)}</span>
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
              {CATEGORIAS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
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

          <div className="nature-selector-container">
            <label className="form-label">Natureza do Gasto (De onde sai o dinheiro?)</label>
            <div className="nature-buttons">
              <div className={`nature-btn ${form.natureza === 'EMPRESA' ? 'active-empresa' : ''}`} onClick={() => setForm({...form, natureza: 'EMPRESA'})}>
                <span className="nature-icon">🏢</span>
                <span className="nature-label">Custo Empresa</span>
              </div>
              <div className={`nature-btn ${form.natureza === 'PESSOAL' ? 'active-pessoal' : ''}`} onClick={() => setForm({...form, natureza: 'PESSOAL'})}>
                <span className="nature-icon">👤</span>
                <span className="nature-label">Custo Pessoal</span>
              </div>
            </div>
            
            {form.natureza === 'PESSOAL' && (
              <div className={`wife-toggle-container ${form.isEsposa ? 'active-wife' : ''}`} onClick={() => setForm({...form, isEsposa: !form.isEsposa})}>
                <div className="wife-toggle-checkbox">
                   {form.isEsposa ? '✅' : '⬜'}
                </div>
                <div className="wife-toggle-text">
                   👩 Gasto da Esposa? <span className="wife-hint">(Identifica separadamente)</span>
                </div>
              </div>
            )}
          </div>

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
        <h3 className="section-title">
          Despesas de {MESES[mesAtual]} {anoAtual}
          <span className="badge-count">{despesasDoMes.length}</span>
        </h3>

        {despesasDoMes.length === 0 && (
          <p className="empty-message">Nenhuma despesa registrada neste mês.</p>
        )}

        {despesasDoMes.map((d) => {
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
                    <span className="expense-categoria-badge" style={{ backgroundColor: CORES_CATEGORIAS[d.categoria] || '#b2bec3' }}>
                      {d.categoria}
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
                  <Cell key={entry.name} fill={CORES_CATEGORIAS[entry.name] || '#b2bec3'} />
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div className="section-card" style={{ width: '90%', maxWidth: '450px', background: '#16162a', padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.3rem', color: '#fff' }}>✅ Confirmar Pagamento</h3>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Pagando Despesa: <strong style={{ color: '#fff' }}>{pagamentoModal.descricao}</strong></div>
              <div style={{ fontSize: '1.4rem', color: '#ff6b6b', fontWeight: 'bold', marginTop: '8px' }}>{formatarMoeda(pagamentoModal.valor)}</div>
            </div>

            <form onSubmit={confirmarPagamento}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '1rem' }}>🧠 De onde esse dinheiro vai sair?</label>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '-6px' }}>O app vai dar baixa nesta conta e subtrair do saldo escolhido na aba Patrimônio.</p>
                <select className="form-input" required value={caixinhaFonte} onChange={e => setCaixinhaFonte(e.target.value)} style={{ background: '#0a0a16', padding: '12px', fontSize: '1rem' }}>
                  <option value="" disabled>Escolha a fonte pagadora...</option>
                  <optgroup label="🏢 Caixinhas Empresa">
                    <option value="empresa">🏢 Empresa (Saldo: {formatarMoeda(saldos.empresa)})</option>
                    <option value="manutencao">🔧 Manutenção (Saldo: {formatarMoeda(saldos.manutencao)})</option>
                  </optgroup>
                  <optgroup label="👤 Caixinhas Pessoais">
                    <option value="contas">💳 Contas (Saldo: {formatarMoeda(saldos.contas)})</option>
                    <option value="emergencia">🚨 Reserva de Emergência (Saldo: {formatarMoeda(saldos.emergencia)})</option>
                    <option value="livre">💸 Livre - Lazer (Saldo: {formatarMoeda(saldos.livre)})</option>
                  </optgroup>
                  <optgroup label="Outros">
                    <option value="saldoConta">🏦 Conta Principal (Saldo: {formatarMoeda(saldos.saldoConta)})</option>
                    <option value="NENHUMA">❌ Já paguei por fora (Apenas dar baixa aqui)</option>
                  </optgroup>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '14px', fontSize: '1rem' }} disabled={processandoPagamento || !caixinhaFonte}>
                  {processandoPagamento ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setPagamentoModal(null)} style={{ padding: '14px 24px' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
