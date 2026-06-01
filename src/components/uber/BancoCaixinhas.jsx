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
  pctEmergencia,
  pctManutencao,
  pctEmpresa,
  pctLivre,
  pctContas,
  saldoRetido,
  onAbrirRepasse,
}) {
  const enviada = registroDoDia?.caixinhasEnviadas ?? false;

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
        <span className="text-xs font-semibold text-hawk-muted hidden sm:flex items-center gap-1">
          Ajuste os % em <span className="text-hawk-purple">⚙️ Configurações</span>
        </span>
      </div>

      <div className="p-5 space-y-6">

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
