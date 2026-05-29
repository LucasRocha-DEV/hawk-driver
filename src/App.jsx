import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import UberTab from './components/UberTab';
import AnaliseTab from './components/AnaliseTab';
import ContasTab from './components/ContasTab';
import DespesasFixasTab from './components/DespesasFixasTab';
import GastosVariaveisTab from './components/GastosVariaveisTab';
import ObservacoesTab from './components/ObservacoesTab';
import PatrimonioTab from './components/PatrimonioTab';
import CartoesTab from './components/CartoesTab';

const TABS = [
  { id: 'uber',      label: 'Uber / Ganhos',    icon: '🚗' },
  { id: 'analise',   label: 'Análise Uber & IA', icon: '📊' },
  { id: 'contas',    label: 'Termômetro',        icon: '🧾' },
  { id: 'despesas',  label: 'Despesas Fixas',    icon: '📋' },
  { id: 'gastos',    label: 'Gastos Variáveis',  icon: '💸' },
  { id: 'cartoes',   label: 'Cartões',           icon: '💳' },
  { id: 'patrimonio',label: 'Patrimônio',        icon: '💰' },
  { id: 'notas',     label: 'Observações',       icon: '📝' },
];

// ── Error Messages ──────────────────────────────────────────────
function ErrorCard({ code, message, onClose }) {
  const config = {
    'auth/unauthorized-domain': {
      icon: '⚠️',
      title: 'Domínio Não Autorizado',
      body: (
        <>
          <p className="text-sm text-hawk-muted mb-3">
            Este domínio precisa ser adicionado no Firebase Console para permitir o login.
          </p>
          <ol className="text-sm text-hawk-muted space-y-1 list-decimal list-inside">
            <li>Acesse o <strong className="text-hawk-text">Firebase Console</strong></li>
            <li>Vá em <strong className="text-hawk-text">Authentication → Settings → Authorized domains</strong></li>
            <li>Adicione o domínio do deploy</li>
          </ol>
        </>
      ),
    },
    'auth/popup-closed-by-user': {
      icon: '⚠️',
      title: 'Login Cancelado',
      body: <p className="text-sm text-hawk-muted">A janela foi fechada antes de concluir. Tente novamente.</p>,
    },
    'auth/network-request-failed': {
      icon: '📡',
      title: 'Erro de Rede',
      body: <p className="text-sm text-hawk-muted">Falha na conexão. Verifique sua internet e tente novamente.</p>,
    },
  };

  const matched = Object.keys(config).find(k => (code || '').includes(k));
  const cfg = matched ? config[matched] : {
    icon: '❌',
    title: 'Erro ao Entrar',
    body: <p className="text-sm text-hawk-muted">{message || 'Ocorreu um erro inesperado. Tente novamente.'}</p>,
  };

  return (
    <div className="mt-4 p-4 rounded-xl border border-hawk-red/20 bg-hawk-red/5 text-left animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <span>{cfg.icon}</span>
        <strong className="text-hawk-text text-sm font-semibold">{cfg.title}</strong>
      </div>
      {cfg.body}
      <button
        onClick={onClose}
        className="mt-3 text-xs text-hawk-muted hover:text-hawk-text transition-colors duration-200 underline underline-offset-2"
      >
        Fechar
      </button>
    </div>
  );
}

