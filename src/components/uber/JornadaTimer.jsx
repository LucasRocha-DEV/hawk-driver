// JornadaTimer — Cronômetro de jornada com botões de controle
export default function JornadaTimer({
  jornadaAtiva,
  tempoDecorrido,
  formatarTempoTimer,
  onIniciar,
  onPausar,
  onRetomar,
  onEncerrar,
}) {
  const timerColor = jornadaAtiva
    ? 'text-hawk-green drop-shadow-[0_0_20px_rgba(0,212,170,0.5)]'
    : tempoDecorrido > 0
    ? 'text-hawk-yellow'
    : 'text-hawk-text';

  return (
    <div className="rounded-2xl border border-glass-border bg-hawk-card shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-glass-border">
        <p className="text-xs font-bold uppercase tracking-widest text-hawk-muted flex items-center gap-2">
          <span>⏱️</span> Jornada de Trabalho
        </p>
      </div>

      {/* Timer display */}
      <div className="flex flex-col items-center gap-6 px-6 py-8">
        <div
          className={`font-mono font-extrabold leading-none tracking-widest transition-colors duration-500 ${timerColor}`}
          style={{ fontSize: 'clamp(3rem, 12vw, 5.5rem)' }}
        >
          {formatarTempoTimer(tempoDecorrido)}
        </div>

        {/* Status badge */}
        <div className={`text-xs font-semibold px-3 py-1 rounded-full border ${
          jornadaAtiva
            ? 'bg-hawk-green/10 border-hawk-green/30 text-hawk-green'
            : tempoDecorrido > 0
            ? 'bg-hawk-yellow/10 border-hawk-yellow/30 text-hawk-yellow'
            : 'bg-hawk-card border-glass-border text-hawk-muted'
        }`}>
          {jornadaAtiva ? '● Em andamento' : tempoDecorrido > 0 ? '⏸ Pausado' : '○ Aguardando início'}
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap justify-center gap-3 w-full max-w-sm">
          {!jornadaAtiva && tempoDecorrido === 0 && (
            <button
              onClick={onIniciar}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                         bg-hawk-green text-hawk-bg font-bold text-sm
                         hover:opacity-90 hover:shadow-green-glow transition-all duration-200 active:scale-[0.97]"
            >
              ▶ Iniciar Jornada
            </button>
          )}

          {jornadaAtiva && (
            <button
              onClick={onPausar}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                         bg-hawk-yellow/10 border border-hawk-yellow/30 text-hawk-yellow font-bold text-sm
                         hover:bg-hawk-yellow/20 transition-all duration-200 active:scale-[0.97]"
            >
              ⏸ Pausar
            </button>
          )}

          {!jornadaAtiva && tempoDecorrido > 0 && (
            <button
              onClick={onRetomar}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                         bg-hawk-green/10 border border-hawk-green/30 text-hawk-green font-bold text-sm
                         hover:bg-hawk-green/20 transition-all duration-200 active:scale-[0.97]"
            >
              ▶ Retomar
            </button>
          )}

          {(jornadaAtiva || tempoDecorrido > 0) && (
            <button
              onClick={onEncerrar}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                         bg-hawk-red/10 border border-hawk-red/30 text-hawk-red font-bold text-sm
                         hover:bg-hawk-red/20 transition-all duration-200 active:scale-[0.97]"
            >
              ⏹ Encerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
