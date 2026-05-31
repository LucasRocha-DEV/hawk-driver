// ChatChart — desenha um gráfico leve a partir do JSON de um bloco "hawkchart"
// emitido pela IA. Tipos suportados: bar, line, pie, kpi.
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatarMoeda } from '../../utils/helpers';

const PALETA = ['#6c5ce7', '#00d4aa', '#ffd93d', '#ff6b6b', '#0984e3', '#00b894'];

export default function ChatChart({ raw }) {
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch {
    return (
      <div className="text-xs text-hawk-muted italic my-2">
        (não foi possível desenhar o gráfico)
      </div>
    );
  }

  const { type = 'bar', title, unit, data = [], color } = cfg;

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-xs text-hawk-muted italic my-2">
        (gráfico sem dados)
      </div>
    );
  }

  const fmt = (v) => (unit === 'R$' ? formatarMoeda(v) : `${v}${unit ? ' ' + unit : ''}`);
  const corBase = color || PALETA[0];
  const tooltipStyle = { background: '#1e1e24', border: '1px solid #333', borderRadius: 8, fontSize: 12, color: '#fff' };

  return (
    <div className="my-3 w-full rounded-xl border border-glass-border bg-hawk-bg/60 p-3">
      {title && <p className="text-xs font-bold text-hawk-text mb-2">{title}</p>}

      {type === 'kpi' ? (
        <div className="py-2 text-center">
          <span className="block text-3xl font-black text-hawk-green tracking-tight">
            {fmt(data[0]?.value ?? 0)}
          </span>
          {data[0]?.label && (
            <span className="block text-xs text-hawk-muted mt-1">{data[0].label}</span>
          )}
        </div>
      ) : (
        <div className="h-[180px] w-full">
          <ResponsiveContainer>
            {type === 'line' ? (
              <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#888" fontSize={11} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} width={42} tickFormatter={fmt} />
                <Tooltip formatter={fmt} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke={corBase} strokeWidth={2} dot={false} />
              </LineChart>
            ) : type === 'pie' ? (
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="label" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {data.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                </Pie>
                <Tooltip formatter={fmt} contentStyle={tooltipStyle} />
              </PieChart>
            ) : (
              <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#888" fontSize={11} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} width={42} tickFormatter={fmt} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={fmt} contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={36}>
                  {data.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
