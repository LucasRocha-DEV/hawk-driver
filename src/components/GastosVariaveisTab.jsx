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
  getDocs
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
  'Cartão de Crédito',
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
  'Cartão de Crédito': '#e84393',
  'Outros': '#b2bec3'
};

const METODOS_PAGAMENTO = [
  'Cartão de Crédito',
  'Cartão de Débito',
  'PIX',
  'Dinheiro',
  'Boleto'
];

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

// Gera um ID único para agrupamento de parcelas
function gerarGrupoId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
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
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [parcelado, setParcelado] = useState(false);
  const [totalParcelas, setTotalParcelas] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Edit state
  const [editandoId, setEditandoId] = useState(null);

  // Filter state
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');

  // Confirmation dialog for deleting installments
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

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

  // Firestore listener — sem orderBy para evitar necessidade de índice composto
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ordenar client-side por data decrescente
      lista.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
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

  // Calculate installment value when valorTotal or totalParcelas change
  useEffect(() => {
    if (parcelado && valorTotal && totalParcelas) {
      const vTotal = parseFloat(valorTotal);
      const nParcelas = parseInt(totalParcelas, 10);
      if (vTotal > 0 && nParcelas > 0) {
        setValor((vTotal / nParcelas).toFixed(2));
      }
    }
  }, [parcelado, valorTotal, totalParcelas]);

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

    // Total no cartão de crédito
    const totalCartao = gastos
      .filter(g => g.metodoPagamento === 'Cartão de Crédito')
      .reduce((acc, g) => acc + Number(g.valor), 0);

    return { total, quantidade, media, totalCartao };
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
    setMetodoPagamento('');
    setParcelado(false);
    setTotalParcelas('');
    setValorTotal('');
    setEditandoId(null);
  };

  const iniciarEdicao = (gasto) => {
    setDescricao(gasto.descricao);
    setCategoria(gasto.categoria);
    setValor(String(gasto.valor));
    setData(gasto.data);
    setObservacao(gasto.observacao || '');
    setMetodoPagamento(gasto.metodoPagamento || '');
    setParcelado(!!gasto.parcelado);
    setTotalParcelas(gasto.totalParcelas ? String(gasto.totalParcelas) : '');
    setValorTotal(gasto.valorTotal ? String(gasto.valorTotal) : '');
    setEditandoId(gasto.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const salvarGasto = async (e) => {
    e.preventDefault();
    if (!descricao.trim() || !categoria || !valor || !data) return;

    setSalvando(true);

    const [anoData, mesData] = data.split('-').map(Number);

    try {
      if (editandoId) {
        // Edição simples (não recria parcelas)
        const dadosGasto = {
          descricao: descricao.trim(),
          categoria,
          valor: parseFloat(valor),
          data,
          observacao: observacao.trim(),
          metodoPagamento: metodoPagamento || null,
          mes: mesData - 1,
          ano: anoData
        };
        const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', editandoId);
        await updateDoc(docRef, dadosGasto);
      } else if (parcelado && totalParcelas && valorTotal) {
        // Criar parcelas automaticamente
        const nParcelas = parseInt(totalParcelas, 10);
        const vTotal = parseFloat(valorTotal);
        const vParcela = parseFloat((vTotal / nParcelas).toFixed(2));
        const grupoId = gerarGrupoId();

        const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_variaveis');

        for (let i = 0; i < nParcelas; i++) {
          // Calcular mês/ano da parcela
          let parcelaMes = (mesData - 1) + i; // mesData é 1-indexed, converter para 0-indexed
          let parcelaAno = anoData;
          while (parcelaMes > 11) {
            parcelaMes -= 12;
            parcelaAno += 1;
          }

          // Data da parcela (mesmo dia, mês diferente)
          const diaOriginal = data.split('-')[2];
          const parcelaData = `${parcelaAno}-${String(parcelaMes + 1).padStart(2, '0')}-${diaOriginal}`;

          await addDoc(colRef, {
            descricao: descricao.trim(),
            categoria,
            valor: vParcela,
            valorTotal: vTotal,
            data: parcelaData,
            observacao: observacao.trim(),
            metodoPagamento: metodoPagamento || 'Cartão de Crédito',
            mes: parcelaMes,
            ano: parcelaAno,
            parcelado: true,
            parcelaAtual: i + 1,
            totalParcelas: nParcelas,
            grupoParcelamento: grupoId
          });
        }
      } else {
        // Gasto único (não parcelado)
        const dadosGasto = {
          descricao: descricao.trim(),
          categoria,
          valor: parseFloat(valor),
          data,
          observacao: observacao.trim(),
          metodoPagamento: metodoPagamento || null,
          mes: mesData - 1,
          ano: anoData,
          parcelado: false
        };
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

  const excluirGasto = async (gasto) => {
    if (gasto.parcelado && gasto.grupoParcelamento) {
      // Mostrar confirmação para parcelas
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
    } catch (error) {
      console.error('Erro ao excluir gasto:', error);
    }
  };

  const excluirTodasParcelas = async (grupoId) => {
    try {
      const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_variaveis');
      const q = query(colRef, where('grupoParcelamento', '==', grupoId));
      const snapshot = await getDocs(q);
      const batch = [];
      snapshot.forEach(docSnap => {
        batch.push(deleteDoc(doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', docSnap.id)));
      });
      await Promise.all(batch);
      limparFormulario();
    } catch (error) {
      console.error('Erro ao excluir parcelas:', error);
    }
  };

  const excluirParcelasRestantes = async (gasto) => {
    try {
      const colRef = collection(db, 'usuarios', usuario.uid, 'despesas_variaveis');
      const q = query(colRef, where('grupoParcelamento', '==', gasto.grupoParcelamento));
      const snapshot = await getDocs(q);
      const batch = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        // Excluir parcelas desta em diante (parcelaAtual >= gasto.parcelaAtual)
        if (d.parcelaAtual >= gasto.parcelaAtual) {
          batch.push(deleteDoc(doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', docSnap.id)));
        }
      });
      await Promise.all(batch);
      limparFormulario();
    } catch (error) {
      console.error('Erro ao excluir parcelas restantes:', error);
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
            <label className="form-label">💳 Método de Pagamento</label>
            <select
              className="form-input"
              value={metodoPagamento}
              onChange={e => setMetodoPagamento(e.target.value)}
            >
              <option value="">Selecione...</option>
              {METODOS_PAGAMENTO.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
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

          {/* Toggle Parcelado */}
          {!editandoId && (
            <div className="form-group form-group-toggle" style={{ gridColumn: '1 / -1' }}>
              <label className="toggle-label">
                <span className="toggle-text">
                  💳 Compra Parcelada?
                  <span className="toggle-hint">
                    {parcelado ? 'Criar parcelas nos meses seguintes' : 'Gasto à vista'}
                  </span>
                </span>
                <div
                  className={`toggle-switch ${parcelado ? 'toggle-on' : ''}`}
                  onClick={() => setParcelado(!parcelado)}
                >
                  <div className="toggle-knob" />
                </div>
              </label>
            </div>
          )}

          {/* Modo Parcela Existente — para itens já parcelados no cartão */}
          {editandoId && (
            <div className="form-group form-group-toggle" style={{ gridColumn: '1 / -1' }}>
              <label className="toggle-label">
                <span className="toggle-text">
                  📋 Já é uma parcela em andamento?
                  <span className="toggle-hint">
                    {parcelado ? 'Marcar como parcela (ex: 3/12)' : 'Gasto avulso'}
                  </span>
                </span>
                <div
                  className={`toggle-switch ${parcelado ? 'toggle-on' : ''}`}
                  onClick={() => setParcelado(!parcelado)}
                >
                  <div className="toggle-knob" />
                </div>
              </label>
            </div>
          )}

          {/* Campos de parcelamento */}
          {parcelado && !editandoId && (
            <>
              <div className="form-group">
                <label className="form-label">💰 Valor Total da Compra (R$)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Ex: 3000.00"
                  step="0.01"
                  min="0.01"
                  value={valorTotal}
                  onChange={e => setValorTotal(e.target.value)}
                  required={parcelado}
                />
              </div>

              <div className="form-group">
                <label className="form-label">🔢 Número de Parcelas</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Ex: 12"
                  min="2"
                  max="48"
                  value={totalParcelas}
                  onChange={e => setTotalParcelas(e.target.value)}
                  required={parcelado}
                />
              </div>

              {valorTotal && totalParcelas && (
                <div className="parcela-preview" style={{ gridColumn: '1 / -1' }}>
                  <div className="parcela-preview-card">
                    <span className="parcela-preview-label">Valor de cada parcela:</span>
                    <span className="parcela-preview-valor">
                      {formatarMoeda(parseFloat(valorTotal) / parseInt(totalParcelas, 10))}
                    </span>
                    <span className="parcela-preview-info">
                      {totalParcelas}x de {formatarMoeda(parseFloat(valorTotal) / parseInt(totalParcelas, 10))}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Valor (para gasto à vista) */}
          {!parcelado && (
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
          )}

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
                  : parcelado
                    ? `💳 Criar ${totalParcelas || '?'}x Parcelas`
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

      {/* Monthly Summary Cards — Design Profissional */}
      <div className="metric-cards-grid">
        <div className="metric-card">
          <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)' }} />
          <div className="metric-card-icon">💸</div>
          <div className="metric-card-body">
            <span className="metric-card-label">Total do Mês</span>
            <span className="metric-card-value" style={{ color: '#ff6b6b' }}>{formatarMoeda(resumo.total)}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)' }} />
          <div className="metric-card-icon">📊</div>
          <div className="metric-card-body">
            <span className="metric-card-label">Quantidade</span>
            <span className="metric-card-value" style={{ color: '#6c5ce7' }}>{resumo.quantidade} {resumo.quantidade === 1 ? 'gasto' : 'gastos'}</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #ffd93d, #f0932b)' }} />
          <div className="metric-card-icon">📈</div>
          <div className="metric-card-body">
            <span className="metric-card-label">Média por Gasto</span>
            <span className="metric-card-value" style={{ color: '#ffd93d' }}>{formatarMoeda(resumo.media)}</span>
          </div>
        </div>
        {resumo.totalCartao > 0 && (
          <div className="metric-card">
            <div className="metric-card-accent" style={{ background: 'linear-gradient(135deg, #e84393, #fd79a8)' }} />
            <div className="metric-card-icon">💳</div>
            <div className="metric-card-body">
              <span className="metric-card-label">No Cartão de Crédito</span>
              <span className="metric-card-value" style={{ color: '#e84393' }}>{formatarMoeda(resumo.totalCartao)}</span>
            </div>
          </div>
        )}
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
                  <span className="top5-descricao">
                    {gasto.descricao}
                    {gasto.parcelado && (
                      <span className="badge-parcela">{gasto.parcelaAtual}/{gasto.totalParcelas}</span>
                    )}
                  </span>
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
                    <span className="expense-descricao">
                      {gasto.descricao}
                      {gasto.parcelado && (
                        <span className="badge-parcela">
                          {gasto.parcelaAtual}/{gasto.totalParcelas}
                        </span>
                      )}
                    </span>
                    <span
                      className="categoria-badge"
                      style={{ background: CORES_CATEGORIAS[gasto.categoria] || '#b2bec3' }}
                    >
                      {gasto.categoria}
                    </span>
                    {gasto.metodoPagamento && (
                      <span className="metodo-badge">
                        {gasto.metodoPagamento === 'Cartão de Crédito' ? '💳' :
                         gasto.metodoPagamento === 'Cartão de Débito' ? '💳' :
                         gasto.metodoPagamento === 'PIX' ? '⚡' :
                         gasto.metodoPagamento === 'Dinheiro' ? '💵' : '📄'}
                        {' '}{gasto.metodoPagamento}
                      </span>
                    )}
                  </div>
                  <div className="expense-item-right">
                    <span className="expense-valor">{formatarMoeda(gasto.valor)}</span>
                    {gasto.parcelado && gasto.valorTotal && (
                      <span className="expense-valor-total-info">
                        Total: {formatarMoeda(gasto.valorTotal)}
                      </span>
                    )}
                    <button
                      className="btn-icon btn-edit"
                      onClick={() => iniciarEdicao(gasto)}
                      title="Editar"
                    >
                      ✎
                    </button>
                    <button
                      className="btn-icon btn-delete"
                      onClick={() => excluirGasto(gasto)}
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

      {/* Modal de Confirmação de Exclusão de Parcelas */}
      {confirmarExclusao && (
        <div className="modal-overlay" onClick={() => setConfirmarExclusao(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">🗑️ Excluir Parcela</h3>
            <p className="modal-descricao">
              <strong>{confirmarExclusao.descricao}</strong> — Parcela {confirmarExclusao.parcelaAtual}/{confirmarExclusao.totalParcelas}
            </p>
            <p className="modal-texto">O que deseja fazer?</p>

            <div className="modal-actions">
              <button
                className="modal-btn modal-btn-danger"
                onClick={async () => {
                  await excluirGastoUnico(confirmarExclusao.id);
                  setConfirmarExclusao(null);
                }}
              >
                🗑️ Excluir Apenas Esta Parcela
              </button>
              <button
                className="modal-btn modal-btn-warning"
                onClick={async () => {
                  await excluirParcelasRestantes(confirmarExclusao);
                  setConfirmarExclusao(null);
                }}
              >
                ⏩ Excluir Esta e as Restantes
              </button>
              <button
                className="modal-btn modal-btn-danger-full"
                onClick={async () => {
                  await excluirTodasParcelas(confirmarExclusao.grupoParcelamento);
                  setConfirmarExclusao(null);
                }}
              >
                💥 Excluir Todas as Parcelas
              </button>
              <button
                className="modal-btn modal-btn-cancel"
                onClick={() => setConfirmarExclusao(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
