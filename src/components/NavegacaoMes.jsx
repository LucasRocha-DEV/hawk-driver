import { MESES } from '../utils/helpers';

/**
 * Componente reutilizável de navegação mês/ano.
 * Usado em: DespesasFixasTab, GastosVariaveisTab, CartoesTab, ContasTab, IAInsightsTab
 * 
 * Props:
 *   mesAtual (number)     - Mês 0-indexed
 *   anoAtual (number)     - Ano completo
 *   setMesAtual (fn)      - Setter do mês
 *   setAnoAtual (fn)      - Setter do ano
 *   onMudouMes (fn|null)  - Callback opcional ao mudar de mês (para limpar estados)
 *   prefixoLabel (string) - Texto antes do nome do mês (ex: "Fatura")
 */
export default function NavegacaoMes({ 
  mesAtual, 
  anoAtual, 
  setMesAtual, 
  setAnoAtual, 
  onMudouMes = null, 
  prefixoLabel = '' 
}) {
  function mesAnterior() {
    if (mesAtual === 0) {
      setMesAtual(11);
      setAnoAtual(a => a - 1);
    } else {
      setMesAtual(m => m - 1);
    }
    onMudouMes?.();
  }

  function mesSeguinte() {
    if (mesAtual === 11) {
      setMesAtual(0);
      setAnoAtual(a => a + 1);
    } else {
      setMesAtual(m => m + 1);
    }
    onMudouMes?.();
  }

  const label = prefixoLabel 
    ? `${prefixoLabel} ${MESES[mesAtual]} ${anoAtual}` 
    : `${MESES[mesAtual]} ${anoAtual}`;

  return (
    <div className="flex items-center justify-between bg-hawk-card border border-glass-border rounded-2xl p-4 shadow-card mb-6 animate-fade-in">
      <button 
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-hawk-muted hover:text-hawk-text transition-colors border border-white/5 active:scale-95" 
        onClick={mesAnterior} 
        aria-label="Mês anterior"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <h2 className="text-lg font-bold text-hawk-text tracking-tight capitalize">{label}</h2>
      <button 
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-hawk-muted hover:text-hawk-text transition-colors border border-white/5 active:scale-95" 
        onClick={mesSeguinte} 
        aria-label="Próximo mês"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  );
}