// ── Login Screen ─────────────────────────────────────────────────
function LoginScreen({ onLogin, erro, limparErro }) {
  const code = erro?.code || erro?.message || '';

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-hawk-bg">
      {/* Background orbs */}
      <div className="orb w-96 h-96 -top-24 -left-24 bg-hawk-purple/10" />
      <div className="orb w-80 h-80 bottom-0 right-0 bg-hawk-green/8" />
      <div className="orb w-64 h-64 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hawk-blue/5" />

      {/* Card */}
      <div className="relative z-10 w-[90%] max-w-sm glass rounded-3xl px-10 py-12 text-center animate-fade-up shadow-card">
        {/* Logo */}
        <span className="text-6xl block mb-3 animate-float">🦅</span>
        <h1 className="text-3xl font-bold text-hawk-text mb-2 tracking-tight">Hawk Driver</h1>
        <p className="text-hawk-muted text-sm mb-8 leading-relaxed">
          Controle financeiro inteligente para motoristas de aplicativo
        </p>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mb-8 text-left">
          {[
            { icon: '📊', text: 'Ganhos diários' },
            { icon: '💰', text: 'Controle de gastos' },
            { icon: '📈', text: 'Gráficos completos' },
            { icon: '🔒', text: 'Dados seguros' },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-2 p-2.5 rounded-xl bg-glass-hover">
              <span className="text-base">{f.icon}</span>
              <span className="text-hawk-muted text-xs font-medium">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {erro && <ErrorCard code={code} message={erro.message} onClose={limparErro} />}

        {/* Login Button */}
        <button
          id="btn-login-google"
          onClick={() => onLogin().catch(() => {})}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 mt-6 rounded-xl
                     bg-hawk-card border border-glass-border text-hawk-text font-semibold text-sm
                     hover:bg-hawk-hover hover:border-hawk-green/30 hover:shadow-green-glow
                     transition-all duration-300 active:scale-[0.98]"
        >
          {/* Google SVG */}
          <svg width="18" height="18" viewBox="0 0 48 48" className="flex-shrink-0">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Entrar com Google
        </button>

        <p className="mt-4 text-hawk-dim text-xs">
          Seus dados ficam protegidos e isolados na sua conta
        </p>
      </div>
    </div>
  );
}

// ── Loading Screen ───────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-hawk-bg gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-hawk-card border-t-hawk-green animate-spin" />
      <p className="text-hawk-muted text-sm font-medium animate-pulse-slow">Carregando Hawk Driver...</p>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────
export default function App() {
  const { usuario, carregando, loginComGoogle, logout, erro, setErro } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState('uber');

  if (carregando) return <LoadingScreen />;
  if (!usuario)   return <LoginScreen onLogin={loginComGoogle} erro={erro} limparErro={() => setErro(null)} />;

  const renderTab = () => {
    switch (abaAtiva) {
      case 'uber':       return <UberTab />;
      case 'analise':    return <AnaliseTab />;
      case 'contas':     return <ContasTab />;
      case 'despesas':   return <DespesasFixasTab />;
      case 'gastos':     return <GastosVariaveisTab />;
      case 'cartoes':    return <CartoesTab />;
      case 'patrimonio': return <PatrimonioTab />;
      case 'notas':      return <ObservacoesTab />;
      default:           return <UberTab />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-hawk-bg">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3
                         bg-hawk-bg/80 backdrop-blur-md border-b border-glass-border">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🦅</span>
          <h1 className="text-lg font-bold text-hawk-text tracking-tight hidden sm:block">Hawk Driver</h1>
        </div>
        <div className="flex items-center gap-3">
          {usuario.photoURL && (
            <img
              src={usuario.photoURL}
              alt="Avatar"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full ring-2 ring-hawk-green/30 object-cover"
            />
          )}
          <span className="text-sm font-medium text-hawk-text hidden sm:block">
            {usuario.displayName?.split(' ')[0]}
          </span>
          <button
            id="btn-logout"
            onClick={logout}
            title="Sair"
            className="p-2 rounded-xl text-hawk-muted hover:text-hawk-red hover:bg-hawk-red/10
                       transition-all duration-200 text-base leading-none"
          >
            ⏻
          </button>
        </div>
      </header>

      {/* ── Tab Navigation ── */}
      <nav className="flex overflow-x-auto border-b border-glass-border bg-hawk-bg2
                      scrollbar-none snap-x snap-mandatory">
        {TABS.map(tab => {
          const active = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setAbaAtiva(tab.id)}
              className={`
                flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap
                border-b-2 transition-all duration-200 snap-start flex-shrink-0
                ${active
                  ? 'border-hawk-green text-hawk-green bg-hawk-green/5'
                  : 'border-transparent text-hawk-muted hover:text-hawk-text hover:bg-glass-hover'
                }
              `}
            >
              <span className="text-sm">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Tab Content ── */}
      <main className="flex-1 overflow-y-auto">
        {renderTab()}
      </main>
    </div>
  );
}
