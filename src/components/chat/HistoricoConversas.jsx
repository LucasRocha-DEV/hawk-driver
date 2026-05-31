// HistoricoConversas — drawer estilo ChatGPT com a lista de conversas salvas.
// Desliza sobre o painel do chat (mobile-first).

function formatarData(ts) {
  if (!ts) return '';
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HistoricoConversas({
  conversas = [],
  conversaAtivaId,
  onSelecionar,
  onApagar,
  onNova,
  onFechar,
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-hawk-bg/95 backdrop-blur-sm animate-fade-in">
      {/* Header do drawer */}
      <div className="p-4 border-b border-glass-border flex items-center justify-between">
        <h3 className="text-sm font-bold text-hawk-text flex items-center gap-2">
          <span>💬</span> Suas conversas
        </h3>
        <button
          onClick={onFechar}
          className="text-hawk-muted hover:text-hawk-text p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          title="Fechar"
        >
          ✕
        </button>
      </div>

      {/* Nova conversa */}
      <div className="p-3">
        <button
          onClick={onNova}
          className="w-full flex items-center justify-center gap-2 bg-hawk-purple hover:bg-hawk-purple/90 text-white font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-[0.98]"
        >
          ＋ Nova conversa
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {conversas.length === 0 ? (
          <p className="text-center text-xs text-hawk-muted mt-8 opacity-60">
            Nenhuma conversa salva ainda.
          </p>
        ) : (
          conversas.map((c) => {
            const ativa = c.id === conversaAtivaId;
            return (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                  ativa
                    ? 'border-hawk-purple bg-hawk-purple/10'
                    : 'border-glass-border bg-hawk-input hover:border-hawk-purple/50'
                }`}
                onClick={() => onSelecionar(c)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-hawk-text truncate">
                    {c.titulo || 'Conversa'}
                  </p>
                  <p className="text-[11px] text-hawk-muted">{formatarData(c.atualizadoEm)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onApagar(c.id); }}
                  className="text-hawk-muted hover:text-hawk-red p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Apagar conversa"
                >
                  🗑️
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
