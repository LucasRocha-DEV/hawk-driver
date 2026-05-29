import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  doc,
  setDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  increment,
  limit
} from 'firebase/firestore';
import { formatarMoeda, formatarData } from '../utils/helpers';

const CAIXINHAS = [
  { id: 'saldoRetidoApps', nome: 'A Receber dos Apps (Uber/99)', emoji: '⏳', cor: '#00cec9' },
  { id: 'emergencia', nome: 'Reserva de Emergência', emoji: '🚨', cor: '#ffd93d' },
  { id: 'manutencao', nome: 'Manutenção', emoji: '🔧', cor: '#ff6b6b' },
  { id: 'empresa', nome: 'Empresa', emoji: '🏢', cor: '#6c5ce7' },
  { id: 'livre', nome: 'Livre / Lazer', emoji: '💸', cor: '#00b894' },
  { id: 'contas', nome: 'Contas', emoji: '💳', cor: '#0984e3' }
];

export default function PatrimonioTab() {
  const { usuario } = useAuth();

  const [saldos, setSaldos] = useState({});
  const [transacoes, setTransacoes] = useState([]);
  
  // UI States
  const [mostrarModal, setMostrarModal] = useState(false);
  const [tipoTransacao, setTipoTransacao] = useState('ENTRADA'); // ENTRADA ou SAIDA
  const [contaSelecionada, setContaSelecionada] = useState('');
  const [valorTransacao, setValorTransacao] = useState('');
  const [motivoTransacao, setMotivoTransacao] = useState('');
  const [dataTransacao, setDataTransacao] = useState(new Date().toISOString().split('T')[0]);
  const [salvando, setSalvando] = useState(false);
  const [extratoAberto, setExtratoAberto] = useState(null); // id da caixinha para mostrar extrato

  // Firestore listeners
  useEffect(() => {
    if (!usuario) return;
    const docRef = doc(db, 'usuarios', usuario.uid, 'saldos', 'atual');
    const unsubSaldos = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSaldos(docSnap.data());
      }
    });

    const transRef = collection(db, 'usuarios', usuario.uid, 'transacoes_patrimonio');
    const qTrans = query(transRef, orderBy('criadoEm', 'desc'), limit(100));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransacoes(lista);
    });

    return () => {
      unsubSaldos();
      unsubTrans();
    };
  }, [usuario]);

  // Totais
  const totais = useMemo(() => {
    const saldoConta = Number(saldos.saldoConta) || 0;
    const saldoRetidoApps = Number(saldos.saldoRetidoApps) || 0;
    let totalCaixinhas = 0;
    let totalEmpresa = 0;
    let totalPessoal = 0;
    
    CAIXINHAS.forEach(c => {
      const val = Number(saldos[c.id]) || 0;
      if (c.id !== 'saldoRetidoApps') {
        totalCaixinhas += val;
        if (c.id === 'empresa' || c.id === 'manutencao') totalEmpresa += val;
        if (c.id === 'contas' || c.id === 'emergencia' || c.id === 'livre') totalPessoal += val;
      }
    });
    
    return {
      saldoConta,
      saldoRetidoApps,
      totalCaixinhas,
      totalEmpresa,
      totalPessoal,
      patrimonio: saldoConta + totalCaixinhas + saldoRetidoApps
    };
  }, [saldos]);

  // Extrato
  const getExtrato = (caixinhaId) => {
    return transacoes.filter(t => t.caixinhaId === caixinhaId);
  };

  const abrirModal = (caixinhaId, tipo) => {
    setContaSelecionada(caixinhaId);
    setTipoTransacao(tipo);
    setValorTransacao('');
    setMotivoTransacao('');
    setDataTransacao(new Date().toISOString().split('T')[0]);
    setMostrarModal(true);
  };

  const registrarTransacao = async (e) => {
    e.preventDefault();
    if (!usuario || !valorTransacao || !contaSelecionada) return;
    setSalvando(true);

    try {
      let val = parseFloat(valorTransacao);
      if (tipoTransacao === 'SAIDA') {
        val = -Math.abs(val);
      } else {
        val = Math.abs(val);
      }

      let nomeConta = 'Conta Principal';
      if (contaSelecionada !== 'saldoConta') {
        const c = CAIXINHAS.find(x => x.id === contaSelecionada);
        if (c) nomeConta = c.nome;
      }

      // 1. Gravar transação
      const transacoesRef = collection(db, 'usuarios', usuario.uid, 'transacoes_patrimonio');
      await addDoc(transacoesRef, {
        caixinhaId: contaSelecionada,
        caixinhaNome: nomeConta,
        tipo: tipoTransacao,
        valor: Math.abs(val), // Guarda sempre positivo no log
        motivo: motivoTransacao.trim() || (tipoTransacao === 'SAIDA' ? 'Retirada Manual' : 'Depósito Manual'),
        data: dataTransacao,
        criadoEm: serverTimestamp()
      });

      // 2. Atualizar saldo
      const saldoRef = doc(db, 'usuarios', usuario.uid, 'saldos', 'atual');
      await setDoc(saldoRef, {
        [contaSelecionada]: increment(val),
        atualizadoEm: serverTimestamp()
      }, { merge: true });

      setMostrarModal(false);
    } catch (err) {
      console.error('Erro ao registrar transação:', err);
      alert('Falha ao registrar transação.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-2xl font-bold text-hawk-text flex items-center justify-center gap-2">
          <span>💰</span> Banco & Patrimônio
        </h2>
        <p className="text-sm text-hawk-muted">
          Acompanhe em tempo real o fluxo de entradas e saídas de suas reservas.
        </p>
      </div>

      {/* Patrimônio Total */}
      <div className="rounded-3xl border border-hawk-purple/30 bg-gradient-to-br from-hawk-purple/20 to-hawk-card/90 p-8 text-center shadow-card-hover relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="relative z-10 flex flex-col items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-widest text-hawk-purple mb-1">Patrimônio Total</span>
          <span className="text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(108,92,231,0.5)] mb-4">
            {formatarMoeda(totais.patrimonio)}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-hawk-text/80 font-medium bg-black/20 px-5 py-2.5 rounded-full border border-white/5">
            <span>🏦 Conta: <strong className="text-hawk-text">{formatarMoeda(totais.saldoConta)}</strong></span>
            <span className="text-white/20 px-1">•</span>
            <span>📦 Caixinhas: <strong className="text-hawk-text">{formatarMoeda(totais.totalCaixinhas)}</strong></span>
            <span className="text-white/20 px-1">•</span>
            <span>⏳ A Receber: <strong className="text-hawk-text">{formatarMoeda(totais.saldoRetidoApps)}</strong></span>
          </div>
        </div>
      </div>

      {/* Cards de Resumo Empresa / Pessoal */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-5 shadow-card flex flex-col items-center text-center hover:border-hawk-purple/30 transition-colors group">
          <div className="w-12 h-12 rounded-full bg-hawk-purple/10 flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">🏢</div>
          <span className="text-xs font-semibold text-hawk-muted uppercase tracking-wide mb-1">Patrimônio Empresa</span>
          <span className="text-2xl font-bold text-hawk-purple">{formatarMoeda(totais.totalEmpresa)}</span>
        </div>
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-5 shadow-card flex flex-col items-center text-center hover:border-hawk-blue/30 transition-colors group">
          <div className="w-12 h-12 rounded-full bg-hawk-blue/10 flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">👤</div>
          <span className="text-xs font-semibold text-hawk-muted uppercase tracking-wide mb-1">Patrimônio Pessoal</span>
          <span className="text-2xl font-bold text-hawk-blue">{formatarMoeda(totais.totalPessoal)}</span>
        </div>
      </div>

      {/* A Receber dos Apps */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-hawk-text flex items-center gap-2 mb-1">
            <span>⏳</span> A Receber dos Apps (Carteira Virtual)
          </h3>
          <p className="text-xs text-hawk-muted leading-relaxed">
            Dinheiro das corridas que ainda não caiu na sua conta bancária. Você pode editar caso receba algo extra da 99 ou outros apps.
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {CAIXINHAS.filter(c => c.id === 'saldoRetidoApps').map(cx => {
            const valor = Number(saldos[cx.id]) || 0;
            const isOpen = extratoAberto === cx.id;
            return (
              <div key={cx.id} className="rounded-2xl border bg-hawk-card shadow-card overflow-hidden transition-all duration-300" style={{ borderColor: `${cx.cor}33` }}>
                <div className="h-1.5 w-full" style={{ background: cx.cor }} />
                <div className="p-5 flex flex-col gap-4" style={{ background: `${cx.cor}08` }}>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/5" style={{ background: `${cx.cor}20` }}>
                      {cx.emoji}
                    </div>
                    <div className="flex-1">
                      <span className="block text-sm font-semibold opacity-90 mb-1" style={{ color: cx.cor }}>{cx.nome}</span>
                      <span className="block text-3xl font-bold tracking-tight" style={{ color: cx.cor }}>{formatarMoeda(valor)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button className="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95" onClick={() => abrirModal(cx.id, 'ENTRADA')} style={{ background: 'rgba(0,212,170,0.1)', color: '#00d4aa' }}>➕ Editar (Add Extra)</button>
                    <button className="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95" onClick={() => abrirModal(cx.id, 'SAIDA')} style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b' }}>➖ Corrigir Erro</button>
                    <button className="py-2 px-4 rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95 bg-white/5 text-hawk-text hover:bg-white/10" onClick={() => setExtratoAberto(isOpen ? null : cx.id)}>📋 Extrato</button>
                  </div>

                  {isOpen && (
                    <div className="mt-2 pt-4 border-t border-white/5 animate-fade-in">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-hawk-muted mb-3">Histórico</h4>
                      {getExtrato(cx.id).length === 0 ? (
                        <p className="text-xs text-hawk-dim italic">Nenhuma transação recente.</p>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-none">
                          {getExtrato(cx.id).map(t => (
                            <div key={t.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`font-bold text-xs ${t.tipo === 'ENTRADA' ? 'text-hawk-green' : 'text-hawk-red'}`}>{t.tipo === 'ENTRADA' ? '↓' : '↑'}</span>
                                  <span className="text-sm text-hawk-text">{t.motivo}</span>
                                </div>
                                <div className="text-[10px] text-hawk-muted">{formatarData(t.data)}</div>
                              </div>
                              <span className={`font-bold text-sm ${t.tipo === 'ENTRADA' ? 'text-hawk-green' : 'text-hawk-red'}`}>
                                {t.tipo === 'ENTRADA' ? '+' : '-'}{formatarMoeda(t.valor)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Saldo da Conta Bancária */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-hawk-text flex items-center gap-2 mb-1">
            <span>🏦</span> Saldo da Conta Bancária Livre
          </h3>
        </div>
        
        <div className="rounded-2xl border border-hawk-green/20 bg-hawk-card shadow-card overflow-hidden transition-all duration-300">
          <div className="h-1.5 w-full bg-hawk-green" />
          <div className="p-5 flex flex-col gap-4 bg-hawk-green/5">
            
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/5 bg-hawk-green/20">
                🏦
              </div>
              <div className="flex-1">
                <span className="block text-sm font-semibold opacity-90 mb-1 text-hawk-green">Conta Principal</span>
                <span className="block text-3xl font-bold tracking-tight text-hawk-green">{formatarMoeda(saldos.saldoConta)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95 bg-hawk-red/10 text-hawk-red" onClick={() => abrirModal('saldoConta', 'SAIDA')}>➖ Retirar</button>
              <button className="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95 bg-hawk-green/10 text-hawk-green" onClick={() => abrirModal('saldoConta', 'ENTRADA')}>➕ Depósito</button>
              <button className="py-2 px-4 rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95 bg-white/5 text-hawk-text hover:bg-white/10" onClick={() => setExtratoAberto(extratoAberto === 'saldoConta' ? null : 'saldoConta')}>📋 Extrato</button>
            </div>

            {extratoAberto === 'saldoConta' && (
              <div className="mt-2 pt-4 border-t border-white/5 animate-fade-in">
                <h4 className="text-xs font-bold uppercase tracking-wider text-hawk-muted mb-3">Histórico de Transações</h4>
                {getExtrato('saldoConta').length === 0 ? (
                  <p className="text-xs text-hawk-dim italic">Nenhuma transação recente.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-none">
                    {getExtrato('saldoConta').map(t => (
                      <div key={t.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-bold text-xs ${t.tipo === 'ENTRADA' ? 'text-hawk-green' : 'text-hawk-red'}`}>{t.tipo === 'ENTRADA' ? '↓' : '↑'}</span>
                            <span className="text-sm text-hawk-text">{t.motivo}</span>
                          </div>
                          <div className="text-[10px] text-hawk-muted">{formatarData(t.data)}</div>
                        </div>
                        <span className={`font-bold text-sm ${t.tipo === 'ENTRADA' ? 'text-hawk-green' : 'text-hawk-red'}`}>
                          {t.tipo === 'ENTRADA' ? '+' : '-'}{formatarMoeda(t.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Caixinhas do Negócio (Empresa) */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-hawk-text flex items-center gap-2 mb-1">
            <span>🏢</span> Custos Operacionais & Negócio
          </h3>
          <p className="text-xs text-hawk-muted leading-relaxed">
            O carro é sua ferramenta. Esses fundos pagam o financiamento, seguro, lavagem e manutenção do seu instrumento de trabalho.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CAIXINHAS.filter(c => c.id === 'empresa' || c.id === 'manutencao').map(cx => {
            const valor = Number(saldos[cx.id]) || 0;
            const isOpen = extratoAberto === cx.id;
            return (
              <div key={cx.id} className="rounded-2xl border bg-hawk-card shadow-card overflow-hidden transition-all duration-300" style={{ borderColor: `${cx.cor}33` }}>
                <div className="h-1.5 w-full" style={{ background: cx.cor }} />
                <div className="p-5 flex flex-col gap-4 bg-hawk-bg/30">
                  
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/5" style={{ background: `${cx.cor}20` }}>
                      {cx.emoji}
                    </div>
                    <div className="flex-1">
                      <span className="block text-sm font-semibold opacity-90 mb-1 text-hawk-text">{cx.nome}</span>
                      <span className="block text-2xl font-bold tracking-tight" style={{ color: cx.cor }}>{formatarMoeda(valor)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 py-2 px-2 text-center rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95 bg-hawk-red/10 text-hawk-red" onClick={() => abrirModal(cx.id, 'SAIDA')}>➖ Retirar</button>
                    <button className="flex-1 py-2 px-2 text-center rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95 bg-hawk-green/10 text-hawk-green" onClick={() => abrirModal(cx.id, 'ENTRADA')}>➕ Depósito</button>
                    <button className="py-2 px-3 text-center rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95 bg-white/5 text-hawk-text hover:bg-white/10" onClick={() => setExtratoAberto(isOpen ? null : cx.id)}>📋 Extrato</button>
                  </div>

                  {isOpen && (
                    <div className="mt-2 pt-4 border-t border-white/5 animate-fade-in">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-hawk-muted mb-3">Histórico</h4>
                      {getExtrato(cx.id).length === 0 ? (
                        <p className="text-xs text-hawk-dim italic">Nenhuma transação recente.</p>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-none">
                          {getExtrato(cx.id).map(t => (
                            <div key={t.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`font-bold text-xs ${t.tipo === 'ENTRADA' ? 'text-hawk-green' : 'text-hawk-red'}`}>{t.tipo === 'ENTRADA' ? '↓' : '↑'}</span>
                                  <span className="text-sm text-hawk-text">{t.motivo}</span>
                                </div>
                                <div className="text-[10px] text-hawk-muted">{formatarData(t.data)}</div>
                              </div>
                              <span className={`font-bold text-sm ${t.tipo === 'ENTRADA' ? 'text-hawk-green' : 'text-hawk-red'}`}>
                                {t.tipo === 'ENTRADA' ? '+' : '-'}{formatarMoeda(t.valor)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Caixinhas Pessoais (Lucro Livre) */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-hawk-text flex items-center gap-2 mb-1">
            <span>👤</span> Sua Vida Pessoal (Seu Salário)
          </h3>
          <p className="text-xs text-hawk-muted leading-relaxed">
            Este é o seu verdadeiro lucro. Destinado para pagar seu aluguel, mercado, lazer e emergência pessoal.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CAIXINHAS.filter(c => c.id === 'contas' || c.id === 'emergencia' || c.id === 'livre').map(cx => {
            const valor = Number(saldos[cx.id]) || 0;
            const isOpen = extratoAberto === cx.id;
            return (
              <div key={cx.id} className="rounded-2xl border bg-hawk-card shadow-card overflow-hidden transition-all duration-300" style={{ borderColor: `${cx.cor}33` }}>
                <div className="h-1.5 w-full" style={{ background: cx.cor }} />
                <div className="p-5 flex flex-col gap-4 bg-hawk-bg/30">
                  
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/5" style={{ background: `${cx.cor}20` }}>
                      {cx.emoji}
                    </div>
                    <div className="flex-1">
                      <span className="block text-sm font-semibold opacity-90 mb-1 text-hawk-text">{cx.nome}</span>
                      <span className="block text-2xl font-bold tracking-tight" style={{ color: cx.cor }}>{formatarMoeda(valor)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 py-2 px-2 text-center rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95 bg-hawk-red/10 text-hawk-red" onClick={() => abrirModal(cx.id, 'SAIDA')}>➖ Retirar</button>
                    <button className="flex-1 py-2 px-2 text-center rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95 bg-hawk-green/10 text-hawk-green" onClick={() => abrirModal(cx.id, 'ENTRADA')}>➕ Depósito</button>
                    <button className="py-2 px-3 text-center rounded-xl text-xs font-bold transition-all hover:opacity-80 active:scale-95 bg-white/5 text-hawk-text hover:bg-white/10" onClick={() => setExtratoAberto(isOpen ? null : cx.id)}>📋 Extrato</button>
                  </div>

                  {isOpen && (
                    <div className="mt-2 pt-4 border-t border-white/5 animate-fade-in">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-hawk-muted mb-3">Histórico</h4>
                      {getExtrato(cx.id).length === 0 ? (
                        <p className="text-xs text-hawk-dim italic">Nenhuma transação recente.</p>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-none">
                          {getExtrato(cx.id).map(t => (
                            <div key={t.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`font-bold text-xs ${t.tipo === 'ENTRADA' ? 'text-hawk-green' : 'text-hawk-red'}`}>{t.tipo === 'ENTRADA' ? '↓' : '↑'}</span>
                                  <span className="text-sm text-hawk-text">{t.motivo}</span>
                                </div>
                                <div className="text-[10px] text-hawk-muted">{formatarData(t.data)}</div>
                              </div>
                              <span className={`font-bold text-sm ${t.tipo === 'ENTRADA' ? 'text-hawk-green' : 'text-hawk-red'}`}>
                                {t.tipo === 'ENTRADA' ? '+' : '-'}{formatarMoeda(t.valor)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Transação */}
      {mostrarModal && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 animate-fade-in">
          <div 
            className="bg-hawk-card w-full max-w-sm rounded-2xl p-6 shadow-2xl border"
            style={{ borderColor: tipoTransacao === 'ENTRADA' ? '#00d4aa' : '#ff6b6b' }}
          >
            <h3 
              className="text-xl font-bold mb-6 flex items-center gap-2"
              style={{ color: tipoTransacao === 'ENTRADA' ? '#00d4aa' : '#ff6b6b' }}
            >
              {tipoTransacao === 'ENTRADA' ? '➕ Novo Depósito' : '➖ Nova Retirada'}
            </h3>
            
            <form onSubmit={registrarTransacao} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest mb-1.5">Valor (R$)</label>
                <input 
                  type="number" step="0.01" min="0.01" required autoFocus
                  className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-green/50 transition-colors"
                  value={valorTransacao} onChange={e => setValorTransacao(e.target.value)} 
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest mb-1.5">Motivo / Observação</label>
                <input 
                  type="text" required
                  className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-green/50 transition-colors"
                  placeholder={tipoTransacao === 'SAIDA' ? 'Ex: Pagar mecânico...' : 'Ex: Dinheiro extra...'}
                  value={motivoTransacao} onChange={e => setMotivoTransacao(e.target.value)} 
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest mb-1.5">Data</label>
                <input 
                  type="date" required
                  className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-green/50 transition-colors"
                  value={dataTransacao} onChange={e => setDataTransacao(e.target.value)} 
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="submit" 
                  disabled={salvando}
                  className="flex-1 font-bold rounded-xl px-6 py-3 text-sm text-hawk-bg hover:opacity-90 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                  style={{ background: tipoTransacao === 'ENTRADA' ? '#00d4aa' : '#ff6b6b' }}
                >
                  {salvando ? 'Processando...' : 'Confirmar'}
                </button>
                <button 
                  type="button" 
                  className="px-6 py-3 font-bold text-sm text-hawk-text bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                  onClick={() => setMostrarModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dica */}
      <div className="rounded-xl border border-hawk-blue/30 bg-hawk-blue/10 p-4 flex gap-4 items-start">
        <span className="text-2xl flex-shrink-0">💡</span>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-hawk-muted leading-relaxed">
            Agora suas caixinhas são atualizadas automaticamente sempre que você confirmar o envio na aba de Ganhos. Use os botões acima apenas para saques ou depósitos manuais extras!
          </p>
        </div>
      </div>
    </div>
  );
}
