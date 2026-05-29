import { formatarMoeda } from '../../utils/helpers';

export default function RepasseModal({ saldoRetido, processando, onConfirmar, onCancelar }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-glass-border bg-hawk-card shadow-card-hover p-8 space-y-6 animate-fade-up">

        {/* Título */}
        <div className="text-center">
          <div className="text-4xl mb-3">🤑</div>
          <h3 className="text-xl font-bold text-hawk-text">Distribuir Repasse</h3>
          <p className="text-sm text-hawk-muted mt-2 leading-relaxed">
            O app vai pegar seu saldo acumulado e dividir automaticamente nas Caixinhas de Patrimônio.
          </p>
        </div>

        {/* Valor a distribuir */}
        <div className="rounded-xl border border-hawk-teal/30 bg-hawk-teal/8 p-5 text-center space-y-1">
          <p className="text-xs text-hawk-teal font-semibold uppercase tracking-widest">
            Valor que será distribuído
          </p>
          <p className="text-4xl font-extrabold text-hawk-teal">
            {formatarMoeda(saldoRetido)}
          </p>
        </div>

        {/* Aviso */}
        <div className="rounded-xl border border-hawk-yellow/20 bg-hawk-yellow/5 px-4 py-3 text-xs text-hawk-yellow leading-relaxed">
          ⚠️ Esta ação é irreversível. O saldo será distribuído e zerado no painel "A Receber dos Apps".
        </div>

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={onConfirmar}
            disabled={processando}
            className="flex-1 py-3.5 rounded-xl font-bold text-sm text-hawk-bg
                       bg-gradient-to-r from-hawk-teal to-hawk-blue
                       hover:opacity-90 hover:shadow-[0_0_20px_rgba(0,184,148,0.3)]
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 active:scale-[0.97]"
          >
            {processando ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-hawk-bg/30 border-t-hawk-bg rounded-full animate-spin" />
                Processando...
              </span>
            ) : (
              'Confirmar Repasse'
            )}
          </button>
          <button
            onClick={onCancelar}
            disabled={processando}
            className="px-6 py-3.5 rounded-xl font-semibold text-sm text-hawk-muted
                       border border-glass-border hover:border-hawk-text/20 hover:text-hawk-text
                       transition-all duration-200"
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>
  );
}
