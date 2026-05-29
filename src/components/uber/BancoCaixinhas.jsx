import { useState } from 'react';
import { formatarMoeda } from '../../utils/helpers';

// Barra de progresso configurável
function ProgressBar({ pct, cor }) {
  return (
    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, pct)}%`, background: cor }}
      />
    </div>
  );
}

// Card individual de caixinha
function CaixinhaCard({ label, valor, enviada, accent = '#6c5ce7' }) {
  return (
    <div
      className={`relative rounded-xl border p-4 flex flex-col gap-2 transition-colors duration-200 ${
        enviada
          ? 'border-hawk-green/30 bg-hawk-green/5'
          : 'border-glass-border bg-glass hover:bg-hawk-hover'
      }`}
    >
      {enviada && (
        <span className="absolute top-2 right-2 text-[10px] font-bold text-hawk-green bg-hawk-green/15 border border-hawk-green/30 px-2 py-0.5 rounded-full">
          ✓ Enviado
        </span>
      )}
      <span className="text-xs text-hawk-muted font-medium pr-14">{label}</span>
      <span className="text-xl font-bold text-hawk-text">{formatarMoeda(valor)}</span>
    </div>
  );
}

export default function BancoCaixinhas({
  dataSelecionada,
  registroDoDia,
  brutoNum,
  liquidoNum,
  pctEmergencia, setPctEmergencia,
  pctManutencao, setPctManutencao,
  pctEmpresa, setPctEmpresa,
  pctLivre, setPctLivre,
  pctContas, setPctContas,
  saldoRetido,
  salvandoConfig,
  onSalvarConfig,
  onAbrirRepasse,
}) {
  const [mostrarConfig, setMostrarConfig] = useState(false);

  const enviada = registroDoDia?.caixinhasEnviadas ?? false;
  const inputClass =
    'w-20 bg-hawk-input border border-glass-border rounded-lg px-3 py-2 text-hawk-text text-sm text-right ' +
    'focus:outline-none focus:border-hawk-green/50 focus:ring-1 focus:ring-hawk-green/20 transition-colors';

  const sumBruto = parseFloat(pctEmergencia || 0) + parseFloat(pctManutencao || 0);
  const sumLiquido = parseFloat(pctEmpresa || 0) + parseFloat(pctLivre || 0) + parseFloat(pctContas || 0);

  return (
    <div className="rounded-2xl border border-glass-border bg-hawk-card shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-glass-border flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-hawk-muted flex items-center gap-2">
          <span>🏦</span> Banco Caixinhas —{' '}
          <span className="text-hawk-text normal-case font-semibold">
            {dataSelecionada.toLocaleDateString('pt-BR')}
          </span>
        </p>
        <button
          onClick={() => setMostrarConfig(v => !v)}
          className="text-xs font-semibold text-hawk-muted hover:text-hawk-text border border-glass-border hover:border-hawk-purple/40 px-3 py-1.5 rounded-lg transition-all duration-200"
        >
          {mostrarConfig ? '✕ Fechar' : '⚙️ Configurar'}
        </button>
      </div>

      <div className="p-5 space-y-6">

        {/* ── Painel de configuração ── */}
        {mostrarConfig && (
          <form
            onSubmit={onSalvarConfig}
            className="rounded-xl border border-hawk-purple/25 bg-hawk-purple/5 p-5 space-y-5 animate-fade-in"
          >
            <p className="text-sm font-bold text-hawk-text flex items-center gap-2">
              ⚙️ Ajustar Porcentagens das Caixinhas
            </p>

            {/* Barras de alocação */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-hawk-muted mb-1.5">
                  <span>Alocação do <strong className="text-hawk-text">Bruto</strong> (Emergência + Manutenção)</span>
                  <span className={sumBruto > 100 ? 'text-hawk-red font-bold' : 'text-hawk-green font-bold'}>
                    {sumBruto}%
                  </span>
                </div>
                <div className="flex h-2 w-full rounded-full bg-white/10 overflow-hidden gap-0.5">
                  <div style={{ width: `${Math.min(100, parseFloat(pctEmergencia || 0))}%`, background: '#ffd93d' }} className="h-full rounded-l-full transition-all duration-500" />
                  <div style={{ width: `${Math.min(100, parseFloat(pctManutencao || 0))}%`, background: '#ff6b6b' }} className="h-full rounded-r-full transition-all duration-500" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-hawk-muted mb-1.5">
                  <span>Alocação do <strong className="text-hawk-text">Líquido</strong> (Empresa + Livre + Contas)</span>
                  <span className={sumLiquido > 100 ? 'text-hawk-red font-bold' : 'text-hawk-green font-bold'}>
                    {sumLiquido}%
                  </span>
                </div>
                <div className="flex h-2 w-full rounded-full bg-white/10 overflow-hidden gap-0.5">
                  <div style={{ width: `${Math.min(100, parseFloat(pctEmpresa || 0))}%`, background: '#6c5ce7' }} className="h-full transition-all duration-500" />
                  <div style={{ width: `${Math.min(100, parseFloat(pctLivre || 0))}%`, background: '#00b894' }} className="h-full transition-all duration-500" />
                  <div style={{ width: `${Math.min(100, parseFloat(pctContas || 0))}%`, background: '#0984e3' }} className="h-full rounded-r-full transition-all duration-500" />
                </div>
              </div>
            </div>

            {/* Inputs de percentual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: '🚨 Reserva de Emergência (% Bruto)', value: pctEmergencia, setter: setPctEmergencia },
                { label: '🔧 Manutenção (% Bruto)', value: pctManutencao, setter: setPctManutencao },
                { label: '🏢 Empresa (% Líquido)', value: pctEmpresa, setter: setPctEmpresa },
                { label: '💸 Livre - Lazer (% Líquido)', value: pctLivre, setter: setPctLivre },
                { label: '💳 Contas (% Líquido)', value: pctContas, setter: setPctContas },
              ].map(({ label, value, setter }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <label className="text-xs text-hawk-muted font-medium">{label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className={inputClass}
                      value={value}
                      onChange={e => setter(e.target.value)}
                      min="0" max="100" required
                    />
                    <span className="text-hawk-muted text-sm font-bold">%</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={salvandoConfig}
              className="w-full py-3 rounded-xl bg-hawk-purple text-white font-bold text-sm
                         hover:opacity-90 hover:shadow-purple-glow disabled:opacity-50
                         transition-all duration-200 active:scale-[0.98]"
            >
              {salvandoConfig ? 'Salvando...' : '💾 Salvar Porcentagens'}
            </button>
          </form>
        )}

        {/* ── Empresa ── */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-hawk-muted uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-hawk-purple inline-block" />
            Para a Empresa (Custos Fixos e Variáveis)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CaixinhaCard
              label={`🔧 Manutenção (${pctManutencao}% Bruto)`}
              valor={brutoNum * (pctManutencao / 100)}
              enviada={enviada}
            />
            <CaixinhaCard
              label={`🏢 Empresa (${pctEmpresa}% Líquido)`}
              valor={liquidoNum * (pctEmpresa / 100)}
              enviada={enviada}
            />
          </div>
        </div>

        {/* ── Salário pessoal ── */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-hawk-muted uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-hawk-blue inline-block" />
            Para o seu Salário (Pessoa Física)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CaixinhaCard
              label={`🚨 Emergência (${pctEmergencia}% Bruto)`}
              valor={brutoNum * (pctEmergencia / 100)}
              enviada={enviada}
            />
            <CaixinhaCard
              label={`💸 Livre - Lazer (${pctLivre}% Líquido)`}
              valor={liquidoNum * (pctLivre / 100)}
              enviada={enviada}
            />
            <CaixinhaCard
              label={`💳 Contas (${pctContas}% Líquido)`}
              valor={liquidoNum * (pctContas / 100)}
              enviada={enviada}
            />
          </div>
        </div>

        {/* ── A Receber dos Apps ── */}
        <div className="rounded-xl border border-hawk-teal/25 bg-hawk-teal/5 p-5 text-center space-y-3">
          <p className="text-sm font-bold text-hawk-text">💰 A Receber dos Apps</p>
          <p className="text-xs text-hawk-muted leading-relaxed">
            Valor acumulado dos seus dias trabalhados que ainda não foi distribuído nas Caixinhas.
          </p>
          <p className="text-4xl font-extrabold text-hawk-teal">{formatarMoeda(saldoRetido)}</p>
          <button
            onClick={onAbrirRepasse}
            disabled={saldoRetido <= 0}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm
                       bg-gradient-to-r from-hawk-teal to-hawk-blue text-hawk-bg
                       hover:opacity-90 hover:shadow-[0_0_20px_rgba(0,184,148,0.3)]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-200 active:scale-[0.97]"
          >
            🤑 Receber Repasse Semanal
          </button>
        </div>

      </div>
    </div>
  );
}
