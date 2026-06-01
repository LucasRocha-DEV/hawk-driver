import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Context de preferências / configurações do usuário (Hawk Driver).
 *
 * Centraliza tudo que é "configuração da conta":
 *   - Rótulo configurável da "pessoa vinculada" (ex.: Esposa, Filho, Sócio)
 *   - Tema da interface (claro / escuro)
 *   - Veículos cadastrados + veículo ativo (usado para estimar combustível)
 *
 * Persistência:
 *   usuarios/{uid}/configuracoes/preferencias   → rótulo, emoji, tema, veiculoAtivoId
 *   usuarios/{uid}/veiculos/{veiculoId}         → cada veículo cadastrado
 */

const DEFAULT_ROTULO = 'Esposa';
const DEFAULT_EMOJI = '👩';
const DEFAULT_TEMA = 'dark';
const TEMA_STORAGE_KEY = 'hawk_driver_tema';

const gerarPessoaId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function aplicarTema(tema) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = tema === 'light' ? 'light' : 'dark';
  }
}

const PreferenciasContext = createContext({
  rotuloEsposa: DEFAULT_ROTULO,
  emojiEsposa: DEFAULT_EMOJI,
  salvarRotuloPessoa: async () => {},
  pessoasVinculadas: [],
  salvarPessoasVinculadas: async () => {},
  tema: DEFAULT_TEMA,
  setTema: () => {},
  veiculos: [],
  veiculoAtivoId: null,
  veiculoAtivo: null,
  salvarVeiculo: async () => {},
  removerVeiculo: async () => {},
  definirVeiculoAtivo: async () => {},
});

export function usePreferencias() {
  return useContext(PreferenciasContext);
}

