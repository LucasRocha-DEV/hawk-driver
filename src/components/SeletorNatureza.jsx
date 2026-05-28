/**
 * Componente reutilizável de seletor de natureza (Empresa/Pessoal) + toggle esposa.
 * Usado em: DespesasFixasTab, GastosVariaveisTab
 * 
 * Props:
 *   natureza (string)     - 'EMPRESA' ou 'PESSOAL'
 *   setNatureza (fn)      - Setter de natureza
 *   isEsposa (boolean)    - Se o gasto é da esposa
 *   setIsEsposa (fn)      - Setter de isEsposa
 */
export default function SeletorNatureza({ natureza, setNatureza, isEsposa, setIsEsposa }) {
  return (
    <div className="nature-selector-container">
      <label className="form-label">Natureza do Gasto (De onde sai o dinheiro?)</label>
      <div className="nature-buttons">
        <div 
          className={`nature-btn ${natureza === 'EMPRESA' ? 'active-empresa' : ''}`} 
          onClick={() => setNatureza('EMPRESA')}
        >
          <span className="nature-icon">🏢</span>
          <span className="nature-label">Custo Empresa</span>
        </div>
        <div 
          className={`nature-btn ${natureza === 'PESSOAL' ? 'active-pessoal' : ''}`} 
          onClick={() => setNatureza('PESSOAL')}
        >
          <span className="nature-icon">👤</span>
          <span className="nature-label">Custo Pessoal</span>
        </div>
      </div>
      
      {natureza === 'PESSOAL' && (
        <div 
          className={`wife-toggle-container ${isEsposa ? 'active-wife' : ''}`} 
          onClick={() => setIsEsposa(!isEsposa)}
        >
          <div className="wife-toggle-checkbox">
            {isEsposa ? '✅' : '⬜'}
          </div>
          <div className="wife-toggle-text">
            👩 Gasto da Esposa? <span className="wife-hint">(Identifica separadamente)</span>
          </div>
        </div>
      )}
    </div>
  );
}
