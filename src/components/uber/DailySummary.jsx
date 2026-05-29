// DailySummary — Cards de resumo do dia
function SummaryCard({ label, value, accent = 'default', icon }) {
  const accentMap = {
    green:   'border-hawk-green/25 bg-hawk-green/5',
    blue:    'border-hawk-blue/25 bg-hawk-blue/5',
    purple:  'border-hawk-purple/25 bg-hawk-purple/5',
    yellow:  'border-hawk-yellow/25 bg-hawk-yellow/5',
    default: 'border-glass-border bg-glass',
  };
  const valueMap = {
    green:   'text-hawk-green',
    blue:    'text-hawk-blue',
    purple:  'text-hawk-violet',
    yellow:  'text-hawk-yellow',
    default: 'text-hawk-text',
  };

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1.5 transition-colors duration-200 hover:bg-hawk-hover ${accentMap[accent]}`}>
      <span className="text-xs text-hawk-muted font-medium flex items-center gap-1.5">
        {icon && <span>{icon}</span>}
        {label}
      </span>
      <span className={`text-lg font-bold leading-tight ${valueMap[accent]}`}>
        {value}
      </span>
    </div>
  );
}

export default function DailySummary({ dataSelecionada, liquidoNum, motoristaNum, empresaNum, kmNum, viagensNum, horarioRodado }) {
  return (
    <div className="rounded-2xl border border-glass-border bg-hawk-card shadow-card overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-glass-border">
        <p className="text-xs font-bold uppercase tracking-widest text-hawk-muted flex items-center gap-2">
          <span>📊</span> Resumo do Dia —{' '}
          <span className="text-hawk-text normal-case font-semibold">
            {dataSelecionada.toLocaleDateString('pt-BR')}
          </span>
        </p>
      </div>

      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SummaryCard label="Líquido" value={liquidoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} accent="green" icon="💵" />
        <SummaryCard label="Pessoal / Salário" value={motoristaNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} accent="blue" icon="👤" />
        <SummaryCard label="Empresa / Custo" value={empresaNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} accent="purple" icon="🏢" />
        <SummaryCard label="Km Rodados" value={`${kmNum} km`} icon="📍" />
        <SummaryCard label="Viagens" value={viagensNum} icon="🚗" />
        <SummaryCard label="Horas Rodadas" value={horarioRodado || '0h00'} icon="⏱️" />
      </div>
    </div>
  );
}
