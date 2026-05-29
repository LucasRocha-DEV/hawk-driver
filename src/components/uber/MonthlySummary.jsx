// MonthlySummary — Cards de totais do mês
function StatCard({ label, value, accent = 'default', icon }) {
  const accentMap = {
    green:   'border-hawk-green/25 bg-hawk-green/5',
    blue:    'border-hawk-blue/25 bg-hawk-blue/5',
    purple:  'border-hawk-purple/25 bg-hawk-purple/5',
    default: 'border-glass-border bg-glass',
  };
  const valueMap = {
    green:   'text-hawk-green',
    blue:    'text-hawk-blue',
    purple:  'text-hawk-violet',
    default: 'text-hawk-text',
  };

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1.5 hover:bg-hawk-hover transition-colors duration-200 ${accentMap[accent]}`}>
      <span className="text-xs text-hawk-muted font-medium flex items-center gap-1.5">
        {icon && <span>{icon}</span>}
        {label}
      </span>
      <span className={`text-xl font-bold leading-tight ${valueMap[accent]}`}>
        {value}
      </span>
    </div>
  );
}

export default function MonthlySummary({ mesAtivo, resumoMes }) {
  const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const mesLabel = mesAtivo.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-2xl border border-glass-border bg-hawk-card shadow-card overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-glass-border">
        <p className="text-xs font-bold uppercase tracking-widest text-hawk-muted flex items-center gap-2">
          <span>📈</span> Resumo do Mês —{' '}
          <span className="text-hawk-text normal-case font-semibold capitalize">{mesLabel}</span>
        </p>
      </div>

      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Bruto Total" value={fmt(resumoMes.bruto)} accent="purple" icon="💰" />
        <StatCard label="Líquido Total" value={fmt(resumoMes.liquido)} accent="green" icon="💵" />
        <StatCard label="Pessoal / Salário" value={fmt(resumoMes.motorista)} accent="blue" icon="👤" />
        <StatCard label="Empresa / Custo" value={fmt(resumoMes.empresa)} icon="🏢" />
        <StatCard label="Km Total" value={`${resumoMes.km} km`} icon="📍" />
        <StatCard label="Viagens Total" value={resumoMes.viagens} icon="🚗" />
        <StatCard label="Horas Total" value={resumoMes.horas} icon="⏱️" />
      </div>
    </div>
  );
}
