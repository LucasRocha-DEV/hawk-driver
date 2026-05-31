import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Context de preferências do usuário (Hawk Driver).
 *
 * Hoje guarda apenas o rótulo configurável da "pessoa vinculada" (originalmente
 * "Esposa"), permitindo que cada usuário renomeie para o que fizer sentido
 * (ex.: "Filho", "Mãe", "Sócio"). O dado vive em:
 *   usuarios/{uid}/configuracoes/preferencias
 *
 * Expõe:
 *   rotuloEsposa (string)        - Nome do rótulo (default 'Esposa')
 *   emojiEsposa (string)         - Emoji do rótulo (default '👩')
 *   salvarRotuloPessoa (fn)      - async (nome, emoji) => void
 */

const DEFAULT_ROTULO = 'Esposa';
const DEFAULT_EMOJI = '👩';

const PreferenciasContext = createContext({
  rotuloEsposa: DEFAULT_ROTULO,
  emojiEsposa: DEFAULT_EMOJI,
  salvarRotuloPessoa: async () => {},
});

export function usePreferencias() {
  return useContext(PreferenciasContext);
}

export function PreferenciasProvider({ children }) {
  const { usuario } = useAuth();
  const [rotuloEsposa, setRotuloEsposa] = useState(DEFAULT_ROTULO);
  const [emojiEsposa, setEmojiEsposa] = useState(DEFAULT_EMOJI);

  useEffect(() => {
    if (!usuario) {
      setRotuloEsposa(DEFAULT_ROTULO);
      setEmojiEsposa(DEFAULT_EMOJI);
      return;
    }

    const ref = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'preferencias');
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setRotuloEsposa(data.rotuloEsposa?.trim() || DEFAULT_ROTULO);
      setEmojiEsposa(data.emojiEsposa?.trim() || DEFAULT_EMOJI);
    });

    return unsub;
  }, [usuario]);

  const salvarRotuloPessoa = async (nome, emoji) => {
    if (!usuario) return;
    const ref = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'preferencias');
    await setDoc(
      ref,
      {
        rotuloEsposa: (nome || '').trim() || DEFAULT_ROTULO,
        emojiEsposa: (emoji || '').trim() || DEFAULT_EMOJI,
        atualizadoEm: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const value = {
    rotuloEsposa,
    emojiEsposa,
    salvarRotuloPessoa,
  };

  return (
    <PreferenciasContext.Provider value={value}>
      {children}
    </PreferenciasContext.Provider>
  );
}
