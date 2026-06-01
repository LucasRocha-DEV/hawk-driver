import { usePreferencias } from '../../contexts/PreferenciasContext';
import MeusVeiculos from './MeusVeiculos';

/**
 * Boas-vindas de primeiro acesso: incentiva o motorista a cadastrar o primeiro
 * veículo, para que o app já estime o combustível automaticamente. Aparece
 * apenas quando o usuário ainda não tem nenhum veículo.
 */
export default function OnboardingModal({ onClose }) {
  const { veiculos } = usePreferencias();
  const temVeiculo = veiculos.length > 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-start sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      <div className="relative z-10 w-full sm:max-w-lg max-h-screen sm:max-h-[92vh] flex flex-col bg-hawk-bg sm:rounded-3xl border border-glass-border shadow-card animate-fade-up overflow-hidden">
        {/* Cabeçalho */}
        <div className="px-6 pt-7 pb-5 text-center border-b border-glass-border">
          <span className="text-5xl block mb-2 animate-float">🦅</span>
          <h2 className="text-xl font-bold text-hawk-text">Bem-vindo ao Hawk Driver!</h2>
          <p className="text-sm text-hawk-muted mt-2 leading-relaxed">
            Para o app calcular seu gasto com combustível sozinho, cadastre seu veículo. Funciona para{' '}
            <strong className="text-hawk-text">moto, gasolina, etanol, GNV e elétrico</strong> — inclusive quem
            carrega de graça em casa. ⚡
          </p>
        </div>

        {/* Conteúdo: cadastro do veículo */}
        <div className="flex-1 overflow-y-auto p-5">
          <MeusVeiculos iniciarComForm />
        </div>

        {/* Rodapé */}
        <div className="px-5 py-4 border-t border-glass-border bg-hawk-bg/80 backdrop-blur-md">
          {temVeiculo ? (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-hawk-green text-hawk-bg font-bold text-sm hover:opacity-90 transition-opacity"
            >
              🚀 Tudo pronto — começar a usar!
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-glass-border text-hawk-muted font-semibold text-sm hover:text-hawk-text transition-colors"
            >
              Fazer isso depois
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
