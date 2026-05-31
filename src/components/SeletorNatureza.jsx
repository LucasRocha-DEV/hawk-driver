import { useState } from 'react';
import { usePreferencias } from '../contexts/PreferenciasContext';

/**
 * Componente reutilizável de seletor de natureza (Empresa/Pessoal) + toggle da
 * pessoa vinculada (originalmente "Esposa", agora rótulo configurável).
 * Usado em: DespesasFixasTab, GastosVariaveisTab
 *
 * Props:
 *   natureza (string)     - 'EMPRESA' ou 'PESSOAL'
 *   setNatureza (fn)      - Setter de natureza
 *   isEsposa (boolean)    - Se o gasto é da pessoa vinculada
 *   setIsEsposa (fn)      - Setter de isEsposa
 */
const EMOJIS_SUGERIDOS = ['👩', '👨', '👧', '👦', '👵', '👴', '🧑', '💑', '🤝'];

export default function SeletorNatureza({ natureza, setNatureza, isEsposa, setIsEsposa }) {
  const { rotuloEsposa, emojiEsposa, salvarRotuloPessoa } = usePreferencias();

  const [editando, setEditando] = useState(false);
  const [nomeTmp, setNomeTmp] = useState(rotuloEsposa);
  const [emojiTmp, setEmojiTmp] = useState(emojiEsposa);
  const [salvandoRotulo, setSalvandoRotulo] = useState(false);

  const abrirEditor = (e) => {
    e.stopPropagation();
    setNomeTmp(rotuloEsposa);
    setEmojiTmp(emojiEsposa);
    setEditando(true);
  };

  const salvar = async (e) => {
    e.stopPropagation();
    setSalvandoRotulo(true);
    try {
      await salvarRotuloPessoa(nomeTmp, emojiTmp);
      setEditando(false);
    } catch {
      alert('Não foi possível salvar o rótulo. Tente novamente.');
    }
    setSalvandoRotulo(false);
  };

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

      {/* Toggle da pessoa vinculada (só em PESSOAL) */}
      {natureza === 'PESSOAL' && (
        <div className="animate-fade-in space-y-2">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsEsposa(!isEsposa)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsEsposa(!isEsposa); } }}
            className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
              isEsposa
                ? 'border-hawk-pink bg-hawk-pink/10'
                : 'border-glass-border bg-hawk-input hover:border-white/20'
            }`}
          >
            <span className="text-xl leading-none select-none">{isEsposa ? '✅' : '⬜'}</span>
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-bold flex items-center gap-1.5 ${isEsposa ? 'text-hawk-pink' : 'text-hawk-text'}`}>
                <span>{emojiEsposa}</span> Gasto da {rotuloEsposa}?
              </span>
              <span className="block text-[11px] text-hawk-muted mt-0.5">
                Identifica separadamente quanto você gasta com {rotuloEsposa.toLowerCase()}.
              </span>
            </div>
            <button
              type="button"
              onClick={abrirEditor}
              title="Renomear rótulo"
              className="flex-shrink-0 w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-hawk-muted hover:text-hawk-text hover:bg-white/10 transition-colors flex items-center justify-center"
            >
              ✎
            </button>
          </div>

          {/* Editor inline do rótulo */}
          {editando && (
            <div className="animate-fade-in p-3.5 rounded-xl border border-hawk-pink/30 bg-hawk-pink/5 space-y-3">
              <p className="text-[11px] font-bold text-hawk-pink uppercase tracking-widest">
                Personalizar rótulo
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={emojiTmp}
                  onChange={(e) => setEmojiTmp(e.target.value)}
                  maxLength={2}
                  className="w-14 text-center bg-hawk-input border border-glass-border rounded-xl px-2 py-2.5 text-hawk-text text-lg focus:outline-none focus:ring-1 focus:border-hawk-pink/50 transition-colors"
                  aria-label="Emoji"
                />
                <input
                  type="text"
                  value={nomeTmp}
                  onChange={(e) => setNomeTmp(e.target.value)}
                  maxLength={24}
                  placeholder="Ex: Esposa, Filho, Mãe..."
                  className="flex-1 bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm focus:outline-none focus:ring-1 focus:border-hawk-pink/50 transition-colors"
                  aria-label="Nome do rótulo"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS_SUGERIDOS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEmojiTmp(em); }}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                      emojiTmp === em ? 'bg-hawk-pink/20 ring-1 ring-hawk-pink' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={salvar}
                  disabled={salvandoRotulo}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-bold text-hawk-bg bg-hawk-pink hover:bg-hawk-pink/90 transition-colors disabled:opacity-50"
                >
                  {salvandoRotulo ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditando(false); }}
                  className="py-2 px-4 rounded-xl text-xs font-bold text-hawk-text bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
