import { useState } from 'react';
import { usePreferencias } from '../../contexts/PreferenciasContext';
import { TIPOS_COMBUSTIVEL, estimarCustoCombustivel, formatarMoeda } from '../../utils/helpers';

const inputClass =
  'w-full bg-hawk-input border border-glass-border rounded-xl px-3 py-2 text-hawk-text text-sm ' +
  'placeholder:text-hawk-dim focus:outline-none focus:border-hawk-green/50 focus:ring-1 ' +
  'focus:ring-hawk-green/20 transition-colors duration-200';

const FORM_VAZIO = {
  nome: '',
  carroceria: 'carro',
  combustivel: 'gasolina',
  consumo: '',
  precoUnidade: '',
  modoEletrico: 'medido',
  valorCarga: '',
  kmPorCarga: '',
};

function Campo({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-hawk-muted uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

export default function MeusVeiculos({ iniciarComForm = false }) {
  const { veiculos, veiculoAtivoId, salvarVeiculo, removerVeiculo, definirVeiculoAtivo } = usePreferencias();

  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(iniciarComForm && veiculos.length === 0);
  const [salvando, setSalvando] = useState(false);

  const isEletrico = form.combustivel === 'eletrico';
  const unidade = TIPOS_COMBUSTIVEL[form.combustivel]?.unidade || 'L';
  const modo = form.modoEletrico;

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const abrirNovo = () => {
    setForm(FORM_VAZIO);
    setEditandoId(null);
    setMostrarForm(true);
  };

  const abrirEdicao = (v) => {
    setForm({
      nome: v.nome || '',
      carroceria: v.carroceria || 'carro',
      combustivel: v.combustivel || 'gasolina',
      consumo: v.consumo != null ? String(v.consumo) : '',
      precoUnidade: v.precoUnidade != null ? String(v.precoUnidade) : '',
      modoEletrico: v.modoEletrico || 'medido',
      valorCarga: v.valorCarga != null ? String(v.valorCarga) : '',
      kmPorCarga: v.kmPorCarga != null ? String(v.kmPorCarga) : '',
    });
    setEditandoId(v.id);
    setMostrarForm(true);
  };

  const fechar = () => {
    setMostrarForm(false);
    setEditandoId(null);
    setForm(FORM_VAZIO);
  };

  const dadosNormalizados = () => {
    const base = {
      nome: form.nome.trim(),
      carroceria: form.carroceria,
      combustivel: form.combustivel,
    };
    if (isEletrico) {
      base.modoEletrico = form.modoEletrico;
      if (form.modoEletrico === 'carga_fixa') {
        base.kmPorCarga = parseFloat(form.kmPorCarga) || 0;
        base.valorCarga = parseFloat(form.valorCarga) || 0;
        base.consumo = 0;
        base.precoUnidade = 0;
      } else if (form.modoEletrico === 'gratis') {
        base.consumo = 0;
        base.precoUnidade = 0;
      } else {
        base.consumo = parseFloat(form.consumo) || 0;
        base.precoUnidade = parseFloat(form.precoUnidade) || 0;
      }
    } else {
      base.consumo = parseFloat(form.consumo) || 0;
      base.precoUnidade = parseFloat(form.precoUnidade) || 0;
    }
    return base;
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      alert('Dê um nome ao veículo (ex: "Onix GNV", "Moto Honda").');
      return;
    }
    setSalvando(true);
    try {
      await salvarVeiculo(dadosNormalizados(), editandoId);
      fechar();
    } catch (err) {
      console.error('Erro ao salvar veículo:', err);
      alert('Não foi possível salvar o veículo. Tente novamente.');
    }
    setSalvando(false);
  };

  const excluir = async (v) => {
    if (!confirm(`Excluir o veículo "${v.nome}"?`)) return;
    try {
      await removerVeiculo(v.id);
    } catch (err) {
      console.error('Erro ao excluir veículo:', err);
    }
  };

  // Preview de R$/km a partir do form atual (amostra de 100 km).
  const previewVeiculo = dadosNormalizados();
  const { custoPorKm } = estimarCustoCombustivel(previewVeiculo, 100);

  return (
    <div className="space-y-4">
      {/* Lista de veículos */}
      {veiculos.length === 0 && !mostrarForm && (
        <p className="text-sm text-hawk-muted text-center py-4">
          Nenhum veículo cadastrado ainda. Adicione o seu para o app estimar o gasto com combustível automaticamente.
        </p>
      )}

      <div className="space-y-2">
        {veiculos.map((v) => {
          const info = TIPOS_COMBUSTIVEL[v.combustivel] || { label: v.combustivel, emoji: '🚗', unidade: '' };
          const ativo = v.id === veiculoAtivoId;
          const { custoPorKm: rkm } = estimarCustoCombustivel(v, 100);
          return (
            <div
              key={v.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                ativo ? 'border-hawk-green/50 bg-hawk-green/5' : 'border-glass-border bg-hawk-input'
              }`}
            >
              <span className="text-xl flex-shrink-0">{v.carroceria === 'moto' ? '🏍️' : '🚗'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-hawk-text truncate">{v.nome}</span>
                  {ativo && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-hawk-green/15 text-hawk-green border border-hawk-green/30">
                      ATIVO
                    </span>
                  )}
                </div>
                <span className="text-xs text-hawk-muted">
                  {info.emoji} {info.label}
                  {v.combustivel === 'eletrico' && v.modoEletrico === 'gratis'
                    ? ' · grátis'
                    : rkm > 0
                    ? ` · ${formatarMoeda(rkm)}/km`
                    : ''}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!ativo && (
                  <button
                    onClick={() => definirVeiculoAtivo(v.id)}
                    title="Tornar ativo"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-hawk-green hover:bg-hawk-green/10 transition-colors"
                  >
                    Usar
                  </button>
                )}
                <button
                  onClick={() => abrirEdicao(v)}
                  title="Editar"
                  className="p-1.5 rounded-lg text-hawk-muted hover:text-hawk-text hover:bg-glass-hover transition-colors"
                >
                  ✏️
                </button>
                <button
                  onClick={() => excluir(v)}
                  title="Excluir"
                  className="p-1.5 rounded-lg text-hawk-muted hover:text-hawk-red hover:bg-hawk-red/10 transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botão adicionar */}
      {!mostrarForm && (
        <button
          onClick={abrirNovo}
          className="w-full py-2.5 rounded-xl border border-dashed border-hawk-green/40 text-hawk-green text-sm font-semibold hover:bg-hawk-green/5 transition-colors"
        >
          + Adicionar veículo
        </button>
      )}

      {/* Formulário */}
      {mostrarForm && (
        <form onSubmit={salvar} className="space-y-4 p-4 rounded-xl border border-glass-border bg-hawk-card">
          <p className="text-sm font-bold text-hawk-text">
            {editandoId ? 'Editar veículo' : 'Novo veículo'}
          </p>

          <Campo label="Nome do veículo">
            <input
              className={inputClass}
              placeholder="Ex: Onix GNV, Moto Honda"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
            />
          </Campo>

          {/* Carroceria */}
          <Campo label="Tipo">
            <div className="flex gap-2">
              {[
                { id: 'carro', label: '🚗 Carro' },
                { id: 'moto', label: '🏍️ Moto' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => set('carroceria', opt.id)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    form.carroceria === opt.id
                      ? 'border-hawk-green/40 bg-hawk-green/10 text-hawk-green'
                      : 'border-glass-border bg-hawk-input text-hawk-muted hover:text-hawk-text'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Campo>

          {/* Combustível */}
          <Campo label="Combustível">
            <select
              className={`${inputClass} cursor-pointer`}
              value={form.combustivel}
              onChange={(e) => set('combustivel', e.target.value)}
            >
              {Object.entries(TIPOS_COMBUSTIVEL).map(([id, info]) => (
                <option key={id} value={id}>
                  {info.emoji} {info.label}
                </option>
              ))}
            </select>
          </Campo>

          {/* Modo elétrico */}
          {isEletrico && (
            <Campo label="Como você paga a energia?">
              <select
                className={`${inputClass} cursor-pointer`}
                value={form.modoEletrico}
                onChange={(e) => set('modoEletrico', e.target.value)}
              >
                <option value="medido">Pago por kWh (medido)</option>
                <option value="carga_fixa">Pago um valor fixo por carga</option>
                <option value="gratis">Não pago energia (grátis)</option>
              </select>
            </Campo>
          )}

          {/* Campos de consumo / preço conforme o caso */}
          {isEletrico && modo === 'gratis' ? (
            <p className="text-xs text-hawk-muted bg-hawk-input border border-glass-border rounded-xl px-3 py-2">
              ⚡ Sem custo de energia — o combustível estimado será sempre R$ 0,00.
            </p>
          ) : isEletrico && modo === 'carga_fixa' ? (
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Km por carga">
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  placeholder="Ex: 250"
                  value={form.kmPorCarga}
                  onChange={(e) => set('kmPorCarga', e.target.value)}
                />
              </Campo>
              <Campo label="R$ por carga">
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  placeholder="Ex: 30"
                  value={form.valorCarga}
                  onChange={(e) => set('valorCarga', e.target.value)}
                />
              </Campo>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Campo label={`Km por ${unidade}`}>
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  placeholder={unidade === 'kWh' ? 'Ex: 6' : unidade === 'm³' ? 'Ex: 12' : 'Ex: 11'}
                  value={form.consumo}
                  onChange={(e) => set('consumo', e.target.value)}
                />
              </Campo>
              <Campo label={`R$ por ${unidade}`}>
                <input
                  type="number"
                  step="any"
                  className={inputClass}
                  placeholder={unidade === 'kWh' ? 'Ex: 0.80' : unidade === 'm³' ? 'Ex: 4.50' : 'Ex: 5.89'}
                  value={form.precoUnidade}
                  onChange={(e) => set('precoUnidade', e.target.value)}
                />
              </Campo>
            </div>
          )}

          {/* Preview R$/km */}
          {custoPorKm > 0 && (
            <div className="text-xs text-hawk-muted text-center">
              Custo estimado:{' '}
              <strong className="text-hawk-green">{formatarMoeda(custoPorKm)}/km</strong>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={fechar}
              className="flex-1 py-2.5 rounded-xl border border-glass-border text-hawk-muted text-sm font-semibold hover:text-hawk-text transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 py-2.5 rounded-xl bg-hawk-green text-hawk-bg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
