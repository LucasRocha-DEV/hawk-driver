import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

const PADRAO = { pctEmergencia: 10, pctManutencao: 10, pctEmpresa: 30, pctLivre: 10, pctContas: 20 };

// As caixinhas têm DUAS bases de cálculo diferentes — por isso a tela é agrupada por base,
// garantindo que o que o usuário vê é exatamente o que é validado.
//   BRUTO   → Emergência + Manutenção (saem do faturamento total)
//   LÍQUIDO → Empresa + Livre + Contas (saem do que sobra após combustível e gastos)
const GRUPOS = [
  {
    chave: 'bruto',
    titulo: 'Bruto',
    subtitulo: 'Emergência + Manutenção',
    campos: [
      { id: 'pctEmergencia', label: '🚨 Reserva de Emergência', cor: '#ffd93d' },
      { id: 'pctManutencao', label: '🔧 Manutenção', cor: '#ff6b6b' },
    ],
  },
  {
    chave: 'liquido',
    titulo: 'Líquido',
    subtitulo: 'Empresa + Livre + Contas',
    campos: [
      { id: 'pctEmpresa', label: '🏢 Empresa', cor: '#6c5ce7' },
      { id: 'pctLivre', label: '💸 Livre / Lazer', cor: '#00b894' },
      { id: 'pctContas', label: '💳 Contas', cor: '#0984e3' },
    ],
  },
];

const inputClass =
  'w-20 bg-hawk-input border border-glass-border rounded-lg px-3 py-2 text-hawk-text text-sm text-right ' +
  'focus:outline-none focus:border-hawk-green/50 focus:ring-1 focus:ring-hawk-green/20 transition-colors';

const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

/**
 * Editor das porcentagens das caixinhas — barras segmentadas por base.
 * Lê e grava direto em configuracoes/caixinhas — a UberTab reage via onSnapshot.
 *
 * Integridade: cada base (Bruto e Líquido) só pode somar até 100%. O input é
 * travado (clamp) para nunca ultrapassar, e o botão fica bloqueado por garantia.
 */
export default function CaixinhasConfig() {
  const { usuario } = useAuth();
  const [pcts, setPcts] = useState(PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    const ref = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'caixinhas');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPcts({
          pctEmergencia: d.pctEmergencia ?? PADRAO.pctEmergencia,
          pctManutencao: d.pctManutencao ?? PADRAO.pctManutencao,
          pctEmpresa: d.pctEmpresa ?? PADRAO.pctEmpresa,
          pctLivre: d.pctLivre ?? PADRAO.pctLivre,
          pctContas: d.pctContas ?? PADRAO.pctContas,
        });
      }
    });
    return () => unsub();
  }, [usuario]);

  const totalGrupo = (grupo) => grupo.campos.reduce((s, c) => s + num(pcts[c.id]), 0);

  // Altera um campo travando para que a base nunca ultrapasse 100%.
  const set = (grupo, campo, valor) => {
    setSalvo(false);
    if (valor === '') {
      setPcts((p) => ({ ...p, [campo]: '' }));
      return;
    }
    let n = num(valor);
    if (n < 0) n = 0;
    const outros = grupo.campos.filter((c) => c.id !== campo).reduce((s, c) => s + num(pcts[c.id]), 0);
    const maxPermitido = Math.max(0, 100 - outros);
    if (n > maxPermitido) n = maxPermitido; // clamp: impossível exceder a base
    setPcts((p) => ({ ...p, [campo]: n }));
  };

  const algumInvalido = GRUPOS.some((g) => totalGrupo(g) > 100);

  const salvar = async (e) => {
    e.preventDefault();
    if (!usuario || algumInvalido) return;
    setSalvando(true);
    try {
      const ref = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'caixinhas');
      await setDoc(
        ref,
        {
          pctEmergencia: num(pcts.pctEmergencia),
          pctManutencao: num(pcts.pctManutencao),
          pctEmpresa: num(pcts.pctEmpresa),
          pctLivre: num(pcts.pctLivre),
          pctContas: num(pcts.pctContas),
          atualizadoEm: serverTimestamp(),
        },
        { merge: true }
      );
      setSalvo(true);
    } catch (err) {
      console.error('Erro ao salvar porcentagens:', err);
      alert('Não foi possível salvar. Tente novamente.');
    }
    setSalvando(false);
  };

  return (
    <form onSubmit={salvar} className="space-y-5 pt-1">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚙️</span>
        <h3 className="text-sm font-bold text-hawk-text">Ajustar Porcentagens das Caixinhas</h3>
      </div>

      {/* ── Barras de alocação por base ── */}
      <div className="space-y-4">
        {GRUPOS.map((g) => {
          const total = totalGrupo(g);
          const disponivel = Math.max(0, 100 - total);
          return (
            <div key={g.chave}>
              <div className="flex justify-between items-baseline text-xs text-hawk-muted mb-1.5">
                <span>
                  Alocação do <strong className="text-hawk-text">{g.titulo}</strong>{' '}
                  <span className="text-hawk-dim">({g.subtitulo})</span>
                </span>
                <span className={`font-bold ${total === 100 ? 'text-hawk-green' : 'text-hawk-text'}`}>
                  {total}%
                </span>
              </div>
              {/* Barra segmentada: cada caixinha é uma fatia colorida; a sobra fica cinza ("Livre") */}
              <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-glass gap-px">
                {g.campos.map((c) => {
                  const v = num(pcts[c.id]);
                  if (v <= 0) return null;
                  return (
                    <div
                      key={c.id}
                      className="h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, v)}%`, background: c.cor }}
                      title={`${c.label}: ${v}%`}
                    />
                  );
                })}
                {disponivel > 0 && (
                  <div
                    className="h-full transition-all duration-300 opacity-40"
                    style={{ width: `${disponivel}%`, background: 'rgb(var(--hawk-dim))' }}
                    title={`Livre na conta: ${disponivel}%`}
                  />
                )}
              </div>
              <p className="text-[11px] mt-1 text-hawk-muted">
                {total === 100 ? (
                  '✅ 100% distribuído'
                ) : (
                  <>
                    <span className="inline-block w-2 h-2 rounded-sm align-middle mr-1 opacity-40" style={{ background: 'rgb(var(--hawk-dim))' }} />
                    Livre na conta: <strong className="text-hawk-text">{disponivel}%</strong>
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Inputs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GRUPOS.flatMap((g) =>
          g.campos.map(({ id, label, cor }) => {
            const outros = g.campos.filter((c) => c.id !== id).reduce((s, c) => s + num(pcts[c.id]), 0);
            const maxCampo = Math.max(0, 100 - outros);
            return (
              <div key={id} className="flex flex-col gap-1.5">
                <label className="text-xs text-hawk-muted font-semibold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: cor }} />
                  {label} <span className="text-hawk-dim font-normal">(% {g.titulo})</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className={inputClass}
                    value={pcts[id]}
                    onChange={(e) => set(g, id, e.target.value)}
                    min="0"
                    max={maxCampo}
                    step="1"
                  />
                  <span className="text-hawk-muted text-sm font-bold">%</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        type="submit"
        disabled={salvando || algumInvalido}
        className="w-full py-3 rounded-xl bg-hawk-purple text-white font-bold text-sm hover:opacity-90 hover:shadow-purple-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
      >
        {algumInvalido ? '⚠️ Alguma base passou de 100%' : salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : '💾 Salvar Porcentagens'}
      </button>
    </form>
  );
}
