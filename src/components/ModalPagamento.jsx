import { useState } from 'react';
import { formatarMoeda, nomeCaixinha } from '../utils/helpers';

/**
 * Modal reutilizável de pagamento inteligente.
 * Usado em: DespesasFixasTab, GastosVariaveisTab
 * 
 * Props:
 *   despesa (object)       - A despesa sendo paga { descricao, valor }
 *   saldos (object)        - O doc de saldos do Firestore
 *   onConfirmar (fn)       - Callback async (caixinhaFonte) => void
 *   onFechar (fn)          - Callback para fechar o modal
 */
export default function ModalPagamento({ despesa, saldos, onConfirmar, onFechar }) {
  const [caixinhaFonte, setCaixinhaFonte] = useState('');
  const [processando, setProcessando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!caixinhaFonte) return;
    
    // Validação de saldo
    if (caixinhaFonte !== 'NENHUMA') {
      const saldoDisponivel = Number(saldos[caixinhaFonte]) || 0;
      const valorDespesa = Number(despesa.valor);
      if (saldoDisponivel < valorDespesa) {
        const confirma = window.confirm(
          `⚠️ Atenção! O saldo de "${nomeCaixinha(caixinhaFonte)}" (${formatarMoeda(saldoDisponivel)}) é menor que o valor da despesa (${formatarMoeda(valorDespesa)}). O saldo ficará negativo. Deseja continuar mesmo assim?`
        );
        if (!confirma) return;
      }
    }

    setProcessando(true);
    try {
      await onConfirmar(caixinhaFonte);
    } catch {
      alert('Falha ao processar pagamento inteligente.');
    }
    setProcessando(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
      <div className="section-card" style={{ width: '90%', maxWidth: '450px', background: '#16162a', padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.3rem', color: '#fff' }}>✅ Confirmar Pagamento</h3>
        
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
          <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Pagando Despesa: <strong style={{ color: '#fff' }}>{despesa.descricao}</strong></div>
          <div style={{ fontSize: '1.4rem', color: '#ff6b6b', fontWeight: 'bold', marginTop: '8px' }}>{formatarMoeda(despesa.valor)}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '1rem' }}>🧠 De onde esse dinheiro vai sair?</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '-6px' }}>O app vai dar baixa nesta conta e subtrair do saldo escolhido na aba Patrimônio.</p>
            <select className="form-input" required value={caixinhaFonte} onChange={e => setCaixinhaFonte(e.target.value)} style={{ background: '#0a0a16', padding: '12px', fontSize: '1rem' }}>
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
                <option value="NENHUMA">❌ Já paguei por fora (Apenas dar baixa aqui)</option>
              </optgroup>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1, padding: '14px', fontSize: '1rem' }} disabled={processando || !caixinhaFonte}>
              {processando ? 'Processando...' : 'Confirmar Pagamento'}
            </button>
            <button type="button" className="btn-secondary" onClick={onFechar} style={{ padding: '14px 24px' }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
