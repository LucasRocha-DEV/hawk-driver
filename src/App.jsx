import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import UberTab from './components/UberTab';
import AnaliseTab from './components/AnaliseTab';
import ContasTab from './components/ContasTab';
import DespesasFixasTab from './components/DespesasFixasTab';
import GastosVariaveisTab from './components/GastosVariaveisTab';
import ObservacoesTab from './components/ObservacoesTab';
import PatrimonioTab from './components/PatrimonioTab';

const TABS = [
  { id: 'uber', label: 'Uber / Ganhos', icon: '🚗' },
  { id: 'analise', label: 'Análise Uber', icon: '📊' },
  { id: 'contas', label: 'Termômetro', icon: '🧾' },
  { id: 'despesas', label: 'Despesas Fixas', icon: '📋' },
  { id: 'gastos', label: 'Gastos Variáveis', icon: '💸' },
  { id: 'patrimonio', label: 'Patrimônio', icon: '💰' },
  { id: 'notas', label: 'Observações', icon: '📝' }
];

function LoginScreen({ onLogin, erro, limparErro }) {
  const getErrorMessage = () => {
    if (!erro) return null;
    
    const code = erro.code || erro.message || '';
    if (code.includes('auth/unauthorized-domain')) {
      return (
        <div className="login-error-card">
          <div className="login-error-header">
            <span>⚠️</span>
            <strong>Domínio Não Autorizado</strong>
          </div>
          <p>Este domínio do Vercel precisa ser adicionado no seu painel do Firebase Console para permitir o login com o Google.</p>
          <div className="login-error-steps">
            <ol>
              <li>Acesse o <strong>Firebase Console</strong></li>
              <li>Vá em <strong>Authentication</strong> &gt; <strong>Settings</strong> &gt; <strong>Authorized domains</strong></li>
              <li>Adicione o domínio do seu deploy da Vercel</li>
            </ol>
          </div>
          <button className="login-error-close" onClick={limparErro}>Entendi</button>
        </div>
      );
    }
    
    if (code.includes('auth/popup-closed-by-user')) {
      return (
        <div className="login-error-card">
          <div className="login-error-header">
            <span>⚠️</span>
            <strong>Login Cancelado</strong>
          </div>
          <p>A janela de autenticação foi fechada antes da conclusão do login. Tente novamente.</p>
          <button className="login-error-close" onClick={limparErro}>Fechar</button>
        </div>
      );
    }

    if (code.includes('auth/network-request-failed')) {
      return (
        <div className="login-error-card">
          <div className="login-error-header">
            <span>📡</span>
            <strong>Erro de Rede</strong>
          </div>
          <p>Falha na conexão de rede. Verifique sua internet e tente novamente.</p>
          <button className="login-error-close" onClick={limparErro}>Fechar</button>
        </div>
      );
    }
    
    return (
      <div className="login-error-card">
        <div className="login-error-header">
          <span>❌</span>
          <strong>Erro ao Entrar</strong>
        </div>
        <p>{erro.message || 'Ocorreu um erro inesperado. Tente novamente mais tarde.'}</p>
        <button className="login-error-close" onClick={limparErro}>Fechar</button>
      </div>
    );
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-logo-area">
          <span className="login-hawk-icon">🦅</span>
          <h1 className="login-title">Hawk Driver</h1>
          <p className="login-subtitle">Controle financeiro inteligente para motoristas</p>
        </div>
        <div className="login-features">
          <div className="login-feature-item">
            <span className="login-feature-icon">📊</span>
            <span>Acompanhe seus ganhos diários</span>
          </div>
          <div className="login-feature-item">
            <span className="login-feature-icon">💰</span>
            <span>Controle despesas e gastos</span>
          </div>
          <div className="login-feature-item">
            <span className="login-feature-icon">📈</span>
            <span>Gráficos e relatórios completos</span>
          </div>
          <div className="login-feature-item">
            <span className="login-feature-icon">🔒</span>
            <span>Seus dados seguros na nuvem</span>
          </div>
        </div>
        
        {erro && getErrorMessage()}

        <button className="login-btn" onClick={() => onLogin().catch(() => {})} id="btn-login-google">
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Entrar com Google
        </button>
        <p className="login-disclaimer">Seus dados ficam protegidos e isolados na sua conta</p>
      </div>
      <div className="login-bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p className="loading-text">Carregando Hawk Driver...</p>
    </div>
  );
}

export default function App() {
  const { usuario, carregando, loginComGoogle, logout, erro, setErro } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState('uber');

  if (carregando) return <LoadingScreen />;
  if (!usuario) return <LoginScreen onLogin={loginComGoogle} erro={erro} limparErro={() => setErro(null)} />;

  const renderTab = () => {
    switch (abaAtiva) {
      case 'uber': return <UberTab />;
      case 'analise': return <AnaliseTab />;
      case 'contas': return <ContasTab />;
      case 'despesas': return <DespesasFixasTab />;
      case 'gastos': return <GastosVariaveisTab />;
      case 'patrimonio': return <PatrimonioTab />;
      case 'notas': return <ObservacoesTab />;
      default: return <UberTab />;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <span className="header-hawk">🦅</span>
          <h1 className="header-title">Hawk Driver</h1>
        </div>
        <div className="header-right">
          <div className="header-user">
            {usuario.photoURL && (
              <img 
                src={usuario.photoURL} 
                alt="Avatar" 
                className="header-avatar"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="header-name">{usuario.displayName?.split(' ')[0]}</span>
          </div>
          <button className="header-logout" onClick={logout} id="btn-logout" title="Sair">
            ⏻
          </button>
        </div>
      </header>

      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`tab-btn ${abaAtiva === tab.id ? 'tab-active' : ''}`}
            onClick={() => setAbaAtiva(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {renderTab()}
      </main>
    </div>
  );
}
