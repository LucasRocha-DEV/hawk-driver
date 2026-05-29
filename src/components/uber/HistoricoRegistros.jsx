import { useState } from 'react';
import { formatarMoeda, formatarDataExibicao } from '../../utils/helpers';

export default function HistoricoRegistros({ registrosAgrupadosPorMes, onSelectData }) {
  const [expandido, setExpandido] = useState(false);
  const [mesesExpandidos, setMesesExpandidos] = useState({});

  const toggleMes = (chave) => {
    setMesesExpandidos(prev => ({ ...prev, [chave]: !prev[chave] }));
  };

  const temRegistros = registrosAgrupadosPorMes.length > 0;

  return (
    <div className="rounded-2xl border border-glass-border bg-hawk-card shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-glass-border flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-hawk-muted flex items-center gap-2">
          <span>📜</span> Histórico de Registros
        </p>
        {temRegistros && (
          <button
            onClick={() => setExpandido(v => !v)}
            className="text-xs font-semibold text-hawk-muted hover:text-hawk-text border border-glass-border hover:border-hawk-purple/40 px-3 py-1.5 rounded-lg transition-all duration-200"
          >
            {expandido ? '↕️ Minimizar' : '↕️ Expandir'}
          </button>
        )}
      </div>

      <div className="p-5">
        {!temRegistros ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-hawk-muted">
            <span className="text-4xl opacity-30">📂</span>
            <p className="text-sm">Nenhum registro encontrado. Comece salvando seu primeiro dia!</p>
          </div>
        ) : !expandido ? (
          /* Minimizado */
          <button
            onClick={() => setExpandido(true)}
            className="w-full flex items-center justify-center gap-3 py-5 rounded-xl
                       border border-dashed border-glass-border hover:border-hawk-purple/40
                       text-hawk-muted hover:text-hawk-text transition-all duration-200 text-sm"
          >
            <span>📂</span>
            <span>
              Histórico minimizado —{' '}
              <strong className="text-hawk-purple">clique para expandir</strong>
            </span>
          </button>
        ) : (
          /* Expandido */
          <div className="space-y-3 animate-fade-in">
            {registrosAgrupadosPorMes.map((grupo, idx) => {
              const isOpen = mesesExpandidos[grupo.chave] !== undefined
                ? mesesExpandidos[grupo.chave]
                : idx === 0;

              return (
                <div
                  key={grupo.chave}
                  className="rounded-xl border border-glass-border overflow-hidden"
                >
                  {/* Cabeçalho do mês */}
                  <button
                    onClick={() => toggleMes(grupo.chave)}
                    className="w-full flex items-center justify-between px-4 py-4
                               hover:bg-hawk-hover transition-colors duration-200 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">📅</span>
                      <span className="font-semibold text-hawk-text text-sm capitalize">
                        {grupo.nomeMes}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Resumo rápido */}
                      <div className="hidden sm:flex items-center gap-4 text-xs text-hawk-muted">
                        <span>
                          Bruto: <strong className="text-hawk-violet">{formatarMoeda(grupo.totalBruto)}</strong>
                        </span>
                        <span>
                          Líquido: <strong className={grupo.totalLiquido < 0 ? 'text-hawk-red' : 'text-hawk-green'}>
                            {formatarMoeda(grupo.totalLiquido)}
                          </strong>
                        </span>
                        <span>
                          Km: <strong className="text-hawk-text">{grupo.totalKm}</strong>
                        </span>
                      </div>
                      <span className={`text-hawk-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </div>
                  </button>

                  {/* Tabela do mês */}
                  {isOpen && (
                    <div className="border-t border-glass-border overflow-x-auto scrollbar-none">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-hawk-bg2">
                            {['Data', 'Km', 'Bruto', 'Gastos', 'Líquido', 'Viagens', 'Horas'].map(col => (
                              <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold text-hawk-muted uppercase tracking-wider whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-glass-border">
                          {grupo.registros.map(r => {
                            const rBruto   = r.totalBruto || 0;
                            const rGastos  = r.gastosGerais || 0;
                            const rLiquido = r.totalLiquido != null ? r.totalLiquido : rBruto - rGastos;
                            return (
                              <tr
                                key={r.id}
                                onClick={() => onSelectData(new Date(r.id + 'T12:00:00'))}
                                className="hover:bg-hawk-hover cursor-pointer transition-colors duration-150"
                              >
                                <td className="px-4 py-3 text-hawk-text font-medium whitespace-nowrap">
                                  {formatarDataExibicao(r.id)}
                                </td>
                                <td className="px-4 py-3 text-hawk-muted whitespace-nowrap">
                                  {r.km != null ? r.km : 0}
                                </td>
                                <td className="px-4 py-3 text-hawk-violet font-semibold whitespace-nowrap">
                                  {formatarMoeda(rBruto)}
                                </td>
                                <td className="px-4 py-3 text-hawk-red whitespace-nowrap">
                                  {formatarMoeda(rGastos)}
                                </td>
                                <td className={`px-4 py-3 font-semibold whitespace-nowrap ${rLiquido < 0 ? 'text-hawk-red' : 'text-hawk-green'}`}>
                                  {formatarMoeda(rLiquido)}
                                </td>
                                <td className="px-4 py-3 text-hawk-muted whitespace-nowrap">
                                  {r.viagens != null ? r.viagens : 0}
                                </td>
                                <td className="px-4 py-3 text-hawk-muted whitespace-nowrap">
                                  {r.horarioRodado || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {/* Totais do mês */}
                        <tfoot>
                          <tr className="bg-hawk-bg2 border-t border-glass-border">
                            <td className="px-4 py-2.5 text-xs font-bold text-hawk-muted uppercase">Total</td>
                            <td className="px-4 py-2.5 text-xs font-bold text-hawk-text">{grupo.totalKm} km</td>
                            <td className="px-4 py-2.5 text-xs font-bold text-hawk-violet">{formatarMoeda(grupo.totalBruto)}</td>
                            <td className="px-4 py-2.5 text-xs font-bold text-hawk-red">{formatarMoeda(grupo.totalGastos)}</td>
                            <td className={`px-4 py-2.5 text-xs font-bold ${grupo.totalLiquido < 0 ? 'text-hawk-red' : 'text-hawk-green'}`}>
                              {formatarMoeda(grupo.totalLiquido)}
                            </td>
                            <td className="px-4 py-2.5 text-xs font-bold text-hawk-text">{grupo.totalViagens}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
