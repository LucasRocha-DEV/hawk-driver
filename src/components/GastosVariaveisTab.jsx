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
  orderBy
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

const CATEGORIAS = [
  'Alimentação',
  'Mercado',
  'Transporte',
  'Saúde / Farmácia',
  'Vestuário',
  'Lazer',
  'Manutenção Veículo',
  'Combustível (eventual)',
  'Restaurante',
  'Compras Online',
  'Presente',
  'Outros'
];

const CORES_CATEGORIAS = {
  'Alimentação': '#ff6b6b',
  'Mercado': '#ffd93d',
  'Transporte': '#6c5ce7',
  'Saúde / Farmácia': '#00d4aa',
  'Vestuário': '#fd79a8',
  'Lazer': '#e17055',
  'Manutenção Veículo': '#0984e3',
  'Combustível (eventual)': '#00b894',
  'Restaurante': '#a29bfe',
  'Compras Online': '#fdcb6e',
  'Presente': '#636e72',
  'Outros': '#b2bec3'
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function dataHojeISO() {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = String(hoje.getMonth() + 1).padStart(2, '0');
  const d = String(hoje.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function GastosVariaveisTab() {
  const { usuario } = useAuth();
  const agora = new Date();

  // Navigation state
  const [mesAtual, setMesAtual] = useState(agora.getMonth());
  const [anoAtual, setAnoAtual] = useState(agora.getFullYear());

  // Data state
  const [gastos, setGastos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Form state
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(dataHojeISO());
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Edit state
  const [editandoId, setEditandoId] = useState(null);

  // Filter state
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');

  // Month navigation
  const mesAnterior = () => {
    if (mesAtual === 0) {
      setMesAtual(11);
      setAnoAtual(prev => prev - 1);
    } else {
      setMesAtual(prev => prev - 1);
    }
  };

  const mesSeguinte = () => {
    if (mesAtual === 11) {
      setMesAtual(0);
      setAnoAtual(prev => prev + 1);
    } else {
      setMesAtual(prev => prev + 1);
    }
  };

  // Firestore listener
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
      where('ano', '==', anoAtual),
      orderBy('data', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setGastos(lista);
      setCarregando(false);
    }, (error) => {
      console.error('Erro ao carregar gastos variáveis:', error);
      setCarregando(false);
    });

    return () => unsubscribe();
  }, [usuario, mesAtual, anoAtual]);

  // Reset filter when month changes
  useEffect(() => {
    setFiltroCategoria('Todas');
  }, [mesAtual, anoAtual]);

  // Filtered list
  const gastosFiltrados = useMemo(() => {
    if (filtroCategoria === 'Todas') return gastos;
    return gastos.filter(g => g.categoria === filtroCategoria);
  }, [gastos, filtroCategoria]);

  // Categories that exist in data (for filter buttons)
  const categoriasPresentes = useMemo(() => {
    const set = new Set(gastos.map(g => g.categoria));
    return CATEGORIAS.filter(c => set.has(c));
  }, [gastos]);

  // Summary calculations
  const resumo = useMemo(() => {
    const total = gastos.reduce((acc, g) => acc + Number(g.valor), 0);
    const quantidade = gastos.length;
    const media = quantidade > 0 ? total / quantidade : 0;
    return { total, quantidade, media };
  }, [gastos]);

  // Chart data
  const dadosGrafico = useMemo(() => {
    const porCategoria = {};
    gastos.forEach(g => {
      const cat = g.categoria;
      porCategoria[cat] = (porCategoria[cat] || 0) + Number(g.valor);
    });
    return Object.entries(porCategoria)
      .map(([categoria, total]) => ({
        categoria,
        total,
        cor: CORES_CATEGORIAS[categoria] || '#b2bec3'
      }))
      .sort((a, b) => b.total - a.total);
  }, [gastos]);

  // Top 5 biggest expenses
  const top5 = useMemo(() => {
    return [...gastos]
      .sort((a, b) => Number(b.valor) - Number(a.valor))
      .slice(0, 5);
  }, [gastos]);

  // Form handlers
  const limparFormulario = () => {
    setDescricao('');
    setCategoria('');
    setValor('');
    setData(dataHojeISO());
    setObservacao('');
    setEditandoId(null);
  };

  const iniciarEdicao = (gasto) => {
    setDescricao(gasto.descricao);
    setCategoria(gasto.categoria);
    setValor(String(gasto.valor));
    setData(gasto.data);
    setObservacao(gasto.observacao || '');
    setEditandoId(gasto.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const salvarGasto = async (e) => {
    e.preventDefault();
    if (!descricao.trim() || !categoria || !valor || !data) return;

    setSalvando(true);

    const [anoData, mesData] = data.split('-').map(Number);
    const dadosGasto = {
      descricao: descricao.trim(),
      categoria,
      valor: parseFloat(valor),
      data,
      observacao: observacao.trim(),
      mes: mesData - 1,
      ano: anoData
    };

    try {
      if (editandoId) {
        const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', editandoId);
        await updateDoc(docRef, dadosGasto);
      } else {
        const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_variaveis');
        await addDoc(colRef, dadosGasto);
      }
      limparFormulario();
    } catch (error) {
      console.error('Erro ao salvar gasto:', error);
    } finally {
      setSalvando(false);
    }
  };

  const excluirGasto = async (id) => {
    try {
      const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', id);
      await deleteDoc(docRef);
      if (editandoId === id) limparFormulario();
    } catch (error) {
      console.error('Erro ao excluir gasto:', error);
    }
  };

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(18, 18, 26, 0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '10px 14px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ color: '#fff', margin: 0, fontSize: '13px', fontFamily: 'DM Sans' }}>
            {payload[0].payload.categoria}
          </p>
          <p style={{ color: '#00d4aa', margin: '4px 0 0', fontSize: '14px', fontWeight: 600, fontFamily: 'DM Sans' }}>
            {formatarMoeda(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="tab-content">
      {/* Month Navigation */}
      <div className="month-navigation">
        <button className="month-nav-btn" onClick={mesAnterior}>‹</button>
        <span className="month-nav-label">{MESES[mesAtual]} {anoAtual}</span>
        <button className="month-nav-btn" onClick={mesSeguinte}>›</button>
      </div>

      {/* Quick Entry Form */}
      <div className="card">
        <h3 className="card-title">
          {editandoId ? '✎ Editar Gasto' : '➕ Novo Gasto Variável'}
        </h3>
        <form onSubmit={salvarGasto} className="form-grid">
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Almoço, Uber, Farmácia..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select
              className="form-input"
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {CATEGORIAS.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Valor (R$)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0,00"
              step="0.01"
              min="0.01"
              value={valor}
              onChange={e => setValor(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Data</label>
            <input
              type="date"
              className="form-input"
              value={data}
              onChange={e => setData(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Observação (opcional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Detalhes adicionais..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
          </div>

          <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando
                ? 'Salvando...'
                : editandoId
                  ? '💾 Salvar Alteração'
                  : '➕ Adicionar Gasto'
              }
            </button>
            {editandoId && (
              <button type="button" className="btn-secondary" onClick={limparFormulario}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Monthly Summary Cards */}
      <div className="summary-cards">
        <div className="card summary-card">
          <span className="summary-label">Total do Mês</span>
          <span className="summary-value" style={{ color: '#ff6b6b' }}>
            {formatarMoeda(resumo.total)}
          </span>
        </div>
        <div className="card summary-card">
          <span className="summary-label">Quantidade</span>
          <span className="summary-value" style={{ color: '#6c5ce7' }}>
            {resumo.quantidade} {resumo.quantidade === 1 ? 'gasto' : 'gastos'}
          </span>
        </div>
        <div className="card summary-card">
          <span className="summary-label">Média por Gasto</span>
          <span className="summary-value" style={{ color: '#ffd93d' }}>
            {formatarMoeda(resumo.media)}
          </span>
        </div>
      </div>

      {/* Bar Chart */}
      {dadosGrafico.length > 0 && (
        <div className="card">
          <h3 className="card-title">📊 Total por Categoria</h3>
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer>
              <BarChart
                data={dadosGrafico}
                margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="categoria"
                  tick={{ fill: '#a0a0b8', fontSize: 11, fontFamily: 'DM Sans' }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                  height={80}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#a0a0b8', fontSize: 11, fontFamily: 'DM Sans' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  tickFormatter={(v) => `R$ ${v}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={50}>
                  {dadosGrafico.map((entry, index) => (
                    <Cell key={index} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top 5 Biggest Expenses */}
      {top5.length > 0 && (
        <div className="card">
          <h3 className="card-title">🏆 Top 5 Maiores Gastos</h3>
          <div className="top5-list">
            {top5.map((gasto, index) => (
              <div key={gasto.id} className="top5-item">
                <span className="top5-position" style={{
                  background: index === 0
                    ? 'linear-gradient(135deg, #ffd93d, #f0932b)'
                    : index === 1
                      ? 'linear-gradient(135deg, #b2bec3, #636e72)'
                      : index === 2
                        ? 'linear-gradient(135deg, #e17055, #d63031)'
                        : 'rgba(255,255,255,0.08)'
                }}>
                  {index + 1}º
                </span>
                <div className="top5-info">
                  <span className="top5-descricao">{gasto.descricao}</span>
                  <span
                    className="categoria-badge"
                    style={{ background: CORES_CATEGORIAS[gasto.categoria] || '#b2bec3' }}
                  >
                    {gasto.categoria}
                  </span>
                </div>
                <span className="top5-valor">{formatarMoeda(gasto.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter */}
      {categoriasPresentes.length > 0 && (
        <div className="card">
          <h3 className="card-title">🔍 Filtrar por Categoria</h3>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filtroCategoria === 'Todas' ? 'filter-btn-active' : ''}`}
              onClick={() => setFiltroCategoria('Todas')}
            >
              Todas
            </button>
            {categoriasPresentes.map(cat => (
              <button
                key={cat}
                className={`filter-btn ${filtroCategoria === cat ? 'filter-btn-active' : ''}`}
                style={filtroCategoria === cat ? { background: CORES_CATEGORIAS[cat], borderColor: CORES_CATEGORIAS[cat] } : {}}
                onClick={() => setFiltroCategoria(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expense List */}
      <div className="card">
        <h3 className="card-title">
          📋 Gastos de {MESES[mesAtual]}
          {filtroCategoria !== 'Todas' && (
            <span className="filter-indicator"> — {filtroCategoria}</span>
          )}
        </h3>

        {carregando ? (
          <div className="loading-state">Carregando gastos...</div>
        ) : gastosFiltrados.length === 0 ? (
          <div className="empty-state">
            {gastos.length === 0
              ? 'Nenhum gasto registrado neste mês.'
              : `Nenhum gasto na categoria "${filtroCategoria}".`
            }
          </div>
        ) : (
          <div className="expense-list">
            {gastosFiltrados.map(gasto => (
              <div key={gasto.id} className="expense-item">
                <div className="expense-item-header">
                  <div className="expense-item-left">
                    <span className="expense-date">{formatarData(gasto.data)}</span>
                    <span className="expense-descricao">{gasto.descricao}</span>
                    <span
                      className="categoria-badge"
                      style={{ background: CORES_CATEGORIAS[gasto.categoria] || '#b2bec3' }}
                    >
                      {gasto.categoria}
                    </span>
                  </div>
                  <div className="expense-item-right">
                    <span className="expense-valor">{formatarMoeda(gasto.valor)}</span>
                    <button
                      className="btn-icon btn-edit"
                      onClick={() => iniciarEdicao(gasto)}
                      title="Editar"
                    >
                      ✎
                    </button>
                    <button
                      className="btn-icon btn-delete"
                      onClick={() => excluirGasto(gasto.id)}
                      title="Excluir"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {gasto.observacao && (
                  <div className="expense-observacao">
                    💬 {gasto.observacao}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
