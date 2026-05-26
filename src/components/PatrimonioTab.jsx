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

const CAIXINHAS = [
  { id: 'emergencia', nome: 'Reserva de Emergência', emoji: '🚨', cor: '#ffd93d' },
  { id: 'manutencao', nome: 'Manutenção', emoji: '🔧', cor: '#ff6b6b' },
  { id: 'empresa', nome: 'Empresa', emoji: '🏢', cor: '#6c5ce7' },
  { id: 'livre', nome: 'Livre / Lazer', emoji: '💸', cor: '#00b894' },
  { id: 'contas', nome: 'Contas', emoji: '💳', cor: '#0984e3' }
];

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  const d = new Date(dataStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

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
    let totalCaixinhas = 0;
    CAIXINHAS.forEach(c => {
      totalCaixinhas += Number(saldos[c.id]) || 0;
    });
    return {
      saldoConta,
      totalCaixinhas,
      patrimonio: saldoConta + totalCaixinhas
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
    setSalvando(false);
  };

  return (
    <div className="tab-content">
      {/* Header */}
      <div className="patrimonio-header">
        <h2 className="patrimonio-titulo">💰 Banco & Patrimônio</h2>
        <p className="patrimonio-subtitulo">
          Acompanhe em tempo real o fluxo de entradas e saídas de suas reservas.
        </p>
      </div>

      {/* Patrimônio Total */}
      <div className="patrimonio-total-card">
        <div className="patrimonio-total-bg" />
        <div className="patrimonio-total-content">
          <span className="patrimonio-total-label">Patrimônio Total</span>
          <span className="patrimonio-total-valor">{formatarMoeda(totais.patrimonio)}</span>
          <div className="patrimonio-total-breakdown">
            <span>🏦 Conta: {formatarMoeda(totais.saldoConta)}</span>
            <span className="patrimonio-sep">•</span>
            <span>📦 Caixinhas: {formatarMoeda(totais.totalCaixinhas)}</span>
          </div>
        </div>
      </div>

      {/* Saldo da Conta Bancária */}
      <div className="patrimonio-section">
        <h3 className="patrimonio-section-title">🏦 Saldo da Conta Bancária Livre</h3>
        <div className="saldo-card saldo-card-conta" style={{ flexWrap: 'wrap' }}>
          <div className="saldo-card-left" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="saldo-card-emoji">🏦</span>
              <div className="saldo-card-info">
                <span className="saldo-card-nome">Conta Principal</span>
                <span className="saldo-card-valor" style={{ color: '#00d4aa', fontSize: '1.4rem' }}>
                  {formatarMoeda(saldos.saldoConta)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              <button className="btn-sm" onClick={() => abrirModal('saldoConta', 'SAIDA')} style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b' }}>➖ Retirar</button>
              <button className="btn-sm" onClick={() => abrirModal('saldoConta', 'ENTRADA')} style={{ background: 'rgba(0,212,170,0.1)', color: '#00d4aa' }}>➕ Depósito</button>
              <button className="btn-sm" onClick={() => setExtratoAberto(extratoAberto === 'saldoConta' ? null : 'saldoConta')} style={{ background: 'rgba(255,255,255,0.05)', color: '#ddd' }}>📋 Extrato</button>
            </div>
          </div>
          
          {extratoAberto === 'saldoConta' && (
            <div style={{ width: '100%', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Histórico de Transações</h4>
              {getExtrato('saldoConta').length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nenhuma transação recente.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getExtrato('saldoConta').map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ color: t.tipo === 'ENTRADA' ? '#00d4aa' : '#ff6b6b', fontWeight: 'bold', marginRight: '8px' }}>{t.tipo === 'ENTRADA' ? '↓' : '↑'}</span>
                        <span>{t.motivo}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{formatarData(t.data)}</div>
                      </div>
                      <span style={{ fontWeight: 'bold', color: t.tipo === 'ENTRADA' ? '#00d4aa' : '#ff6b6b' }}>
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

      {/* Caixinhas do Negócio (Empresa) */}
      <div className="patrimonio-section">
        <h3 className="patrimonio-section-title">🏢 Custos Operacionais & Negócio</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
          O carro é sua ferramenta. Esses fundos pagam o financiamento, seguro, lavagem e manutenção do seu instrumento de trabalho.
        </p>
        <div className="caixinhas-saldo-grid">
          {CAIXINHAS.filter(c => c.id === 'empresa' || c.id === 'manutencao').map(cx => {
            const valor = Number(saldos[cx.id]) || 0;
            const isOpen = extratoAberto === cx.id;

            return (
              <div key={cx.id} className="saldo-card" style={{ borderColor: cx.cor + '33', flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="saldo-card-accent" style={{ background: cx.cor }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', padding: '4px 0' }}>
                  <div className="saldo-card-left" style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="saldo-card-emoji">{cx.emoji}</span>
                    <div className="saldo-card-info">
                      <span className="saldo-card-nome" style={{ fontSize: '1.05rem' }}>{cx.nome}</span>
                      <span className="saldo-card-valor" style={{ color: cx.cor, fontSize: '1.25rem' }}>{formatarMoeda(valor)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn-sm" onClick={() => abrirModal(cx.id, 'SAIDA')} style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b' }}>➖ Retirar</button>
                    <button className="btn-sm" onClick={() => abrirModal(cx.id, 'ENTRADA')} style={{ background: 'rgba(0,212,170,0.1)', color: '#00d4aa' }}>➕ Depósito</button>
                    <button className="btn-sm" onClick={() => setExtratoAberto(isOpen ? null : cx.id)} style={{ background: 'rgba(255,255,255,0.05)', color: '#ddd' }}>📋 Extrato</button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Histórico da Caixinha</h4>
                    {getExtrato(cx.id).length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Nenhuma transação recente.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                        {getExtrato(cx.id).map(t => (
                          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px', fontSize: '0.8rem' }}>
                            <div>
                              <span style={{ color: t.tipo === 'ENTRADA' ? cx.cor : '#ff6b6b', fontWeight: 'bold', marginRight: '6px' }}>{t.tipo === 'ENTRADA' ? '+' : '-'}</span>
                              <span>{t.motivo}</span>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{formatarData(t.data)}</div>
                            </div>
                            <span style={{ fontWeight: 'bold', color: t.tipo === 'ENTRADA' ? cx.cor : '#ff6b6b' }}>{formatarMoeda(t.valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Caixinhas Pessoais (Lucro Livre) */}
      <div className="patrimonio-section">
        <h3 className="patrimonio-section-title">👤 Sua Vida Pessoal (Seu Salário)</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
          Este é o seu verdadeiro lucro. Destinado para pagar seu aluguel, mercado, lazer e emergência pessoal.
        </p>
        <div className="caixinhas-saldo-grid">
          {CAIXINHAS.filter(c => c.id === 'contas' || c.id === 'emergencia' || c.id === 'livre').map(cx => {
            const valor = Number(saldos[cx.id]) || 0;
            const isOpen = extratoAberto === cx.id;

            return (
              <div key={cx.id} className="saldo-card" style={{ borderColor: cx.cor + '33', flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="saldo-card-accent" style={{ background: cx.cor }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', padding: '4px 0' }}>
                  <div className="saldo-card-left" style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="saldo-card-emoji">{cx.emoji}</span>
                    <div className="saldo-card-info">
                      <span className="saldo-card-nome" style={{ fontSize: '1.05rem' }}>{cx.nome}</span>
                      <span className="saldo-card-valor" style={{ color: cx.cor, fontSize: '1.25rem' }}>{formatarMoeda(valor)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn-sm" onClick={() => abrirModal(cx.id, 'SAIDA')} style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b' }}>➖ Retirar</button>
                    <button className="btn-sm" onClick={() => abrirModal(cx.id, 'ENTRADA')} style={{ background: 'rgba(0,212,170,0.1)', color: '#00d4aa' }}>➕ Depósito</button>
                    <button className="btn-sm" onClick={() => setExtratoAberto(isOpen ? null : cx.id)} style={{ background: 'rgba(255,255,255,0.05)', color: '#ddd' }}>📋 Extrato</button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Histórico da Caixinha</h4>
                    {getExtrato(cx.id).length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Nenhuma transação recente.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                        {getExtrato(cx.id).map(t => (
                          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px', fontSize: '0.8rem' }}>
                            <div>
                              <span style={{ color: t.tipo === 'ENTRADA' ? cx.cor : '#ff6b6b', fontWeight: 'bold', marginRight: '6px' }}>{t.tipo === 'ENTRADA' ? '+' : '-'}</span>
                              <span>{t.motivo}</span>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{formatarData(t.data)}</div>
                            </div>
                            <span style={{ fontWeight: 'bold', color: t.tipo === 'ENTRADA' ? cx.cor : '#ff6b6b' }}>{formatarMoeda(t.valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Transação */}
      {mostrarModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', border: `1px solid ${tipoTransacao === 'ENTRADA' ? '#00d4aa' : '#ff6b6b'}` }}>
            <h3 style={{ marginTop: 0, color: tipoTransacao === 'ENTRADA' ? '#00d4aa' : '#ff6b6b' }}>
              {tipoTransacao === 'ENTRADA' ? '➕ Novo Depósito' : '➖ Nova Retirada'}
            </h3>
            <form onSubmit={registrarTransacao} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input 
                  type="number" step="0.01" min="0.01" className="form-input" required autoFocus
                  value={valorTransacao} onChange={e => setValorTransacao(e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Motivo / Observação</label>
                <input 
                  type="text" className="form-input" required
                  placeholder={tipoTransacao === 'SAIDA' ? 'Ex: Pagar mecânico...' : 'Ex: Dinheiro extra...'}
                  value={motivoTransacao} onChange={e => setMotivoTransacao(e.target.value)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input 
                  type="date" className="form-input" required
                  value={dataTransacao} onChange={e => setDataTransacao(e.target.value)} 
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, background: tipoTransacao === 'ENTRADA' ? '#00d4aa' : '#ff6b6b', color: '#000' }} disabled={salvando}>
                  {salvando ? 'Processando...' : 'Confirmar'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setMostrarModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dica */}
      <div className="patrimonio-dica">
        <span className="patrimonio-dica-icon">💡</span>
        <p>
          Agora suas caixinhas são atualizadas automaticamente sempre que você confirmar o envio na aba de Ganhos. Use os botões acima apenas para saques ou depósitos manuais extras!
        </p>
      </div>
    </div>
  );
}
