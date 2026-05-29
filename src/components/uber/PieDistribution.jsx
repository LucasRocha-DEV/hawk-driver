import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatarMoeda } from '../../utils/helpers';

const CORES_PIZZA = {
  'Reserva de Emergência': '#ffd93d',
  'Manutenção':            '#ff6b6b',
  'Empresa':               '#6c5ce7',
  'Livre':                 '#00b894',
  'Contas':                '#0984e3',
};

function renderPieLabel({ name, percent }) {
  return `${(percent * 100).toFixed(0)}%`;
}

export default function PieDistribution({ dataSelecionada, dados }) {
  return (
    <div className="rounded-2xl border border-glass-border bg-hawk-card shadow-card overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-glass-border">
        <p className="text-xs font-bold uppercase tracking-widest text-hawk-muted flex items-center gap-2">
          <span>🥧</span> Distribuição das Caixinhas —{' '}
          <span className="text-hawk-text normal-case font-semibold">
            {dataSelecionada.toLocaleDateString('pt-BR')}
          </span>
        </p>
      </div>

      <div className="p-5">
        {dados.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dados}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={renderPieLabel}
                labelLine
              >
                {dados.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CORES_PIZZA[entry.name] || '#ccc'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatarMoeda(value)}
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  color: '#f0f0f5',
                }}
              />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-hawk-muted">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-hawk-muted">
            <span className="text-4xl opacity-30">🥧</span>
            <p className="text-sm">Preencha os valores do dia para ver a distribuição.</p>
          </div>
        )}
      </div>
    </div>
  );
}
