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

function gerarGrupoId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export default function GastosVariaveisTab() {
  const { usuario } = useAuth();
  const agora = new Date();

  const [mesAtual, setMesAtual] = useState(agora.getMonth());
  const [anoAtual, setAnoAtual] = useState(agora.getFullYear());

  const [gastos, setGastos] = useState([]);
  const [saldos, setSaldos] = useState({});
  const [carregando, setCarregando] = useState(true);

  // Form state
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(dataHojeISO());
  const [observacao, setObservacao] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  
  // Cartão Fields
  const [cartoes, setCartoes] = useState([]);
  const [cartaoId, setCartaoId] = useState('');
  const [isCartaoTerceiro, setIsCartaoTerceiro] = useState(false);
  const [nomeCartaoTerceiro, setNomeCartaoTerceiro] = useState('');

  const [parcelado, setParcelado] = useState(false);
  const [totalParcelas, setTotalParcelas] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [natureza, setNatureza] = useState('PESSOAL'); // EMPRESA ou PESSOAL
  const [isEsposa, setIsEsposa] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  // Pagamento Inteligente
  const [pagamentoModal, setPagamentoModal] = useState(null);
  const [caixinhaFonte, setCaixinhaFonte] = useState('');
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

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

    return () => {
      unsubscribeGastos();
      unsubSaldos();
      unsubCartoes();
    };
  }, [usuario, mesAtual, anoAtual]);

  useEffect(() => {
    setFiltroCategoria('Todas');
  }, [mesAtual, anoAtual]);

  useEffect(() => {
    if (parcelado && valorTotal && totalParcelas) {
      const vTotal = parseFloat(valorTotal);
      const nParcelas = parseInt(totalParcelas, 10);
      if (vTotal > 0 && nParcelas > 0) {
        setValor((vTotal / nParcelas).toFixed(2));
      }
    }
  }, [parcelado, valorTotal, totalParcelas]);

  const gastosFiltrados = useMemo(() => {
    if (filtroCategoria === 'Todas') return gastos;
    return gastos.filter(g => g.categoria === filtroCategoria);
  }, [gastos, filtroCategoria]);

  const categoriasPresentes = useMemo(() => {
    const set = new Set(gastos.map(g => g.categoria));
    return CATEGORIAS.filter(c => set.has(c));
  }, [gastos]);

  const resumo = useMemo(() => {
    const total = gastos.reduce((acc, g) => acc + Number(g.valor), 0);
    const quantidade = gastos.length;
    const media = quantidade > 0 ? total / quantidade : 0;
    const totalCartao = gastos
      .filter(g => g.metodoPagamento === 'Cartão de Crédito')
      .reduce((acc, g) => acc + Number(g.valor), 0);
    return { total, quantidade, media, totalCartao };
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
        total,
        cor: CORES_CATEGORIAS[categoria] || '#b2bec3'
      }))
      .sort((a, b) => b.total - a.total);
  }, [gastos]);

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
    setValorTotal('');
    setNatureza('PESSOAL');
    setIsEsposa(false);
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
    setValorTotal(gasto.valorTotal ? String(gasto.valorTotal) : '');
    setNatureza(gasto.natureza || 'PESSOAL');
    setIsEsposa(gasto.isEsposa || false);
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
          isEsposa
        };
        const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', editandoId);
        await updateDoc(docRef, dadosGasto);
      } else if (parcelado && totalParcelas && valorTotal) {
        const nParcelas = parseInt(totalParcelas, 10);
        const vTotal = parseFloat(valorTotal);
        const vParcela = parseFloat((vTotal / nParcelas).toFixed(2));
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
            isEsposa,
            pago: false
          });
        }
      } else {
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
          isEsposa,
          pago: false
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
    setCaixinhaFonte('');
  };

  const desfazerPagamento = async (gasto) => {
    const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', gasto.id);
    await updateDoc(docRef, { pago: false });
  };

  const confirmarPagamento = async (e) => {
    e.preventDefault();
    if (!usuario || !pagamentoModal || !caixinhaFonte) return;
    
    setProcessandoPagamento(true);
    try {
      const valorConta = Number(pagamentoModal.valor);
      
      const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', pagamentoModal.id);
      await updateDoc(docRef, { pago: true });

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
          motivo: `Pgto Variável: ${pagamentoModal.descricao}`,
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
    <div className="tab-content">
      <div className="month-navigation">
        <button className="month-nav-btn" onClick={mesAnterior}>‹</button>
        <span className="month-nav-label">{MESES[mesAtual]} {anoAtual}</span>
        <button className="month-nav-btn" onClick={mesSeguinte}>›</button>
      </div>

      <div className="card">
        <h3 className="card-title">{editandoId ? '✎ Editar Gasto' : '➕ Novo Gasto Variável'}</h3>
        <form onSubmit={salvarGasto} className="form-grid">
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input type="text" className="form-input" placeholder="Ex: Farmácia, Sapato..." value={descricao} onChange={e => setDescricao(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-input" value={categoria} onChange={e => setCategoria(e.target.value)} required>
              <option value="">Selecione...</option>
              {CATEGORIAS.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="nature-selector-container">
            <label className="form-label">Natureza do Gasto</label>
            <div className="nature-buttons">
              <div className={`nature-btn ${natureza === 'EMPRESA' ? 'active-empresa' : ''}`} onClick={() => setNatureza('EMPRESA')}>
                <span className="nature-icon">🏢</span>
                <span className="nature-label">Custo Empresa</span>
              </div>
              <div className={`nature-btn ${natureza === 'PESSOAL' ? 'active-pessoal' : ''}`} onClick={() => setNatureza('PESSOAL')}>
                <span className="nature-icon">👤</span>
                <span className="nature-label">Custo Pessoal</span>
              </div>
            </div>
            {natureza === 'PESSOAL' && (
              <div className={`wife-toggle-container ${isEsposa ? 'active-wife' : ''}`} onClick={() => setIsEsposa(!isEsposa)}>
                <div className="wife-toggle-checkbox">{isEsposa ? '✅' : '⬜'}</div>
                <div className="wife-toggle-text">👩 Gasto da Esposa? <span className="wife-hint">(Identifica separadamente)</span></div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">💳 Método de Pagamento</label>
            <select className="form-input" value={metodoPagamento} onChange={e => setMetodoPagamento(e.target.value)}>
              <option value="">Selecione...</option>
              {METODOS_PAGAMENTO.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {metodoPagamento === 'Cartão de Crédito' && (
            <div className="form-group" style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Qual Cartão?</label>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="checkbox" 
                  id="cartaoTerceiro" 
                  checked={isCartaoTerceiro} 
                  onChange={(e) => setIsCartaoTerceiro(e.target.checked)} 
                  style={{ width: '20px', height: '20px' }}
                />
                <label htmlFor="cartaoTerceiro" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>Usar cartão de terceiro (ex: Mãe, Cônjuge)</label>
              </div>

              {isCartaoTerceiro ? (
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Nome do dono do cartão (Ex: Cartão da Mãe)" 
                  value={nomeCartaoTerceiro} 
                  onChange={e => setNomeCartaoTerceiro(e.target.value)} 
                  required 
                />
              ) : (
                <select className="form-input" value={cartaoId} onChange={e => setCartaoId(e.target.value)} required={!isCartaoTerceiro}>
                  <option value="">Selecione um dos seus cartões...</option>
                  {cartoes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({c.bandeira})</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Data</label>
            <input type="date" className="form-input" value={data} onChange={e => setData(e.target.value)} required />
          </div>

          {!editandoId && (
            <div className="form-group form-group-toggle" style={{ gridColumn: '1 / -1' }}>
              <label className="toggle-label">
                <span className="toggle-text">
                  💳 Compra Parcelada?
                  <span className="toggle-hint">{parcelado ? 'Criar parcelas' : 'À vista'}</span>
                </span>
                <div className={`toggle-switch ${parcelado ? 'toggle-on' : ''}`} onClick={() => setParcelado(!parcelado)}>
                  <div className="toggle-knob" />
                </div>
              </label>
            </div>
          )}

          {editandoId && (
            <div className="form-group form-group-toggle" style={{ gridColumn: '1 / -1' }}>
              <label className="toggle-label">
                <span className="toggle-text">📋 Já é uma parcela em andamento?</span>
                <div className={`toggle-switch ${parcelado ? 'toggle-on' : ''}`} onClick={() => setParcelado(!parcelado)}>
                  <div className="toggle-knob" />
                </div>
              </label>
            </div>
          )}

          {parcelado && !editandoId && (
            <>
              <div className="form-group">
                <label className="form-label">💰 Valor Total (R$)</label>
                <input type="number" className="form-input" step="0.01" min="0.01" value={valorTotal} onChange={e => setValorTotal(e.target.value)} required={parcelado} />
              </div>
              <div className="form-group">
                <label className="form-label">🔢 Parcelas</label>
                <input type="number" className="form-input" min="2" max="48" value={totalParcelas} onChange={e => setTotalParcelas(e.target.value)} required={parcelado} />
              </div>
            </>
          )}

          {!parcelado && (
            <div className="form-group">
              <label className="form-label">Valor (R$)</label>
              <input type="number" className="form-input" step="0.01" min="0.01" value={valor} onChange={e => setValor(e.target.value)} required />
            </div>
          )}

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Observação (opcional)</label>
            <input type="text" className="form-input" value={observacao} onChange={e => setObservacao(e.target.value)} />
          </div>

          <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : editandoId ? '💾 Salvar Alteração' : parcelado ? `💳 Criar ${totalParcelas || '?'}x Parcelas` : '➕ Adicionar Gasto'}
            </button>
            {editandoId && <button type="button" className="btn-secondary" onClick={limparFormulario}>Cancelar</button>}
          </div>
        </form>
      </div>

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
            <span className="metric-card-value" style={{ color: '#6c5ce7' }}>{resumo.quantidade}</span>
          </div>
        </div>
      </div>

      {dadosGrafico.length > 0 && (
        <div className="card">
          <h3 className="card-title">📊 Total por Categoria</h3>
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer>
              <BarChart data={dadosGrafico} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="categoria" tick={{ fill: '#a0a0b8', fontSize: 11 }} angle={-45} textAnchor="end" interval={0} height={80} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
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

      <div className="card">
        <h3 className="card-title">📋 Gastos de {MESES[mesAtual]}</h3>
        {carregando ? (
          <div className="loading-state">Carregando gastos...</div>
        ) : gastosFiltrados.length === 0 ? (
          <div className="empty-state">Nenhum gasto registrado neste mês.</div>
        ) : (
          <div className="expense-list">
            {gastosFiltrados.map(gasto => {
              let tagNaturezaCor = gasto.natureza === 'EMPRESA' ? '#a29bfe' : '#74b9ff';
              let tagNaturezaIcone = gasto.natureza === 'EMPRESA' ? '🏢' : '👤';
              if (gasto.isEsposa) { tagNaturezaCor = '#fd79a8'; tagNaturezaIcone = '👩'; }

              return (
                <div key={gasto.id} className={`expense-item glass-card${gasto.pago ? ' expense-paid' : ''}`}>
                  <div className="expense-info">
                    <div className="expense-header-row">
                      <div className="expense-item-left" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="expense-date">{formatarData(gasto.data)}</span>
                        <span className="expense-descricao" style={{ textDecoration: gasto.pago ? 'line-through' : 'none' }}>
                          {gasto.descricao}
                          {gasto.parcelado && <span className="badge-parcela">{gasto.parcelaAtual}/{gasto.totalParcelas}</span>}
                        </span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="expense-categoria-badge" style={{ background: CORES_CATEGORIAS[gasto.categoria] || '#b2bec3' }}>{gasto.categoria}</span>
                          <span className="expense-categoria-badge" style={{ backgroundColor: tagNaturezaCor, color: '#111' }}>
                            {tagNaturezaIcone} {gasto.natureza === 'EMPRESA' ? 'Empresa' : (gasto.isEsposa ? 'Esposa' : 'Pessoal')}
                          </span>
                        </div>
                      </div>
                      <div className="expense-item-right" style={{ textAlign: 'right' }}>
                        <span className="expense-valor" style={{ color: gasto.pago ? 'var(--text-secondary)' : '#ff6b6b' }}>{formatarMoeda(gasto.valor)}</span>
                        {gasto.pago ? (
                          <div style={{ fontSize: '0.8rem', color: '#00d4aa', fontWeight: 'bold' }}>✅ Pago</div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: '#ff6b6b' }}>Pendente</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="expense-actions" style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                    <button
                      className={`action-btn${gasto.pago ? ' action-undo' : ' action-check'}`}
                      onClick={() => acionarPagamento(gasto)}
                      title={gasto.pago ? 'Desfazer Pagamento' : 'Pagar com Automação'}
                    >
                      {gasto.pago ? '↩' : '✓'}
                    </button>
                    <button className="action-btn action-edit" onClick={() => iniciarEdicao(gasto)}>✎</button>
                    <button className="action-btn action-delete" onClick={() => excluirGasto(gasto)}>✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirmarExclusao && (
        <div className="modal-overlay" onClick={() => setConfirmarExclusao(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">🗑️ Excluir Parcela</h3>
            <p className="modal-descricao"><strong>{confirmarExclusao.descricao}</strong> — Parcela {confirmarExclusao.parcelaAtual}/{confirmarExclusao.totalParcelas}</p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-danger" onClick={async () => { await excluirGastoUnico(confirmarExclusao.id); setConfirmarExclusao(null); }}>Excluir Apenas Esta Parcela</button>
              <button className="modal-btn modal-btn-warning" onClick={async () => { await excluirParcelasRestantes(confirmarExclusao); setConfirmarExclusao(null); }}>Excluir Esta e as Restantes</button>
              <button className="modal-btn modal-btn-danger-full" onClick={async () => { await excluirTodasParcelas(confirmarExclusao.grupoParcelamento); setConfirmarExclusao(null); }}>Excluir Todas as Parcelas</button>
              <button className="modal-btn modal-btn-cancel" onClick={() => setConfirmarExclusao(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {pagamentoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div className="section-card" style={{ width: '90%', maxWidth: '450px', background: '#16162a', padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.3rem', color: '#fff' }}>✅ Confirmar Pagamento</h3>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Pagando: <strong style={{ color: '#fff' }}>{pagamentoModal.descricao}</strong></div>
              <div style={{ fontSize: '1.4rem', color: '#ff6b6b', fontWeight: 'bold', marginTop: '8px' }}>{formatarMoeda(pagamentoModal.valor)}</div>
            </div>

            <form onSubmit={confirmarPagamento}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '1rem' }}>🧠 De onde esse dinheiro vai sair?</label>
                <select className="form-input" required value={caixinhaFonte} onChange={e => setCaixinhaFonte(e.target.value)} style={{ background: '#0a0a16', padding: '12px' }}>
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
                    <option value="NENHUMA">❌ Já paguei por fora (Apenas dar baixa)</option>
                  </optgroup>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '14px' }} disabled={processandoPagamento || !caixinhaFonte}>
                  {processandoPagamento ? 'Processando...' : 'Confirmar'}
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
