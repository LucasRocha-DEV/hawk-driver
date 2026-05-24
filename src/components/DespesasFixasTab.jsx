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
  where
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
  pago: false
};

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderLabelPie({ name, percent }) {
  if (percent < 0.03) return null;
  return `${(percent * 100).toFixed(0)}%`;
}

export default function DespesasFixasTab() {
  const { usuario } = useAuth();

  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  const [despesas, setDespesas] = useState([]);
  const [form, setForm] = useState(formInicial);
  const [editandoId, setEditandoId] = useState(null);

  // ── Firestore real-time listener ──────────────────────────────────
  useEffect(() => {
    if (!usuario) return;

    const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_fixas');
    const q = query(colRef, where('mes', '==', mesAtual), where('ano', '==', anoAtual));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => (a.vencimento || 32) - (b.vencimento || 32));
      setDespesas(lista);
    });

    return () => unsubscribe();
  }, [usuario, mesAtual, anoAtual]);

  // ── Summaries ─────────────────────────────────────────────────────
  const { total, pago, pendente } = useMemo(() => {
    const t = despesas.reduce((s, d) => s + Number(d.valor), 0);
    const p = despesas.reduce((s, d) => (d.pago ? s + Number(d.valor) : s), 0);
    return { total: t, pago: p, pendente: t - p };
  }, [despesas]);

  // ── Pie chart data ────────────────────────────────────────────────
  const dadosGrafico = useMemo(() => {
    const mapa = {};
    despesas.forEach((d) => {
      if (!mapa[d.categoria]) mapa[d.categoria] = 0;
      mapa[d.categoria] += Number(d.valor);
    });
    return Object.entries(mapa).map(([name, value]) => ({ name, value }));
  }, [despesas]);

  // ── Month navigation ──────────────────────────────────────────────
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

  // ── Form helpers ──────────────────────────────────────────────────
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function cancelarEdicao() {
    setForm(formInicial);
    setEditandoId(null);
  }

  // ── CRUD ──────────────────────────────────────────────────────────
  async function salvar(e) {
    e.preventDefault();
    if (!usuario) return;
    if (!form.descricao.trim() || !form.categoria || !form.valor) return;

    const dados = {
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      valor: Number(form.valor),
      vencimento: form.vencimento ? Number(form.vencimento) : null,
      pago: form.pago,
      mes: mesAtual,
      ano: anoAtual
    };

    try {
      if (editandoId) {
        const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_fixas', editandoId);
        await updateDoc(docRef, dados);
      } else {
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
      await updateDoc(docRef, { pago: !despesa.pago });
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
      pago: despesa.pago
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

  // ── Custom tooltip for pie chart ──────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="tab-content">
      {/* ── Month Navigation ──────────────────────────────────────── */}
      <div className="month-navigation">
        <button className="month-nav-btn" onClick={mesAnterior} aria-label="Mês anterior">‹</button>
        <h2 className="month-title">{MESES[mesAtual]} {anoAtual}</h2>
        <button className="month-nav-btn" onClick={mesSeguinte} aria-label="Próximo mês">›</button>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────── */}
      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-label">Total</span>
          <span className="summary-value">{formatarMoeda(total)}</span>
        </div>
        <div className="summary-card card-green">
          <span className="summary-label">Pago</span>
          <span className="summary-value" style={{ color: '#00d4aa' }}>{formatarMoeda(pago)}</span>
        </div>
        <div className="summary-card card-red">
          <span className="summary-label">Pendente</span>
          <span className="summary-value" style={{ color: '#ff6b6b' }}>{formatarMoeda(pendente)}</span>
        </div>
      </div>

      {/* ── Registration / Edit Form ──────────────────────────────── */}
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

          <div className="form-group form-group-checkbox">
            <label>
              <input
                name="pago"
                type="checkbox"
                checked={form.pago}
                onChange={handleChange}
              />
              <span>Marcar como pago</span>
            </label>
          </div>
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

      {/* ── Expense List ──────────────────────────────────────────── */}
      <div className="expense-list">
        <h3 className="section-title">
          Despesas de {MESES[mesAtual]} {anoAtual}
          <span className="badge-count">{despesas.length}</span>
        </h3>

        {despesas.length === 0 && (
          <p className="empty-message">Nenhuma despesa registrada neste mês.</p>
        )}

        {despesas.map((d) => (
          <div
            key={d.id}
            className={`expense-item glass-card${d.pago ? ' expense-paid' : ''}`}
          >
            <div className="expense-info">
              <div className="expense-header-row">
                <span className="expense-descricao">{d.descricao}</span>
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
                {d.pago && <span className="expense-status-tag tag-pago">Pago</span>}
                {!d.pago && <span className="expense-status-tag tag-pendente">Pendente</span>}
              </div>
            </div>

            <div className="expense-actions">
              <button
                className={`action-btn${d.pago ? ' action-undo' : ' action-check'}`}
                onClick={() => togglePago(d)}
                title={d.pago ? 'Marcar como pendente' : 'Marcar como pago'}
              >
                {d.pago ? '↩' : '✓'}
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
                title="Excluir"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pie Chart ─────────────────────────────────────────────── */}
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
