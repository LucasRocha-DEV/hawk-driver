import { usePreferencias } from '../contexts/PreferenciasContext';

/**
 * Seletor de natureza (Empresa/Pessoal) + escolha de qual pessoa vinculada é o gasto.
 * Usado em: DespesasFixasTab, GastosVariaveisTab
 *
 * Props:
 *   natureza (string)         - 'EMPRESA' ou 'PESSOAL'
 *   setNatureza (fn)          - Setter de natureza
 *   pessoaId (string|null)    - Id da pessoa vinculada selecionada (null = gasto próprio)
 *   onSelectPessoa (fn)       - (pessoa|null) => void — pessoa = {id, nome, emoji}
 */
export default function SeletorNatureza({ natureza, setNatureza, pessoaId, onSelectPessoa }) {
  const { pessoasVinculadas } = usePreferencias();

  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold text-hawk-muted uppercase tracking-widest">
        Natureza do Gasto <span className="normal-case font-medium text-hawk-dim">(De onde sai o dinheiro?)</span>
      </label>

      {/* Botões Empresa / Pessoal */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setNatureza('EMPRESA')}
          className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
            natureza === 'EMPRESA'
              ? 'border-hawk-purple bg-hawk-purple/10 text-hawk-purple shadow-purple-glow'
              : 'border-glass-border bg-hawk-input text-hawk-muted hover:border-white/20 hover:text-hawk-text'
          }`}
        >
          <span className="text-2xl leading-none">🏢</span>
          <span className="text-sm font-bold">Custo Empresa</span>
        </button>

        <button
          type="button"
          onClick={() => setNatureza('PESSOAL')}
          className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
            natureza === 'PESSOAL'
              ? 'border-hawk-blue bg-hawk-blue/10 text-hawk-blue'
              : 'border-glass-border bg-hawk-input text-hawk-muted hover:border-white/20 hover:text-hawk-text'
          }`}
        >
          <span className="text-2xl leading-none">👤</span>
          <span className="text-sm font-bold">Custo Pessoal</span>
        </button>
      </div>

      {/* Escolha de quem é o gasto (só em PESSOAL) */}
      {natureza === 'PESSOAL' && (
        <div className="animate-fade-in space-y-2">
          <p className="text-xs font-semibold text-hawk-muted">De quem é este gasto?</p>
          <div className="flex flex-wrap gap-2">
            {/* Próprio */}
            <button
              type="button"
              onClick={() => onSelectPessoa(null)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-200 ${
                !pessoaId
                  ? 'border-hawk-blue bg-hawk-blue/10 text-hawk-blue'
                  : 'border-glass-border bg-hawk-input text-hawk-muted hover:text-hawk-text'
              }`}
            >
              🙋 Meu (próprio)
            </button>

            {/* Pessoas vinculadas */}
            {pessoasVinculadas.map((p) => {
              const ativo = pessoaId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPessoa(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-200 flex items-center gap-1.5 ${
                    ativo
                      ? 'border-hawk-pink bg-hawk-pink/10 text-hawk-pink'
                      : 'border-glass-border bg-hawk-input text-hawk-muted hover:text-hawk-text'
                  }`}
                >
                  <span>{p.emoji}</span> {p.nome}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-hawk-dim">
            Gerencie as pessoas em <span className="font-semibold text-hawk-muted">⚙️ Configurações → Pessoas Vinculadas</span>.
          </p>
        </div>
      )}
    </div>
  );
}
