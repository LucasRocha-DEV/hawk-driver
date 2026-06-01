import { useEffect, useState } from 'react';
import { usePreferencias } from '../../contexts/PreferenciasContext';

const inputClass =
  'w-full bg-hawk-input border border-glass-border rounded-xl px-3 py-2 text-hawk-text text-sm ' +
  'placeholder:text-hawk-dim focus:outline-none focus:border-hawk-green/50 focus:ring-1 ' +
  'focus:ring-hawk-green/20 transition-colors duration-200';

const EMOJIS = ['👩', '👨', '🧑', '👧', '👦', '👵', '👴', '🧒', '👶', '🤝'];

const novaPessoa = () => ({ id: '', nome: '', emoji: '👤' });

export default function PessoasVinculadas() {
  const { pessoasVinculadas, salvarPessoasVinculadas } = usePreferencias();
  const [lista, setLista] = useState(pessoasVinculadas);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    setLista(pessoasVinculadas);
  }, [pessoasVinculadas]);

  const atualizar = (idx, campo, valor) => {
    setLista((l) => l.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
    setSalvo(false);
  };
  const adicionar = () => {
    setLista((l) => [...l, novaPessoa()]);
    setSalvo(false);
  };
  const remover = (idx) => {
    setLista((l) => l.filter((_, i) => i !== idx));
    setSalvo(false);
  };

  const salvar = async () => {
    if (!lista.some((p) => (p.nome || '').trim())) {
      alert('Cadastre pelo menos uma pessoa (ex: Esposa).');
      return;
    }
    setSalvando(true);
    try {
      await salvarPessoasVinculadas(lista);
      setSalvo(true);
    } catch (err) {
      console.error('Erro ao salvar pessoas:', err);
      alert('Não foi possível salvar. Tente novamente.');
    }
    setSalvando(false);
  };

  return (
    <div className="pt-3 space-y-3">
      <p className="text-sm text-hawk-muted leading-relaxed">
        Cadastre as pessoas com quem você divide gastos (ex.: <strong className="text-hawk-text">Esposa</strong>,{' '}
        <strong className="text-hawk-text">Filho</strong>, <strong className="text-hawk-text">Mãe</strong>). Ao
        lançar uma despesa pessoal, você escolhe de quem é o gasto.
      </p>

      <div className="space-y-3">
        {lista.map((p, idx) => (
          <div key={idx} className="rounded-xl border border-glass-border bg-hawk-input/40 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={p.emoji}
                onChange={(e) => atualizar(idx, 'emoji', e.target.value)}
                maxLength={2}
                aria-label="Emoji"
                className="w-12 text-center bg-hawk-input border border-glass-border rounded-xl px-2 py-2 text-lg focus:outline-none focus:border-hawk-green/50"
              />
              <input
                type="text"
                value={p.nome}
                onChange={(e) => atualizar(idx, 'nome', e.target.value)}
                maxLength={24}
                placeholder="Nome (ex: Esposa, Filho, Mãe)"
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => remover(idx)}
                title="Remover"
                className="p-2 rounded-lg text-hawk-muted hover:text-hawk-red hover:bg-hawk-red/10 transition-colors flex-shrink-0"
              >
                🗑️
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => atualizar(idx, 'emoji', em)}
                  className={`w-8 h-8 rounded-lg text-base transition-colors ${
                    p.emoji === em
                      ? 'bg-hawk-green/15 ring-1 ring-hawk-green'
                      : 'bg-glass hover:bg-glass-hover'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={adicionar}
        className="w-full py-2 rounded-xl border border-dashed border-hawk-green/40 text-hawk-green text-sm font-semibold hover:bg-hawk-green/5 transition-colors"
      >
        + Adicionar pessoa
      </button>

      <button
        onClick={salvar}
        disabled={salvando}
        className="w-full py-2.5 rounded-xl bg-hawk-green text-hawk-bg font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : 'Salvar pessoas'}
      </button>
    </div>
  );
}
