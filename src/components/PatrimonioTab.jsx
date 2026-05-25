import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

const CAIXINHAS = [
  { id: 'emergencia', nome: 'Emergência', emoji: '🚨', cor: '#ffd93d', corDim: 'rgba(255, 217, 61, 0.12)' },
  { id: 'manutencao', nome: 'Manutenção', emoji: '🔧', cor: '#ff6b6b', corDim: 'rgba(255, 107, 107, 0.12)' },
  { id: 'empresa', nome: 'Empresa', emoji: '🏢', cor: '#6c5ce7', corDim: 'rgba(108, 92, 231, 0.12)' },
  { id: 'livre', nome: 'Livre / Lazer', emoji: '💸', cor: '#00b894', corDim: 'rgba(0, 184, 148, 0.12)' },
  { id: 'contas', nome: 'Contas', emoji: '💳', cor: '#0984e3', corDim: 'rgba(9, 132, 227, 0.12)' }
];

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(ts) {
  if (!ts || !ts.seconds) return 'Nunca atualizado';
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function PatrimonioTab() {
  const { usuario } = useAuth();

  const [saldos, setSaldos] = useState({});
  const [editando, setEditando] = useState(null);
  const [valorEditando, setValorEditando] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Firestore listener
  useEffect(() => {
    if (!usuario) return;
    const docRef = doc(db, 'usuarios', usuario.uid, 'saldos', 'atual');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSaldos(docSnap.data());
      }
    });
    return () => unsubscribe();
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

  // Save
  const salvarSaldo = async (campo, valor) => {
    if (!usuario) return;
    setSalvando(true);
    try {
      const docRef = doc(db, 'usuarios', usuario.uid, 'saldos', 'atual');
      await setDoc(docRef, {
        [campo]: parseFloat(valor) || 0,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('Erro ao salvar saldo:', err);
    }
    setSalvando(false);
    setEditando(null);
    setValorEditando('');
  };

  const iniciarEdicao = (campo, valorAtual) => {
    setEditando(campo);
    setValorEditando(String(valorAtual || ''));
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setValorEditando('');
  };

  return (
    <div className="tab-content">
      {/* Header */}
      <div className="patrimonio-header">
        <h2 className="patrimonio-titulo">💰 Meu Patrimônio</h2>
        <p className="patrimonio-subtitulo">
          Acompanhe em tempo real o saldo da sua conta e de cada caixinha
        </p>
        {saldos.atualizadoEm && (
          <span className="patrimonio-atualizado">
            Última atualização: {formatarData(saldos.atualizadoEm)}
          </span>
        )}
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

      {/* Saldo da Conta */}
      <div className="patrimonio-section">
        <h3 className="patrimonio-section-title">🏦 Saldo da Conta Bancária</h3>
        <div className="saldo-card saldo-card-conta">
          <div className="saldo-card-left">
            <span className="saldo-card-emoji">🏦</span>
            <div className="saldo-card-info">
              <span className="saldo-card-nome">Conta Principal</span>
              <span className="saldo-card-valor" style={{ color: '#00d4aa' }}>
                {formatarMoeda(saldos.saldoConta)}
              </span>
            </div>
          </div>
          <div className="saldo-card-right">
            {editando === 'saldoConta' ? (
              <div className="saldo-edit-inline">
                <input
                  type="number"
                  step="0.01"
                  className="saldo-edit-input"
                  value={valorEditando}
                  onChange={e => setValorEditando(e.target.value)}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') salvarSaldo('saldoConta', valorEditando);
                    if (e.key === 'Escape') cancelarEdicao();
                  }}
                />
                <button
                  className="saldo-btn-save"
                  onClick={() => salvarSaldo('saldoConta', valorEditando)}
                  disabled={salvando}
                >
                  ✓
                </button>
                <button className="saldo-btn-cancel" onClick={cancelarEdicao}>✕</button>
              </div>
            ) : (
              <button
                className="saldo-btn-edit"
                onClick={() => iniciarEdicao('saldoConta', saldos.saldoConta)}
              >
                ✎ Atualizar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Caixinhas */}
      <div className="patrimonio-section">
        <h3 className="patrimonio-section-title">📦 Saldos das Caixinhas</h3>
        <div className="caixinhas-saldo-grid">
          {CAIXINHAS.map(cx => {
            const valor = Number(saldos[cx.id]) || 0;
            const isEditing = editando === cx.id;

            return (
              <div
                key={cx.id}
                className="saldo-card"
                style={{ borderColor: cx.cor + '33' }}
              >
                <div className="saldo-card-accent" style={{ background: cx.cor }} />
                <div className="saldo-card-left">
                  <span className="saldo-card-emoji">{cx.emoji}</span>
                  <div className="saldo-card-info">
                    <span className="saldo-card-nome">{cx.nome}</span>
                    <span className="saldo-card-valor" style={{ color: cx.cor }}>
                      {formatarMoeda(valor)}
                    </span>
                  </div>
                </div>
                <div className="saldo-card-right">
                  {isEditing ? (
                    <div className="saldo-edit-inline">
                      <input
                        type="number"
                        step="0.01"
                        className="saldo-edit-input"
                        value={valorEditando}
                        onChange={e => setValorEditando(e.target.value)}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') salvarSaldo(cx.id, valorEditando);
                          if (e.key === 'Escape') cancelarEdicao();
                        }}
                      />
                      <button
                        className="saldo-btn-save"
                        onClick={() => salvarSaldo(cx.id, valorEditando)}
                        disabled={salvando}
                      >
                        ✓
                      </button>
                      <button className="saldo-btn-cancel" onClick={cancelarEdicao}>✕</button>
                    </div>
                  ) : (
                    <button
                      className="saldo-btn-edit"
                      onClick={() => iniciarEdicao(cx.id, saldos[cx.id])}
                    >
                      ✎
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Barra visual de distribuição */}
      {totais.patrimonio > 0 && (
        <div className="patrimonio-section">
          <h3 className="patrimonio-section-title">📊 Distribuição do Patrimônio</h3>
          <div className="patrimonio-dist-bar">
            {totais.saldoConta > 0 && (
              <div
                className="patrimonio-dist-segment"
                style={{
                  width: `${(totais.saldoConta / totais.patrimonio) * 100}%`,
                  background: '#00d4aa'
                }}
                title={`Conta: ${formatarMoeda(totais.saldoConta)}`}
              />
            )}
            {CAIXINHAS.map(cx => {
              const val = Number(saldos[cx.id]) || 0;
              if (val <= 0) return null;
              return (
                <div
                  key={cx.id}
                  className="patrimonio-dist-segment"
                  style={{
                    width: `${(val / totais.patrimonio) * 100}%`,
                    background: cx.cor
                  }}
                  title={`${cx.nome}: ${formatarMoeda(val)}`}
                />
              );
            })}
          </div>
          <div className="patrimonio-dist-legend">
            <span className="patrimonio-legend-item">
              <span className="patrimonio-legend-dot" style={{ background: '#00d4aa' }} />
              Conta ({((totais.saldoConta / totais.patrimonio) * 100).toFixed(0)}%)
            </span>
            {CAIXINHAS.map(cx => {
              const val = Number(saldos[cx.id]) || 0;
              if (val <= 0) return null;
              return (
                <span key={cx.id} className="patrimonio-legend-item">
                  <span className="patrimonio-legend-dot" style={{ background: cx.cor }} />
                  {cx.nome} ({((val / totais.patrimonio) * 100).toFixed(0)}%)
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Dica */}
      <div className="patrimonio-dica">
        <span className="patrimonio-dica-icon">💡</span>
        <p>
          Atualize seus saldos regularmente para ter um panorama fiel da sua saúde financeira.
          Os valores aqui não são calculados automaticamente — você registra o saldo real de cada caixinha e da conta.
        </p>
      </div>
    </div>
  );
}
