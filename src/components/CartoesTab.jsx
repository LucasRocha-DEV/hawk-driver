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
import { formatarMoeda, formatarData, MESES, nomeCaixinha } from '../utils/helpers';
import NavegacaoMes from './NavegacaoMes';
import { usePreferencias } from '../contexts/PreferenciasContext';

const BANDEIRAS = ['Mastercard', 'Visa', 'Elo', 'Amex', 'Hipercard', 'Outra'];

export default function CartoesTab() {
  const { usuario } = useAuth();
  const { rotuloEsposa, emojiEsposa } = usePreferencias();
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
          let caixinhaNomeBonito = nomeCaixinha(caixinha);
          
          const transacaoRef = doc(collection(db, 'usuarios', usuario.uid, 'transacoes_patrimonio'));
          batch.set(transacaoRef, {
            caixinhaId: caixinha,
            caixinhaNome: caixinhaNomeBonito,
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
    <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-hawk-text tracking-tight mb-2">💳 Cartões de Crédito</h2>
        <p className="text-hawk-muted text-sm max-w-lg mx-auto">
          Gerencie seus limites, assinaturas fixas e faturas em um só lugar.
        </p>
      </div>

      {/* Cartões Horizontais */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 mb-2 -mx-3 px-3 md:mx-0 md:px-0 scrollbar-none snap-x snap-mandatory">
        {cartoes.map(cartao => (
          <div
            key={cartao.id}
            onClick={() => setCartaoSelecionadoId(cartao.id)}
            className={`min-w-[200px] sm:min-w-[240px] snap-center p-4 sm:p-5 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col gap-4 border shadow-card ${cartaoSelecionadoId === cartao.id ? 'scale-100 opacity-100' : 'scale-95 opacity-70 hover:opacity-100'}`}
            style={{
              background: cartaoSelecionadoId === cartao.id ? `linear-gradient(135deg, ${cartao.cor}, #111)` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${cartaoSelecionadoId === cartao.id ? cartao.cor : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-white text-lg">{cartao.nome}</span>
              <span className="text-xs bg-white/10 px-2 py-1 rounded-full font-medium">{cartao.bandeira}</span>
            </div>
            <div>
              <div className="text-xs text-white/60 mb-0.5 font-medium uppercase tracking-wider">Limite Total</div>
              <div className="text-2xl text-white font-black">{formatarMoeda(cartao.limiteTotal)}</div>
            </div>
          </div>
        ))}
        
        <div 
          onClick={() => { limparFormulario(); setModalCartao(true); }}
          className="min-w-[160px] sm:min-w-[200px] snap-center p-4 sm:p-5 rounded-2xl bg-white/5 border border-dashed border-white/20 cursor-pointer flex flex-col justify-center items-center gap-2 text-hawk-muted hover:text-white hover:bg-white/10 hover:border-white/40 transition-all shadow-card"
        >
          <span className="text-3xl font-light mb-1">+</span>
          <span className="font-bold text-sm">Adicionar Cartão</span>
        </div>
      </div>

      {cartaoSelecionado && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4">
            <NavegacaoMes
              mesAtual={mesAtual}
              anoAtual={anoAtual}
              setMesAtual={setMesAtual}
              setAnoAtual={setAnoAtual}
            />
            <div className="w-full md:w-auto flex flex-wrap gap-2">
              {pendenciasFatura.total > 0 && (
                <button className="w-full md:w-auto px-4 py-3 md:py-2 font-bold text-sm text-hawk-bg bg-hawk-purple rounded-xl hover:bg-hawk-purple/90 transition-colors shadow-lg shadow-hawk-purple/20 active:scale-[0.98]" onClick={() => setPagamentoFaturaModal(true)}>
                  💳 Pagar Fatura
                </button>
              )}
              <button className="flex-1 md:flex-none px-4 py-3 md:py-2 font-bold text-sm text-hawk-text bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors active:scale-[0.98]" onClick={() => iniciarEdicao(cartaoSelecionado)}>
                ✎ Editar
              </button>
              <button className="flex-1 md:flex-none px-4 py-3 md:py-2 font-bold text-sm text-hawk-red bg-hawk-red/10 border border-hawk-red/20 rounded-xl hover:bg-hawk-red/20 transition-colors active:scale-[0.98]" onClick={() => excluirCartao(cartaoSelecionado.id)}>
                ✕ Excluir
              </button>
            </div>
          </div>

          {/* Resumo da Fatura */}
          <div className="rounded-3xl border border-glass-border bg-hawk-card p-5 sm:p-6 md:p-8 shadow-card-hover relative overflow-hidden" style={{ borderTop: `4px solid ${cartaoSelecionado.cor}` }}>
            <div className="absolute top-0 right-0 p-5 sm:p-8 opacity-5 pointer-events-none">
              <span className="text-7xl sm:text-9xl">💳</span>
            </div>

            <div className="relative z-10 flex flex-col md:flex-row justify-between gap-5 md:gap-6 mb-6 md:mb-8">
              <div>
                <div className="text-xs font-bold text-hawk-muted uppercase tracking-widest mb-1">Total da Fatura</div>
                <div className="text-3xl sm:text-4xl md:text-5xl font-black text-hawk-red drop-shadow-[0_0_10px_rgba(255,107,107,0.3)] break-words">{formatarMoeda(totaisFatura.totalFatura)}</div>
                <div className="text-xs text-hawk-muted mt-2 font-medium">
                  Vence em: <strong className="text-hawk-text">Dia {cartaoSelecionado.diaVencimento}</strong> (Fecha dia {cartaoSelecionado.diaFechamento})
                </div>
              </div>
              <div className="md:text-right">
                <div className="text-xs font-bold text-hawk-muted uppercase tracking-widest mb-1">Limite Disponível</div>
                <div className="text-2xl md:text-3xl font-bold text-hawk-green">{formatarMoeda(totaisFatura.limiteDisponivel)}</div>
                <div className="text-xs text-hawk-muted mt-1">de {formatarMoeda(totaisFatura.limite)}</div>
              </div>
            </div>

            {/* Barra de Uso */}
            <div className="relative z-10">
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${Math.min(100, totaisFatura.percentualUso)}%`, background: totaisFatura.percentualUso > 90 ? '#ff6b6b' : cartaoSelecionado.cor, boxShadow: `0 0 10px ${totaisFatura.percentualUso > 90 ? 'rgba(255,107,107,0.5)' : 'rgba(255,255,255,0.2)'}` }} 
                />
              </div>
              <div className="text-xs font-bold text-hawk-muted text-center tracking-wide">
                {totaisFatura.percentualUso.toFixed(1)}% do limite utilizado
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fixas / Assinaturas */}
            <div className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card flex flex-col">
              <h3 className="text-lg font-bold text-hawk-text mb-1">🔄 Assinaturas & Recorrentes</h3>
              <p className="text-xs text-hawk-muted mb-4 pb-4 border-b border-white/5">Gerenciado na aba de Despesas Fixas.</p>
              
              <div className="flex-1">
                {despesasFixas.length === 0 ? (
                  <div className="text-center p-6 bg-white/5 rounded-xl border border-dashed border-white/10 text-hawk-muted text-sm italic">Nenhuma assinatura vinculada.</div>
                ) : (
                  <div className="space-y-3">
                    {despesasFixas.map(fixa => {
                      const pago = fixa.pagoPorMes && fixa.pagoPorMes[faturaRefAtual];
                      return (
                        <div key={fixa.id} className="flex justify-between items-center p-3.5 bg-hawk-bg/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex flex-col gap-1">
                            <span className={`font-bold text-sm ${pago ? 'text-hawk-muted line-through' : 'text-hawk-text'}`}>
                              {fixa.descricao}
                            </span>
                            <span className="text-[10px] text-hawk-muted font-medium flex items-center gap-2">
                              <span className="bg-white/5 px-2 py-0.5 rounded text-hawk-text">{fixa.categoria}</span>
                              {pago && <span className="text-hawk-green flex items-center gap-1"><span>✅</span> Pago</span>}
                            </span>
                          </div>
                          <span className={`font-black tracking-tight ${pago ? 'text-hawk-muted' : 'text-hawk-red'}`}>
                            {formatarMoeda(fixa.valor)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {despesasFixas.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center font-black">
                  <span className="text-hawk-muted uppercase tracking-widest text-xs">Total Assinaturas</span>
                  <span className="text-hawk-text text-lg">{formatarMoeda(totaisFatura.totalFixas)}</span>
                </div>
              )}
            </div>

            {/* Variáveis */}
            <div className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card flex flex-col">
              <h3 className="text-lg font-bold text-hawk-text mb-1">🛒 Compras da Fatura</h3>
              <p className="text-xs text-hawk-muted mb-4 pb-4 border-b border-white/5">Adicionado na aba de Gastos Variáveis.</p>
              
              <div className="flex-1">
                {despesasVariaveis.length === 0 ? (
                  <div className="text-center p-6 bg-white/5 rounded-xl border border-dashed border-white/10 text-hawk-muted text-sm italic">Nenhuma compra nesta fatura.</div>
                ) : (
                  <div className="space-y-3">
                    {despesasVariaveis.map(compra => {
                      const pago = compra.pago;
                      return (
                        <div key={compra.id} className="flex justify-between items-center p-3.5 bg-hawk-bg/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex flex-col gap-1">
                            <span className={`font-bold text-sm flex items-center gap-2 ${pago ? 'text-hawk-muted line-through' : 'text-hawk-text'}`}>
                              {compra.descricao} 
                              {compra.parcelado && <span className="bg-hawk-purple/20 text-hawk-purple border border-hawk-purple/30 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider leading-none">{compra.parcelaAtual}/{compra.totalParcelas}</span>}
                            </span>
                            <span className="text-[10px] text-hawk-muted font-medium flex items-center gap-2 flex-wrap">
                              <span className="bg-black/20 px-2 py-0.5 rounded border border-white/5">{formatarData(compra.data)}</span>
                              <span className="bg-white/5 px-2 py-0.5 rounded text-hawk-text">{compra.categoria}</span>
                              {pago && <span className="text-hawk-green flex items-center gap-1"><span>✅</span> Pago</span>}
                            </span>
                          </div>
                          <span className={`font-black tracking-tight ${pago ? 'text-hawk-muted' : 'text-hawk-red'}`}>
                            {formatarMoeda(compra.valor)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {despesasVariaveis.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center font-black">
                  <span className="text-hawk-muted uppercase tracking-widest text-xs">Total Compras</span>
                  <span className="text-hawk-text text-lg">{formatarMoeda(totaisFatura.totalVariaveis)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal CRUD Cartão */}
      {modalCartao && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 animate-fade-in">
          <div className="bg-hawk-card w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl border border-white/10">
            <h3 className="text-xl font-bold text-hawk-text mb-6 border-b border-white/5 pb-4">
              {editandoId ? '✏️ Editar Cartão' : '➕ Novo Cartão'}
            </h3>
            
            <form onSubmit={salvarCartao} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Nome do Cartão (Apelido)</label>
                <input 
                  type="text" 
                  className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors" 
                  required value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Nubank, Inter..." 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Bandeira</label>
                  <select 
                    className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors appearance-none" 
                    required value={bandeira} onChange={e => setBandeira(e.target.value)}
                  >
                    {BANDEIRAS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Limite Total (R$)</label>
                  <input 
                    type="number" step="0.01" 
                    className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors" 
                    required value={limiteTotal} onChange={e => setLimiteTotal(e.target.value)} 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Dia de Fechamento</label>
                  <input 
                    type="number" min="1" max="31" 
                    className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors" 
                    required value={diaFechamento} onChange={e => setDiaFechamento(e.target.value)} placeholder="Ex: 17" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Dia de Vencimento</label>
                  <input 
                    type="number" min="1" max="31" 
                    className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors" 
                    required value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)} placeholder="Ex: 24" 
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">Cor de Identificação</label>
                <div className="flex flex-wrap gap-3">
                  {['#8A05BE', '#FF7A00', '#202020', '#1A73E8', '#00D4AA', '#FF6B6B'].map(c => (
                    <div 
                      key={c}
                      onClick={() => setCor(c)}
                      className={`w-10 h-10 rounded-full cursor-pointer transition-transform ${cor === c ? 'scale-110 shadow-[0_0_0_2px_#fff] z-10' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-white/5">
                <button type="submit" className="flex-1 font-bold rounded-xl px-6 py-3 text-sm text-hawk-bg bg-hawk-purple hover:bg-hawk-purple/90 transition-all duration-200 active:scale-[0.98]" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar Cartão'}
                </button>
                <button type="button" className="px-6 py-3 font-bold text-sm text-hawk-text bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors" onClick={() => setModalCartao(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pagamento Fatura */}
      {pagamentoFaturaModal && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-hawk-card w-full max-w-md rounded-2xl p-5 sm:p-6 md:p-8 shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span>💳</span> Pagar Fatura
            </h3>
            
            <div className="bg-white/5 border border-white/10 p-5 rounded-xl mb-6 text-center">
              <div className="text-sm font-medium text-hawk-muted mb-1">Fatura {cartaoSelecionado?.nome} ({MESES[mesAtual]} {anoAtual})</div>
              <div className="text-3xl font-black text-hawk-red drop-shadow-[0_0_10px_rgba(255,107,107,0.3)]">{formatarMoeda(pendenciasFatura.total)}</div>
              <div className="text-xs text-hawk-red uppercase tracking-wider font-bold mt-1">Pendentes</div>
              <p className="text-[10px] text-hawk-muted mt-3 pt-3 border-t border-white/5">
                Será dado baixa em {pendenciasFatura.variaveis.length} compras e {pendenciasFatura.fixas.length} assinaturas.
              </p>
            </div>

            <form onSubmit={pagarFaturaTotal} className="space-y-4">
              <div className="space-y-4">
                {pendenciasFatura.totalEmpresa > 0 && (
                  <div className="bg-hawk-blue/5 border-l-4 border-hawk-blue p-4 rounded-r-xl">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-hawk-blue text-sm flex items-center gap-2"><span>🏢</span> Empresa</span>
                      <span className="font-black text-hawk-blue">{formatarMoeda(pendenciasFatura.totalEmpresa)}</span>
                    </div>
                    <select className="w-full bg-hawk-bg border border-hawk-blue/20 rounded-xl px-3 py-3 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-blue appearance-none" required value={fonteEmpresa} onChange={e => setFonteEmpresa(e.target.value)}>
                      <option value="" disabled>De onde vai sair o dinheiro?</option>
                      <option value="empresa">🏢 Empresa (Saldo: {formatarMoeda(saldos.empresa)})</option>
                      <option value="manutencao">🔧 Manutenção (Saldo: {formatarMoeda(saldos.manutencao)})</option>
                      <option value="saldoConta">🏦 Conta Principal (Saldo: {formatarMoeda(saldos.saldoConta)})</option>
                      <option value="NENHUMA">❌ Já paguei por fora / Não descontar</option>
                    </select>
                  </div>
                )}

                {pendenciasFatura.totalPessoal > 0 && (
                  <div className="bg-hawk-red/5 border-l-4 border-hawk-red p-4 rounded-r-xl">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-hawk-red text-sm flex items-center gap-2"><span>👤</span> Pessoal</span>
                      <span className="font-black text-hawk-red">{formatarMoeda(pendenciasFatura.totalPessoal)}</span>
                    </div>
                    <select className="w-full bg-hawk-bg border border-hawk-red/20 rounded-xl px-3 py-3 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-red appearance-none" required value={fontePessoal} onChange={e => setFontePessoal(e.target.value)}>
                      <option value="" disabled>De onde vai sair o dinheiro?</option>
                      <option value="contas">💳 Contas Fixas (Saldo: {formatarMoeda(saldos.contas)})</option>
                      <option value="livre">💸 Livre - Lazer (Saldo: {formatarMoeda(saldos.livre)})</option>
                      <option value="emergencia">🚨 Reserva (Saldo: {formatarMoeda(saldos.emergencia)})</option>
                      <option value="saldoConta">🏦 Conta Principal (Saldo: {formatarMoeda(saldos.saldoConta)})</option>
                      <option value="NENHUMA">❌ Já paguei por fora / Não descontar</option>
                    </select>
                  </div>
                )}

                {pendenciasFatura.totalEsposa > 0 && (
                  <div className="bg-[#fd79a8]/5 border-l-4 border-[#fd79a8] p-4 rounded-r-xl">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-[#fd79a8] text-sm flex items-center gap-2"><span>{emojiEsposa}</span> {rotuloEsposa}</span>
                      <span className="font-black text-[#fd79a8]">{formatarMoeda(pendenciasFatura.totalEsposa)}</span>
                    </div>
                    <select className="w-full bg-hawk-bg border border-[#fd79a8]/20 rounded-xl px-3 py-3 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-[#fd79a8] appearance-none" required value={fonteEsposa} onChange={e => setFonteEsposa(e.target.value)}>
                      <option value="" disabled>De onde vai sair o dinheiro?</option>
                      <option value="contas">💳 Contas Fixas (Saldo: {formatarMoeda(saldos.contas)})</option>
                      <option value="livre">💸 Livre - Lazer (Saldo: {formatarMoeda(saldos.livre)})</option>
                      <option value="emergencia">🚨 Reserva (Saldo: {formatarMoeda(saldos.emergencia)})</option>
                      <option value="saldoConta">🏦 Conta Principal (Saldo: {formatarMoeda(saldos.saldoConta)})</option>
                      <option value="NENHUMA">❌ {rotuloEsposa} pagou por fora / Não descontar</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/5 mt-6">
                <button
                  type="submit"
                  className="w-full sm:flex-1 font-bold rounded-xl px-4 py-3.5 sm:py-3 text-sm text-hawk-bg bg-hawk-purple hover:bg-hawk-purple/90 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={processandoPagamento || (pendenciasFatura.totalEmpresa > 0 && !fonteEmpresa) || (pendenciasFatura.totalPessoal > 0 && !fontePessoal) || (pendenciasFatura.totalEsposa > 0 && !fonteEsposa)}
                >
                  {processandoPagamento ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
                <button type="button" className="w-full sm:w-auto px-6 py-3.5 sm:py-3 font-bold text-sm text-hawk-text bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors" onClick={() => setPagamentoFaturaModal(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
