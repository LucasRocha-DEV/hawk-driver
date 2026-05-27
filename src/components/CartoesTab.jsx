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
  serverTimestamp,
  writeBatch,
  increment
} from 'firebase/firestore';

const BANDEIRAS = ['Mastercard', 'Visa', 'Elo', 'Amex', 'Hipercard', 'Outra'];
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

export default function CartoesTab() {
  const { usuario } = useAuth();
  const agora = new Date();

  // Navegação de Fatura
  const [mesAtual, setMesAtual] = useState(agora.getMonth());
  const [anoAtual, setAnoAtual] = useState(agora.getFullYear());
  const faturaRefAtual = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;

  const [cartoes, setCartoes] = useState([]);
  const [cartaoSelecionadoId, setCartaoSelecionadoId] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Fatura Data
  const [despesasVariaveis, setDespesasVariaveis] = useState([]);
  const [despesasFixas, setDespesasFixas] = useState([]);
  const [saldos, setSaldos] = useState({});

  // Pagamento da Fatura Inteira (Rateio)
  const [pagamentoFaturaModal, setPagamentoFaturaModal] = useState(false);
  const [fonteEmpresa, setFonteEmpresa] = useState('');
  const [fontePessoal, setFontePessoal] = useState('');
  const [fonteEsposa, setFonteEsposa] = useState('');
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

  // Modal CRUD Cartão
  const [modalCartao, setModalCartao] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  
  const [nome, setNome] = useState('');
  const [bandeira, setBandeira] = useState('Mastercard');
  const [limiteTotal, setLimiteTotal] = useState('');
  const [diaFechamento, setDiaFechamento] = useState('');
  const [diaVencimento, setDiaVencimento] = useState('');
  const [cor, setCor] = useState('#8A05BE');
  const [salvando, setSalvando] = useState(false);

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

  // Carregar Cartões
  useEffect(() => {
    if (!usuario) return;
    setCarregando(true);
    const colRef = collection(db, 'usuarios', usuario.uid, 'cartoes');
    
    const unsub = onSnapshot(colRef, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCartoes(lista);
      if (lista.length > 0 && !cartaoSelecionadoId) {
        setCartaoSelecionadoId(lista[0].id);
      } else if (lista.length === 0) {
        setCartaoSelecionadoId(null);
      }
      setCarregando(false);
    });

    const unsubSaldos = onSnapshot(doc(db, 'usuarios', usuario.uid, 'saldos', 'atual'), (docSnap) => {
      if (docSnap.exists()) setSaldos(docSnap.data());
    });

    return () => {
      unsub();
      unsubSaldos();
    };
  }, [usuario]);

  // Carregar Fatura do Cartão Selecionado
  useEffect(() => {
    if (!usuario || !cartaoSelecionadoId) {
      setDespesasVariaveis([]);
      setDespesasFixas([]);
      return;
    }

    // Compras variáveis dessa fatura
    const variaveisRef = collection(db, 'usuarios', usuario.uid, 'despesas_variaveis');
    const qVariaveis = query(
      variaveisRef,
      where('cartaoId', '==', cartaoSelecionadoId),
      where('faturaRef', '==', faturaRefAtual)
    );
    const unsubVar = onSnapshot(qVariaveis, (snap) => {
      setDespesasVariaveis(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Assinaturas/Fixas atreladas a esse cartão
    const fixasRef = collection(db, 'usuarios', usuario.uid, 'despesas_fixas');
    const qFixas = query(fixasRef, where('cartaoId', '==', cartaoSelecionadoId));
    const unsubFixas = onSnapshot(qFixas, (snap) => {
      setDespesasFixas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubVar();
      unsubFixas();
    };
  }, [usuario, cartaoSelecionadoId, faturaRefAtual]);

  const cartaoSelecionado = useMemo(() => {
    return cartoes.find(c => c.id === cartaoSelecionadoId);
  }, [cartoes, cartaoSelecionadoId]);

  const pendenciasFatura = useMemo(() => {
    const pendentesVariaveis = despesasVariaveis.filter(d => !d.pago);
    const pendentesFixas = despesasFixas.filter(d => !(d.pagoPorMes && d.pagoPorMes[faturaRefAtual]));
    
    let totalEmpresa = 0;
    let totalPessoal = 0;
    let totalEsposa = 0;
    
    [...pendentesVariaveis, ...pendentesFixas].forEach(d => {
      const val = Number(d.valor);
      if (d.natureza === 'EMPRESA') {
        totalEmpresa += val;
      } else if (d.isEsposa) {
        totalEsposa += val;
      } else {
        totalPessoal += val;
      }
    });

    const total = totalEmpresa + totalPessoal + totalEsposa;
    
    return {
      variaveis: pendentesVariaveis,
      fixas: pendentesFixas,
      total,
      totalEmpresa,
      totalPessoal,
      totalEsposa
    };
  }, [despesasVariaveis, despesasFixas, faturaRefAtual]);

  const totaisFatura = useMemo(() => {
    const totalFixas = despesasFixas.reduce((acc, curr) => acc + Number(curr.valor), 0);
    const totalVariaveis = despesasVariaveis.reduce((acc, curr) => acc + Number(curr.valor), 0);
    const totalFatura = totalFixas + totalVariaveis;
    const limite = cartaoSelecionado ? Number(cartaoSelecionado.limiteTotal) : 0;
    const limiteDisponivel = limite - totalFatura;
    const percentualUso = limite > 0 ? (totalFatura / limite) * 100 : 0;

    return { totalFixas, totalVariaveis, totalFatura, limite, limiteDisponivel, percentualUso };
  }, [despesasFixas, despesasVariaveis, cartaoSelecionado]);

  const pagarFaturaTotal = async (e) => {
    e.preventDefault();
    if (!usuario || !cartaoSelecionado) return;
    
    // Validar se as fontes necessárias foram selecionadas
    if (pendenciasFatura.totalEmpresa > 0 && !fonteEmpresa) return;
    if (pendenciasFatura.totalPessoal > 0 && !fontePessoal) return;
    if (pendenciasFatura.totalEsposa > 0 && !fonteEsposa) return;

    setProcessandoPagamento(true);
    try {
      const batch = writeBatch(db);

      pendenciasFatura.variaveis.forEach(d => {
        const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_variaveis', d.id);
        batch.update(docRef, { pago: true });
      });

      pendenciasFatura.fixas.forEach(d => {
        const docRef = doc(db, 'usuarios', usuario.uid, 'despesas_fixas', d.id);
        const novoPagoPorMes = { ...(d.pagoPorMes || {}) };
        novoPagoPorMes[faturaRefAtual] = true;
        batch.update(docRef, { pagoPorMes: novoPagoPorMes });
      });

      const descontosPorCaixinha = {};
      const registrarDesconto = (fonte, valor) => {
        if (fonte && fonte !== 'NENHUMA' && valor > 0) {
          descontosPorCaixinha[fonte] = (descontosPorCaixinha[fonte] || 0) + valor;
        }
      };

      registrarDesconto(fonteEmpresa, pendenciasFatura.totalEmpresa);
      registrarDesconto(fontePessoal, pendenciasFatura.totalPessoal);
      registrarDesconto(fonteEsposa, pendenciasFatura.totalEsposa);

      if (Object.keys(descontosPorCaixinha).length > 0) {
        const saldoRef = doc(db, 'usuarios', usuario.uid, 'saldos', 'atual');
        const descontosObj = {};
        Object.entries(descontosPorCaixinha).forEach(([caixinha, valor]) => {
          descontosObj[caixinha] = increment(-valor);
        });
        batch.set(saldoRef, { ...descontosObj, atualizadoEm: serverTimestamp() }, { merge: true });

        Object.entries(descontosPorCaixinha).forEach(([caixinha, valor]) => {
          let nomeCaixinha = caixinha.charAt(0).toUpperCase() + caixinha.slice(1);
          if (caixinha === 'saldoConta') nomeCaixinha = 'Conta Principal';
          
          const transacaoRef = doc(collection(db, 'usuarios', usuario.uid, 'transacoes_patrimonio'));
          batch.set(transacaoRef, {
            caixinhaId: caixinha,
            caixinhaNome: nomeCaixinha,
            tipo: 'SAIDA',
            valor: valor,
            motivo: `Pgto Fatura ${cartaoSelecionado.nome} (${faturaRefAtual})`,
            data: new Date().toISOString().split('T')[0],
            criadoEm: serverTimestamp()
          });
        });
      }

      // Selo de memória de Fatura Paga
      const faturasPagasRef = doc(db, 'usuarios', usuario.uid, 'faturas_pagas', `${cartaoSelecionado.id}_${faturaRefAtual}`);
      batch.set(faturasPagasRef, {
        pago: true,
        faturaRef: faturaRefAtual,
        cartaoId: cartaoSelecionado.id,
        atualizadoEm: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      setPagamentoFaturaModal(false);
      alert('🎉 Fatura paga e rateada com sucesso! Todas as despesas vinculadas ganharam o ✔️ de pago.');
      setFonteEmpresa('');
      setFontePessoal('');
      setFonteEsposa('');
    } catch (err) {
      console.error(err);
      alert('Erro ao pagar fatura.');
    }
    setProcessandoPagamento(false);
  };

  const limparFormulario = () => {
    setNome('');
    setBandeira('Mastercard');
    setLimiteTotal('');
    setDiaFechamento('');
    setDiaVencimento('');
    setCor('#8A05BE');
    setEditandoId(null);
  };

  const iniciarEdicao = (cartao) => {
    setNome(cartao.nome);
    setBandeira(cartao.bandeira);
    setLimiteTotal(String(cartao.limiteTotal));
    setDiaFechamento(String(cartao.diaFechamento));
    setDiaVencimento(String(cartao.diaVencimento));
    setCor(cartao.cor || '#8A05BE');
    setEditandoId(cartao.id);
    setModalCartao(true);
  };

  const salvarCartao = async (e) => {
    e.preventDefault();
    if (!usuario) return;
    setSalvando(true);
    
    const dados = {
      nome,
      bandeira,
      limiteTotal: parseFloat(limiteTotal),
      diaFechamento: parseInt(diaFechamento, 10),
      diaVencimento: parseInt(diaVencimento, 10),
      cor
    };

    try {
      if (editandoId) {
        await updateDoc(doc(db, 'usuarios', usuario.uid, 'cartoes', editandoId), {
          ...dados,
          atualizadoEm: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'usuarios', usuario.uid, 'cartoes'), {
          ...dados,
          criadoEm: serverTimestamp()
        });
      }
      setModalCartao(false);
      limparFormulario();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar cartão.');
    }
    setSalvando(false);
  };

  const excluirCartao = async (id) => {
    if (!window.confirm('Tem certeza? Isso não apagará as despesas vinculadas, mas elas perderão a referência do cartão.')) return;
    try {
      await deleteDoc(doc(db, 'usuarios', usuario.uid, 'cartoes', id));
      if (cartaoSelecionadoId === id) setCartaoSelecionadoId(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="tab-content">
      <div className="patrimonio-header">
        <h2 className="patrimonio-titulo">💳 Cartões de Crédito</h2>
        <p className="patrimonio-subtitulo">
          Gerencie seus limites, assinaturas fixas e faturas em um só lugar.
        </p>
      </div>

      {/* Cartões Horizontais */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '8px' }}>
        {cartoes.map(cartao => (
          <div 
            key={cartao.id}
            onClick={() => setCartaoSelecionadoId(cartao.id)}
            style={{
              minWidth: '220px',
              padding: '16px',
              borderRadius: '16px',
              background: cartaoSelecionadoId === cartao.id ? `linear-gradient(135deg, ${cartao.cor}, #111)` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${cartaoSelecionadoId === cartao.id ? cartao.cor : 'rgba(255,255,255,0.1)'}`,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.1rem' }}>{cartao.nome}</span>
              <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '12px' }}>{cartao.bandeira}</span>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Limite Total</div>
              <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>{formatarMoeda(cartao.limiteTotal)}</div>
            </div>
          </div>
        ))}
        
        <div 
          onClick={() => { limparFormulario(); setModalCartao(true); }}
          style={{
            minWidth: '220px',
            padding: '16px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.2)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-secondary)'
          }}
        >
          <span style={{ fontSize: '2rem' }}>+</span>
          <span>Adicionar Cartão</span>
        </div>
      </div>

      {cartaoSelecionado && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="month-navigation" style={{ margin: 0 }}>
              <button className="month-nav-btn" onClick={mesAnterior}>‹</button>
              <span className="month-nav-label">Fatura {MESES[mesAtual]} {anoAtual}</span>
              <button className="month-nav-btn" onClick={mesSeguinte}>›</button>
            </div>
            <div>
              {pendenciasFatura.total > 0 && (
                <button className="btn-primary" onClick={() => setPagamentoFaturaModal(true)} style={{ marginRight: '16px' }}>💳 Pagar Fatura</button>
              )}
              <button className="btn-sm" onClick={() => iniciarEdicao(cartaoSelecionado)} style={{ marginRight: '8px' }}>✎ Editar</button>
              <button className="btn-sm" onClick={() => excluirCartao(cartaoSelecionado.id)} style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b' }}>✕ Excluir</button>
            </div>
          </div>

          {/* Resumo da Fatura */}
          <div className="card" style={{ borderTop: `4px solid ${cartaoSelecionado.cor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total da Fatura</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff6b6b' }}>{formatarMoeda(totaisFatura.totalFatura)}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Vence em: <strong>Dia {cartaoSelecionado.diaVencimento}</strong> (Fecha dia {cartaoSelecionado.diaFechamento})
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Limite Disponível</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#00d4aa' }}>{formatarMoeda(totaisFatura.limiteDisponivel)}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>de {formatarMoeda(totaisFatura.limite)}</div>
              </div>
            </div>

            {/* Barra de Uso */}
            <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{ width: `${Math.min(100, totaisFatura.percentualUso)}%`, height: '100%', background: totaisFatura.percentualUso > 90 ? '#ff6b6b' : cartaoSelecionado.cor, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              {totaisFatura.percentualUso.toFixed(1)}% do limite utilizado
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {/* Fixas / Assinaturas */}
            <div className="card">
              <h3 className="card-title">🔄 Assinaturas & Recorrentes</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Gerenciado na aba de Despesas Fixas.
              </p>
              {despesasFixas.length === 0 ? (
                <div className="empty-state">Nenhuma assinatura vinculada.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {despesasFixas.map(fixa => {
                    const pago = fixa.pagoPorMes && fixa.pagoPorMes[faturaRefAtual];
                    return (
                      <div key={fixa.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', textDecoration: pago ? 'line-through' : 'none' }}>
                            {fixa.descricao}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {fixa.categoria}
                            {pago && <span style={{ marginLeft: '8px', color: '#00d4aa' }}>✅ Pago</span>}
                          </div>
                        </div>
                        <div style={{ fontWeight: 'bold', color: pago ? 'var(--text-secondary)' : '#ff6b6b' }}>
                          {formatarMoeda(fixa.valor)}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>Total Assinaturas</span>
                    <span>{formatarMoeda(totaisFatura.totalFixas)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Variáveis */}
            <div className="card">
              <h3 className="card-title">🛒 Compras da Fatura</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Adicionado na aba de Gastos Variáveis.
              </p>
              {despesasVariaveis.length === 0 ? (
                <div className="empty-state">Nenhuma compra nesta fatura.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {despesasVariaveis.map(compra => {
                    const pago = compra.pago;
                    return (
                      <div key={compra.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', textDecoration: pago ? 'line-through' : 'none' }}>
                            {compra.descricao} {compra.parcelado && `(${compra.parcelaAtual}/${compra.totalParcelas})`}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {formatarData(compra.data)} • {compra.categoria}
                            {pago && <span style={{ marginLeft: '8px', color: '#00d4aa' }}>✅ Pago</span>}
                          </div>
                        </div>
                        <div style={{ fontWeight: 'bold', color: pago ? 'var(--text-secondary)' : '#ff6b6b' }}>
                          {formatarMoeda(compra.valor)}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>Total Compras</span>
                    <span>{formatarMoeda(totaisFatura.totalVariaveis)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal CRUD Cartão */}
      {modalCartao && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '90%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="card-title">{editandoId ? '✎ Editar Cartão' : '➕ Novo Cartão'}</h3>
            <form onSubmit={salvarCartao} className="form-grid">
              
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Nome do Cartão (Apelido)</label>
                <input type="text" className="form-input" required value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Nubank, Inter..." />
              </div>

              <div className="form-group">
                <label className="form-label">Bandeira</label>
                <select className="form-input" required value={bandeira} onChange={e => setBandeira(e.target.value)}>
                  {BANDEIRAS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Limite Total (R$)</label>
                <input type="number" step="0.01" className="form-input" required value={limiteTotal} onChange={e => setLimiteTotal(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Dia de Fechamento</label>
                <input type="number" min="1" max="31" className="form-input" required value={diaFechamento} onChange={e => setDiaFechamento(e.target.value)} placeholder="Ex: 17" />
              </div>

              <div className="form-group">
                <label className="form-label">Dia de Vencimento</label>
                <input type="number" min="1" max="31" className="form-input" required value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)} placeholder="Ex: 24" />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Cor de Identificação</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['#8A05BE', '#FF7A00', '#202020', '#1A73E8', '#00D4AA', '#FF6B6B'].map(c => (
                    <div 
                      key={c}
                      onClick={() => setCor(c)}
                      style={{ 
                        width: '36px', height: '36px', borderRadius: '50%', background: c,
                        cursor: 'pointer', border: cor === c ? '3px solid #fff' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="form-actions" style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                <button type="submit" className="btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar Cartão'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setModalCartao(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pagamento Fatura */}
      {pagamentoFaturaModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div className="section-card" style={{ width: '90%', maxWidth: '450px', background: '#16162a', padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.3rem', color: '#fff' }}>💳 Pagar Fatura</h3>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Fatura {cartaoSelecionado?.nome} ({MESES[mesAtual]} {anoAtual})</div>
              <div style={{ fontSize: '1.4rem', color: '#ff6b6b', fontWeight: 'bold', marginTop: '8px' }}>{formatarMoeda(pendenciasFatura.total)} pendentes</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Será dado baixa em {pendenciasFatura.variaveis.length} compras variáveis e {pendenciasFatura.fixas.length} assinaturas.
              </p>
            </div>

            <form onSubmit={pagarFaturaTotal}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pendenciasFatura.totalEmpresa > 0 && (
                  <div className="form-group" style={{ margin: 0, padding: '12px', background: 'rgba(9, 132, 227, 0.1)', borderLeft: '4px solid #0984e3', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: '#0984e3' }}>🏢 Parte da Empresa</span>
                      <span style={{ fontWeight: 'bold' }}>{formatarMoeda(pendenciasFatura.totalEmpresa)}</span>
                    </div>
                    <select className="form-input" required value={fonteEmpresa} onChange={e => setFonteEmpresa(e.target.value)} style={{ background: '#0a0a16', fontSize: '0.9rem' }}>
                      <option value="" disabled>Escolha a caixinha...</option>
                      <option value="empresa">🏢 Empresa (Saldo: {formatarMoeda(saldos.empresa)})</option>
                      <option value="manutencao">🔧 Manutenção (Saldo: {formatarMoeda(saldos.manutencao)})</option>
                      <option value="saldoConta">🏦 Conta Principal (Saldo: {formatarMoeda(saldos.saldoConta)})</option>
                      <option value="NENHUMA">❌ Já pago / Não descontar</option>
                    </select>
                  </div>
                )}

                {pendenciasFatura.totalPessoal > 0 && (
                  <div className="form-group" style={{ margin: 0, padding: '12px', background: 'rgba(255, 107, 107, 0.1)', borderLeft: '4px solid #ff6b6b', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: '#ff6b6b' }}>👤 Parte Pessoal</span>
                      <span style={{ fontWeight: 'bold' }}>{formatarMoeda(pendenciasFatura.totalPessoal)}</span>
                    </div>
                    <select className="form-input" required value={fontePessoal} onChange={e => setFontePessoal(e.target.value)} style={{ background: '#0a0a16', fontSize: '0.9rem' }}>
                      <option value="" disabled>Escolha a caixinha...</option>
                      <option value="contas">💳 Contas (Saldo: {formatarMoeda(saldos.contas)})</option>
                      <option value="livre">💸 Livre - Lazer (Saldo: {formatarMoeda(saldos.livre)})</option>
                      <option value="emergencia">🚨 Reserva (Saldo: {formatarMoeda(saldos.emergencia)})</option>
                      <option value="saldoConta">🏦 Conta Principal (Saldo: {formatarMoeda(saldos.saldoConta)})</option>
                      <option value="NENHUMA">❌ Já pago / Não descontar</option>
                    </select>
                  </div>
                )}

                {pendenciasFatura.totalEsposa > 0 && (
                  <div className="form-group" style={{ margin: 0, padding: '12px', background: 'rgba(253, 121, 168, 0.1)', borderLeft: '4px solid #fd79a8', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: '#fd79a8' }}>👩‍❤️‍👨 Parte da Esposa</span>
                      <span style={{ fontWeight: 'bold' }}>{formatarMoeda(pendenciasFatura.totalEsposa)}</span>
                    </div>
                    <select className="form-input" required value={fonteEsposa} onChange={e => setFonteEsposa(e.target.value)} style={{ background: '#0a0a16', fontSize: '0.9rem' }}>
                      <option value="" disabled>Escolha a caixinha...</option>
                      <option value="saldoConta">🏦 Conta Principal (Saldo: {formatarMoeda(saldos.saldoConta)})</option>
                      <option value="NENHUMA">❌ Já pago / Ela pagou por fora</option>
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '14px', fontSize: '1rem' }} disabled={processandoPagamento || (pendenciasFatura.totalEmpresa > 0 && !fonteEmpresa) || (pendenciasFatura.totalPessoal > 0 && !fontePessoal) || (pendenciasFatura.totalEsposa > 0 && !fonteEsposa)}>
                  {processandoPagamento ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setPagamentoFaturaModal(false)} style={{ padding: '14px 24px' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
