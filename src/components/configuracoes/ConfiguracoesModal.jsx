import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePreferencias } from '../../contexts/PreferenciasContext';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import MeusVeiculos from './MeusVeiculos';
import CaixinhasConfig from './CaixinhasConfig';
import PessoasVinculadas from './PessoasVinculadas';

const inputClass =
  'w-full bg-hawk-input border border-glass-border rounded-xl px-3 py-2 text-hawk-text text-sm ' +
  'placeholder:text-hawk-dim focus:outline-none focus:border-hawk-green/50 focus:ring-1 ' +
  'focus:ring-hawk-green/20 transition-colors duration-200';

// ── Seção colapsável ──
function Secao({ icone, titulo, descricao, children, aberta, onToggle }) {
  return (
    <div className="rounded-2xl border border-glass-border bg-hawk-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-glass-hover transition-colors"
      >
        <span className="text-xl flex-shrink-0">{icone}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-hawk-text">{titulo}</span>
          {descricao && <span className="block text-xs text-hawk-muted">{descricao}</span>}
        </span>
        <span className={`text-hawk-muted transition-transform duration-200 ${aberta ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {aberta && <div className="px-4 pb-4 pt-1 border-t border-glass-border">{children}</div>}
    </div>
  );
}

// ── Aparência (tema) ──
function Aparencia() {
  const { tema, setTema } = usePreferencias();
  const opcoes = [
    { id: 'dark', label: '🌙 Escuro' },
    { id: 'light', label: '☀️ Claro' },
  ];
  return (
    <div className="pt-3">
      <div className="flex gap-2">
        {opcoes.map((o) => (
          <button
            key={o.id}
            onClick={() => setTema(o.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              tema === o.id
                ? 'border-hawk-green/40 bg-hawk-green/10 text-hawk-green'
                : 'border-glass-border bg-hawk-input text-hawk-muted hover:text-hawk-text'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── IA (Gemini API Key) ──
function IAConfig() {
  const { usuario } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    (async () => {
      const snap = await getDoc(doc(db, 'usuarios', usuario.uid, 'configuracoes', 'ia'));
      if (snap.exists() && snap.data().apiKey) setApiKey(snap.data().apiKey);
    })();
  }, [usuario]);

  const salvar = async () => {
    if (!usuario) return;
    setSalvando(true);
    try {
      await setDoc(
        doc(db, 'usuarios', usuario.uid, 'configuracoes', 'ia'),
        { apiKey, atualizadoEm: serverTimestamp() },
        { merge: true }
      );
      setSalvo(true);
    } catch (err) {
      console.error('Erro ao salvar API Key:', err);
    }
    setSalvando(false);
  };

  return (
    <div className="pt-3 space-y-3">
      <p className="text-xs text-hawk-muted leading-relaxed">
        Cole sua chave do Google Gemini para usar o assistente de IA na aba de Análise. O tipo de veículo
        usado pela IA agora vem do seu veículo ativo em <strong className="text-hawk-text">Meus Veículos</strong>.
      </p>
      <input
        type="password"
        className={inputClass}
        placeholder="Sua chave da API Gemini..."
        value={apiKey}
        onChange={(e) => {
          setApiKey(e.target.value);
          setSalvo(false);
        }}
      />
      <button
        onClick={salvar}
        disabled={salvando}
        className="w-full py-2.5 rounded-xl bg-hawk-purple text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : 'Salvar chave'}
      </button>
    </div>
  );
}

// ── Modal principal ──
export default function ConfiguracoesModal({ onClose }) {
  const [secaoAberta, setSecaoAberta] = useState('aparencia');
  const toggle = (id) => setSecaoAberta((atual) => (atual === id ? null : id));

  // Fecha com ESC
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Painel */}
      <div className="relative z-10 w-full sm:max-w-lg max-h-screen sm:max-h-[90vh] flex flex-col bg-hawk-bg sm:rounded-3xl border border-glass-border shadow-card animate-fade-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-glass-border bg-hawk-bg/80 backdrop-blur-md">
          <h2 className="text-base font-bold text-hawk-text flex items-center gap-2">
            <span>⚙️</span> Configurações
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-hawk-muted hover:text-hawk-text hover:bg-glass-hover transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <Secao
            icone="🎨"
            titulo="Aparência"
            descricao="Tema claro ou escuro"
            aberta={secaoAberta === 'aparencia'}
            onToggle={() => toggle('aparencia')}
          >
            <Aparencia />
          </Secao>

          <Secao
            icone="🚗"
            titulo="Meus Veículos"
            descricao="Cadastro e estimativa de combustível"
            aberta={secaoAberta === 'veiculos'}
            onToggle={() => toggle('veiculos')}
          >
            <div className="pt-3">
              <MeusVeiculos />
            </div>
          </Secao>

          <Secao
            icone="👥"
            titulo="Pessoas Vinculadas"
            descricao="Quem divide gastos com você (esposa, filho, mãe...)"
            aberta={secaoAberta === 'pessoa'}
            onToggle={() => toggle('pessoa')}
          >
            <PessoasVinculadas />
          </Secao>

          <Secao
            icone="💰"
            titulo="Caixinhas (%)"
            descricao="Distribuição do faturamento"
            aberta={secaoAberta === 'caixinhas'}
            onToggle={() => toggle('caixinhas')}
          >
            <div className="pt-3">
              <CaixinhasConfig />
            </div>
          </Secao>

          <Secao
            icone="🤖"
            titulo="Inteligência Artificial"
            descricao="Chave da API Gemini"
            aberta={secaoAberta === 'ia'}
            onToggle={() => toggle('ia')}
          >
            <IAConfig />
          </Secao>
        </div>
      </div>
    </div>
  );
}
