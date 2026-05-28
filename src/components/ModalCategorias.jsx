import { useState } from 'react';

/**
 * Modal reutilizável de gerenciamento de categorias dinâmicas.
 * Usado em: DespesasFixasTab, GastosVariaveisTab
 * 
 * Props:
 *   titulo (string)           - "Fixas" ou "Variáveis"
 *   categorias (array)        - Array de { id, label, cor }
 *   onAdicionar (fn)          - Callback async (nome, cor) => void
 *   onRemover (fn)            - Callback async (catId) => void
 *   onFechar (fn)             - Callback para fechar o modal
 */
export default function ModalCategorias({ titulo, categorias, onAdicionar, onRemover, onFechar }) {
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [novaCategoriaCor, setNovaCategoriaCor] = useState('#a29bfe');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!novaCategoriaNome.trim()) return;
    await onAdicionar(novaCategoriaNome.trim(), novaCategoriaCor);
    setNovaCategoriaNome('');
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
      <div className="section-card" style={{ width: '90%', maxWidth: '450px', background: '#16162a', padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '80vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.3rem', color: '#fff' }}>⚙️ Categorias ({titulo})</h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <input 
            type="color" 
            value={novaCategoriaCor} 
            onChange={e => setNovaCategoriaCor(e.target.value)} 
            style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }} 
            title="Cor da categoria"
          />
          <input 
            type="text" 
            value={novaCategoriaNome} 
            onChange={e => setNovaCategoriaNome(e.target.value)} 
            placeholder="Nome da nova categoria" 
            className="form-input" 
            style={{ flex: 1, padding: '8px 12px' }} 
            required 
          />
          <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>➕</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {categorias.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: c.cor }}></div>
                <span style={{ color: '#fff' }}>{c.label}</span>
              </div>
              <button onClick={() => onRemover(c.id)} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button onClick={onFechar} className="btn-secondary" style={{ width: '100%' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