export function PreferenciasProvider({ children }) {
  const { usuario } = useAuth();
  const [pessoasVinculadas, setPessoasVinculadas] = useState([
    { id: 'principal', nome: DEFAULT_ROTULO, emoji: DEFAULT_EMOJI },
  ]);
  const [veiculos, setVeiculos] = useState([]);
  const [veiculosCarregados, setVeiculosCarregados] = useState(false);
  const [veiculoAtivoId, setVeiculoAtivoId] = useState(null);

  // Tema: inicializa do localStorage (instantâneo, evita flash) e sincroniza com o Firestore.
  const [tema, setTemaState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TEMA_STORAGE_KEY) || DEFAULT_TEMA;
    }
    return DEFAULT_TEMA;
  });

  // Aplica o tema na raiz do documento sempre que muda.
  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  // ─── Listener: documento de preferências ───
  useEffect(() => {
    if (!usuario) {
      setPessoasVinculadas([{ id: 'principal', nome: DEFAULT_ROTULO, emoji: DEFAULT_EMOJI }]);
      setVeiculoAtivoId(null);
      return;
    }

    const ref = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'preferencias');
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? snap.data() : {};

      // Pessoas vinculadas: usa a lista nova; senão migra do rótulo único antigo.
      if (Array.isArray(data.pessoasVinculadas) && data.pessoasVinculadas.length > 0) {
        setPessoasVinculadas(data.pessoasVinculadas);
      } else {
        setPessoasVinculadas([
          {
            id: 'principal',
            nome: data.rotuloEsposa?.trim() || DEFAULT_ROTULO,
            emoji: data.emojiEsposa?.trim() || DEFAULT_EMOJI,
          },
        ]);
      }

      setVeiculoAtivoId(data.veiculoAtivoId || null);
      if (data.tema && data.tema !== tema) {
        setTemaState(data.tema);
        localStorage.setItem(TEMA_STORAGE_KEY, data.tema);
      }
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  // ─── Listener: veículos cadastrados ───
  useEffect(() => {
    if (!usuario) {
      setVeiculos([]);
      setVeiculosCarregados(false);
      return;
    }
    const ref = collection(db, 'usuarios', usuario.uid, 'veiculos');
    const unsub = onSnapshot(ref, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setVeiculos(lista);
      setVeiculosCarregados(true);
    });
    return unsub;
  }, [usuario]);

  // ─── Veículo ativo derivado ───
  const veiculoAtivo = useMemo(() => {
    if (!veiculos.length) return null;
    return veiculos.find((v) => v.id === veiculoAtivoId) || veiculos[0];
  }, [veiculos, veiculoAtivoId]);

  // Rótulo/emoji da primeira pessoa — derivados, para compatibilidade com telas antigas.
  const rotuloEsposa = pessoasVinculadas[0]?.nome || DEFAULT_ROTULO;
  const emojiEsposa = pessoasVinculadas[0]?.emoji || DEFAULT_EMOJI;

  // ─── Ações ───
  // Persiste a lista completa de pessoas vinculadas (+ rótulo único antigo p/ compat).
  const salvarPessoasVinculadas = async (lista) => {
    if (!usuario) return;
    const limpa = (lista || [])
      .map((p) => ({
        id: p.id || gerarPessoaId(),
        nome: (p.nome || '').trim(),
        emoji: (p.emoji || '👤').trim() || '👤',
      }))
      .filter((p) => p.nome);
    const final = limpa.length ? limpa : [{ id: 'principal', nome: DEFAULT_ROTULO, emoji: DEFAULT_EMOJI }];
    const ref = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'preferencias');
    await setDoc(
      ref,
      {
        pessoasVinculadas: final,
        rotuloEsposa: final[0].nome,
        emojiEsposa: final[0].emoji,
        atualizadoEm: serverTimestamp(),
      },
      { merge: true }
    );
  };

  // Mantido para compatibilidade: atualiza a primeira pessoa da lista.
  const salvarRotuloPessoa = async (nome, emoji) => {
    const resto = pessoasVinculadas.slice(1);
    await salvarPessoasVinculadas([
      { id: pessoasVinculadas[0]?.id || 'principal', nome, emoji },
      ...resto,
    ]);
  };

  const setTema = async (novoTema) => {
    const valor = novoTema === 'light' ? 'light' : 'dark';
    setTemaState(valor);
    localStorage.setItem(TEMA_STORAGE_KEY, valor);
    aplicarTema(valor);
    if (usuario) {
      const ref = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'preferencias');
      await setDoc(ref, { tema: valor, atualizadoEm: serverTimestamp() }, { merge: true });
    }
  };

  const salvarVeiculo = async (dados, id = null) => {
    if (!usuario) return null;
    const veiculosRef = collection(db, 'usuarios', usuario.uid, 'veiculos');
    if (id) {
      await updateDoc(doc(veiculosRef, id), { ...dados, atualizadoEm: serverTimestamp() });
      return id;
    }
    const docRef = await addDoc(veiculosRef, { ...dados, criadoEm: serverTimestamp() });
    // Se for o primeiro veículo, já deixa ativo automaticamente.
    if (!veiculoAtivoId && veiculos.length === 0) {
      await definirVeiculoAtivo(docRef.id);
    }
    return docRef.id;
  };

  const removerVeiculo = async (id) => {
    if (!usuario) return;
    await deleteDoc(doc(db, 'usuarios', usuario.uid, 'veiculos', id));
    if (veiculoAtivoId === id) {
      await definirVeiculoAtivo(null);
    }
  };

  const definirVeiculoAtivo = async (id) => {
    if (!usuario) return;
    const ref = doc(db, 'usuarios', usuario.uid, 'configuracoes', 'preferencias');
    await setDoc(ref, { veiculoAtivoId: id, atualizadoEm: serverTimestamp() }, { merge: true });
  };

  const value = {
    rotuloEsposa,
    emojiEsposa,
    salvarRotuloPessoa,
    pessoasVinculadas,
    salvarPessoasVinculadas,
    tema,
    setTema,
    veiculos,
    veiculosCarregados,
    veiculoAtivoId,
    veiculoAtivo,
    salvarVeiculo,
    removerVeiculo,
    definirVeiculoAtivo,
  };

  return (
    <PreferenciasContext.Provider value={value}>
      {children}
    </PreferenciasContext.Provider>
  );
}
