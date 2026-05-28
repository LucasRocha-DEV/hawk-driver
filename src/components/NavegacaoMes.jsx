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
    <div className="month-navigation">
      <button className="month-nav-btn" onClick={mesAnterior} aria-label="Mês anterior">‹</button>
      <h2 className="month-title">{label}</h2>
      <button className="month-nav-btn" onClick={mesSeguinte} aria-label="Próximo mês">›</button>
    </div>
  );
}
