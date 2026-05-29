import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { formatarMoeda } from '../../utils/helpers';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-hawk-card border border-glass-border rounded-xl px-4 py-3 shadow-card text-sm space-y-1">
      <p className="text-hawk-muted font-semibold">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.name === 'Viagens' ? entry.value : formatarMoeda(entry.value)}
        </p>
      ))}
    </div>
  );
}

const CORES = {
  bruto:    '#6c5ce7',
  liquido:  '#00d4aa',
  gastos:   '#ff6b6b',
  viagens:  '#ffd93d',
};

export default function MonthlyChart({ mesAtivo, dados }) {
  const mesLabel = mesAtivo.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-2xl border border-glass-border bg-hawk-card shadow-card overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-glass-border">
        <p className="text-xs font-bold uppercase tracking-widest text-hawk-muted flex items-center gap-2">
          <span>📉</span> Evolução Mensal —{' '}
          <span className="text-hawk-text normal-case font-semibold capitalize">{mesLabel}</span>
        </p>
      </div>

      <div className="p-5">
        {dados.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="data" stroke="#55556a" fontSize={11} />
              <YAxis stroke="#55556a" fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="bruto"   name="Bruto"   stroke={CORES.bruto}   strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="liquido" name="Líquido" stroke={CORES.liquido} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="gastos"  name="Gastos"  stroke={CORES.gastos}  strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="viagens" name="Viagens" stroke={CORES.viagens} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-hawk-muted">
            <span className="text-4xl opacity-30">📊</span>
            <p className="text-sm">Nenhum registro encontrado neste mês.</p>
          </div>
        )}
      </div>
    </div>
  );
}
