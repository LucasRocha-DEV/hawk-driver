import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot
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
  'Cartão de Crédito',
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
  'Cartão de Crédito': '#e84393',
  'Outros': '#b2bec3'
};

const formInicial = {
  descricao: '',
  categoria: '',
  valor: '',
  vencimento: '',
  recorrente: true,
  mesFim: '',
  anoFim: ''
};

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderLabelPie({ name, percent }) {
  if (percent < 0.03) return null;
  return `${(percent * 100).toFixed(0)}%`;
}

// Helper: chave do mês para usar no mapa pagoPorMes
function chaveMes(mes, ano) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

// Helper: verifica se uma despesa está ativa em determinado mês/ano
function despesaAtivaNoPeriodo(despesa, mes, ano) {
  const mesInicio = despesa.mesInicio ?? despesa.mes ?? 0;
  const anoInicio = despesa.anoInicio ?? despesa.ano ?? 2020;

  // Converter para timestamp linear para comparação simples
  const periodoAtual = ano * 12 + mes;
  const periodoInicio = anoInicio * 12 + mesInicio;

  if (periodoAtual < periodoInicio) return false;

  // Se não é recorrente, só aparece no mês de criação
  if (despesa.recorrente === false) {
    return periodoAtual === periodoInicio;
  }

  // Se tem vigência final definida
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
  const [form, setForm] = useState(formInicial);
  const [editandoId, setEditandoId] = useState(null);

  // ── Firestore: carregar TODAS as despesas fixas (sem filtro de mês) ──
  useEffect(() => {
    if (!usuario) return;

    const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_fixas');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => (a.vencimento || 32) - (b.vencimento || 32));
      setTodasDespesas(lista);
    });

    return () => unsubscribe();
  }, [usuario]);

  // ── Projetar despesas ativas no mês visualizado ──
  const despesasDoMes = useMemo(() => {
    return todasDespesas.filter(d => despesaAtivaNoPeriodo(d, mesAtual, anoAtual));
  }, [todasDespesas, mesAtual, anoAtual]);

  // ── Status "pago" para o mês atual ──
  const isPago = useCallback((despesa) => {
    const chave = chaveMes(mesAtual, anoAtual);
    // Suporte a formato antigo (boolean simples) e novo (mapa)
    if (despesa.pagoPorMes && typeof despesa.pagoPorMes === 'object') {
      return !!despesa.pagoPorMes[chave];
    }
    // Formato antigo: verificar se é o mês original da despesa
    if (despesa.pago && despesa.mes === mesAtual && despesa.ano === anoAtual) {
      return true;
    }
    return false;
  }, [mesAtual, anoAtual]);

  // ── Summaries ──
  const { total, pago, pendente } = useMemo(() => {
    const t = despesasDoMes.reduce((s, d) => s + Number(d.valor), 0);
    const p = despesasDoMes.reduce((s, d) => (isPago(d) ? s + Number(d.valor) : s), 0);
    return { total: t, pago: p, pendente: t - p };
  }, [despesasDoMes, isPago]);

  // ── Pie chart data ──
  const dadosGrafico = useMemo(() => {
    const mapa = {};
    despesasDoMes.forEach((d) => {
      if (!mapa[d.categoria]) mapa[d.categoria] = 0;
      mapa[d.categoria] += Number(d.valor);
    });
    return Object.entries(mapa).map(([name, value]) => ({ name, value }));
  }, [despesasDoMes]);

  // ── Month navigation ──
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

  // ── Form helpers ──
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function cancelarEdicao() {
    setForm(formInicial);
    setEditandoId(null);
  }

  // ── CRUD ──
  async function salvar(e) {
    e.preventDefault();
    if (!usuario) return;
    if (!form.descricao.trim() || !form.categoria || !form.valor) return;

    const dados = {
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      valor: Number(form.valor),
      vencimento: form.vencimento ? Number(form.vencimento) : null,
      recorrente: form.recorrente
    };

    // Vigência final (opcional)
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
        // Nova despesa: definir mês/ano de início
        dados.mesInicio = mesAtual;
        dados.anoInicio = anoAtual;
        // Manter campos legados para compatibilidade
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

  async function togglePago(despesa) {
    if (!usuario) return;
    try {
      const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_fixas', despesa.id);
      const chave = chaveMes(mesAtual, anoAtual);
      const atualPago = isPago(despesa);

      // Montar o mapa pagoPorMes atualizado
      const pagoPorMesAtualizado = { ...(despesa.pagoPorMes || {}) };
      pagoPorMesAtualizado[chave] = !atualPago;

      await updateDoc(docRef, { pagoPorMes: pagoPorMesAtualizado });
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
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
      anoFim: despesa.anoFim ?? ''
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

  // ── Custom tooltip for pie chart ──
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

  // ── Render ──
  return (
    <div className="tab-content">
      {/* ── Month Navigation ── */}
      <div className="month-navigation">
        <button className="month-nav-btn" onClick={mesAnterior} aria-label="Mês anterior">‹</button>
        <h2 className="month-title">{MESES[mesAtual]} {anoAtual}</h2>
        <button className="month-nav-btn" onClick={mesSeguinte} aria-label="Próximo mês">›</button>
      </div>

      {/* ── Summary Cards — Design Profissional ── */}
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

      {/* ── Registration / Edit Form ── */}
      <form className="expense-form glass-card" onSubmit={salvar}>
        <h3 className="form-title">{editandoId ? 'Editar Despesa' : 'Nova Despesa Fixa'}</h3>

        <div className="form-grid">
          <div className="form-group form-group-wide">
            <label htmlFor="descricao">Descrição</label>
            <input
              id="descricao"
              name="descricao"
              type="text"
              placeholder="Ex: Aluguel do apartamento"
              value={form.descricao}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="categoria">Categoria</label>
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

          {/* Toggle Recorrente */}
          <div className="form-group form-group-toggle">
            <label className="toggle-label">
              <span className="toggle-text">
                🔁 Conta Recorrente
                <span className="toggle-hint">
                  {form.recorrente ? 'Aparece todo mês automaticamente' : 'Apenas neste mês'}
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

          {/* Vigência final (só se recorrente) */}
          {form.recorrente && (
            <div className="form-group form-group-wide vigencia-final">
              <label>📅 Vigência Final (opcional — deixe vazio para sem prazo)</label>
              <div className="vigencia-inputs">
                <select
                  name="mesFim"
                  value={form.mesFim}
                  onChange={handleChange}
                  className="vigencia-select"
                >
                  <option value="">Mês...</option>
                  {MESES.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
                <input
                  name="anoFim"
                  type="number"
                  min="2024"
                  max="2040"
                  placeholder="Ano"
                  value={form.anoFim}
                  onChange={handleChange}
                  className="vigencia-ano-input"
                />
              </div>
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {editandoId ? 'Salvar Alteração' : 'Adicionar Despesa'}
          </button>
          {editandoId && (
            <button type="button" className="btn btn-secondary" onClick={cancelarEdicao}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* ── Expense List ── */}
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

          return (
            <div
              key={d.id}
              className={`expense-item glass-card${pago ? ' expense-paid' : ''}`}
            >
              <div className="expense-info">
                <div className="expense-header-row">
                  <span className="expense-descricao">
                    {d.descricao}
                    {isRecorrente && <span className="badge-recorrente" title="Conta recorrente">🔁</span>}
                  </span>
                  <span
                    className="expense-categoria-badge"
                    style={{ backgroundColor: CORES_CATEGORIAS[d.categoria] || '#b2bec3' }}
                  >
                    {d.categoria}
                  </span>
                </div>
                <div className="expense-details-row">
                  <span className="expense-valor">{formatarMoeda(d.valor)}</span>
                  {d.vencimento && (
                    <span className="expense-vencimento">Vence dia {d.vencimento}</span>
                  )}
                  {pago && <span className="expense-status-tag tag-pago">Pago</span>}
                  {!pago && <span className="expense-status-tag tag-pendente">Pendente</span>}
                </div>
                {isRecorrente && d.mesFim != null && d.anoFim != null && d.mesFim !== '' && d.anoFim !== '' && (
                  <div className="expense-vigencia-info">
                    📅 Vigência até {MESES[Number(d.mesFim)]} {d.anoFim}
                  </div>
                )}
              </div>

              <div className="expense-actions">
                <button
                  className={`action-btn${pago ? ' action-undo' : ' action-check'}`}
                  onClick={() => togglePago(d)}
                  title={pago ? 'Marcar como pendente' : 'Marcar como pago'}
                >
                  {pago ? '↩' : '✓'}
                </button>
                <button
                  className="action-btn action-edit"
                  onClick={() => iniciarEdicao(d)}
                  title="Editar"
                >
                  ✎
                </button>
                <button
                  className="action-btn action-delete"
                  onClick={() => excluir(d.id)}
                  title="Excluir permanentemente"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pie Chart ── */}
      {dadosGrafico.length > 0 && (
        <div className="chart-section glass-card">
          <h3 className="section-title">Distribuição por Categoria</h3>
          <ResponsiveContainer width="100%" height={360}>
            <PieChart>
              <Pie
                data={dadosGrafico}
                cx="50%"
                cy="50%"
                outerRadius={120}
                innerRadius={50}
                dataKey="value"
                label={renderLabelPie}
                labelLine={false}
                paddingAngle={2}
                strokeWidth={0}
              >
                {dadosGrafico.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={CORES_CATEGORIAS[entry.name] || '#b2bec3'}
                  />
                ))}
              </Pie>
              <Tooltip content={<TooltipGrafico />} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                formatter={(value) => (
                  <span style={{ color: '#e0e0e0', fontSize: '0.82rem' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
