import Calendar from 'react-calendar';
import { formatarMoeda, TIPOS_COMBUSTIVEL } from '../../utils/helpers';

const CATEGORIAS_DISPONIVEIS = ['UberX', 'Comfort', 'Black', '99 (App)', 'Flash', 'Moto'];

// Campo de formulário reutilizável
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-hawk-muted uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-2.5 text-hawk-text text-sm ' +
  'placeholder:text-hawk-dim focus:outline-none focus:border-hawk-green/50 focus:ring-1 ' +
  'focus:ring-hawk-green/20 transition-colors duration-200';

export default function DailyForm({
  dataSelecionada,
  setDataSelecionada,
  mesAtivo,
  setMesAtivo,
  tileClassName,
  km, setKm,
  totalBruto, setTotalBruto,
  combustivel,
  onCombustivelChange,
  combustivelEstimado,
  custoPorKm,
  onUsarEstimativa,
  gastosGeraisItens,
  onAdicionarItemGasto,
  onAtualizarItemGasto,
  onRemoverItemGasto,
  veiculos,
  veiculoDoDia,
  veiculoIdDia,
  setVeiculoIdDia,
  viagens, setViagens,
  horaInicio, setHoraInicio,
  horaFim, setHoraFim,
  horarioRodado, setHorarioRodado,
  categoriasSelecionadas,
  toggleCategoria,
  erro,
  salvando,
  onSalvar,
}) {
  const hoje = new Date();
  const isHoje =
    dataSelecionada instanceof Date &&
    dataSelecionada.getDate() === hoje.getDate() &&
    dataSelecionada.getMonth() === hoje.getMonth() &&
    dataSelecionada.getFullYear() === hoje.getFullYear();

  return (
    <div className="space-y-5">
      {/* ── Calendário ── */}
      <div className="rounded-2xl border border-glass-border bg-hawk-card shadow-card overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-glass-border">
          <p className="text-xs font-bold uppercase tracking-widest text-hawk-muted flex items-center gap-2">
            <span>📅</span> Calendário
          </p>
        </div>
        <div className="p-4">
          <Calendar
            onChange={setDataSelecionada}
            value={dataSelecionada}
            locale="pt-BR"
            tileClassName={tileClassName}
            onActiveStartDateChange={({ activeStartDate }) => setMesAtivo(activeStartDate)}
            className="w-full"
          />
          <p className="mt-3 text-center text-xs text-hawk-muted">
            Selecionado:{' '}
            <strong className="text-hawk-text">
              {dataSelecionada.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </strong>
          </p>
        </div>
      </div>

      {/* ── Formulário ── */}
      <div className="rounded-2xl border border-glass-border bg-hawk-card shadow-card overflow-hidden">
        <div className={`px-5 py-4 border-b ${isHoje ? 'border-glass-border bg-hawk-green/5' : 'border-hawk-yellow/30 bg-hawk-yellow/10'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-widest text-hawk-muted flex items-center gap-2">
                <span>📝</span> Registro do Dia
              </span>
              <span className="text-base md:text-lg font-bold text-hawk-text capitalize mt-0.5 leading-tight">
                {dataSelecionada.toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            {isHoje ? (
              <span className="flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold bg-hawk-green/15 text-hawk-green border border-hawk-green/30 flex items-center gap-1">
                <span>📍</span> Hoje
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setDataSelecionada(new Date())}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-hawk-yellow/15 text-hawk-yellow border border-hawk-yellow/40 hover:bg-hawk-yellow/25 transition-colors flex items-center gap-1.5"
              >
                ↩ Ir para hoje
              </button>
            )}
          </div>
          {!isHoje && (
            <div className="mt-2 text-[11px] font-semibold text-hawk-yellow flex items-center gap-1.5">
              <span>⚠️</span> Atenção: você está lançando em um dia diferente de hoje.
            </div>
          )}
        </div>

        <div className="p-5 space-y-5">
          {/* Seletor de veículo do dia */}
          {veiculos && veiculos.length > 0 ? (
            <Field label="🚙 Veículo do dia">
              <select
                className={`${inputClass} cursor-pointer`}
                value={veiculoIdDia || ''}
                onChange={e => setVeiculoIdDia(e.target.value)}
              >
                {veiculos.map(v => {
                  const info = TIPOS_COMBUSTIVEL[v.combustivel] || { emoji: '🚗' };
                  return (
                    <option key={v.id} value={v.id}>
                      {v.carroceria === 'moto' ? '🏍️' : '🚗'} {v.nome} — {info.emoji} {info.label || v.combustivel}
                    </option>
                  );
                })}
              </select>
            </Field>
          ) : (
            <p className="text-xs text-hawk-muted bg-hawk-input border border-glass-border rounded-xl px-3 py-2.5">
              💡 Cadastre seu veículo em <strong className="text-hawk-text">⚙️ Configurações → Meus Veículos</strong> para o app estimar o combustível automaticamente.
            </p>
          )}

          {/* Grid de inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Km Rodados">
              <input
                type="number"
                className={inputClass}
                placeholder="Ex: 180"
                value={km}
                onChange={e => setKm(e.target.value)}
              />
            </Field>

            <Field label="Total Bruto (R$)">
              <input
                type="number"
                className={inputClass}
                placeholder="Ex: 350.00"
                value={totalBruto}
                onChange={e => setTotalBruto(e.target.value)}
              />
            </Field>

            <Field label="⛽ Combustível (R$)">
              <input
                type="number"
                className={inputClass}
                placeholder="Ex: 80.00"
                value={combustivel}
                onChange={e => onCombustivelChange(e.target.value)}
              />
            </Field>

            <Field label="Viagens">
              <input
                type="number"
                className={inputClass}
                placeholder="Ex: 15"
                value={viagens}
                onChange={e => setViagens(e.target.value)}
              />
            </Field>

            <Field label="⏰ Início do Turno">
              <input
                type="time"
                className={inputClass}
                value={horaInicio}
                onChange={e => setHoraInicio(e.target.value)}
              />
            </Field>

            <Field label="🏁 Término do Turno">
              <input
                type="time"
                className={inputClass}
                value={horaFim}
                onChange={e => setHoraFim(e.target.value)}
              />
            </Field>
          </div>

          {/* Estimativa de combustível */}
          {veiculoDoDia && custoPorKm > 0 && (
            <div className="flex items-center justify-between gap-3 -mt-2 text-xs">
              <span className="text-hawk-muted">
                ⛽ Estimado:{' '}
                <strong className="text-hawk-green">{formatarMoeda(combustivelEstimado)}</strong>{' '}
                <span className="text-hawk-dim">({formatarMoeda(custoPorKm)}/km)</span>
              </span>
              <button
                type="button"
                onClick={onUsarEstimativa}
                className="px-3 py-1 rounded-lg font-semibold text-hawk-green border border-hawk-green/30 hover:bg-hawk-green/10 transition-colors"
              >
                Usar estimativa
              </button>
            </div>
          )}

          {/* Veículo elétrico grátis: abastecimento avulso */}
          {veiculoDoDia?.combustivel === 'eletrico' && veiculoDoDia?.modoEletrico === 'gratis' && (
            <div className="-mt-2 text-xs text-hawk-blue bg-hawk-blue/10 border border-hawk-blue/25 rounded-xl px-3 py-2 flex items-center gap-2">
              <span>⚡</span>
              <span>
                Carga em casa é grátis (R$ 0). <strong>Abasteceu/carregou na rua?</strong> Digite o valor no campo{' '}
                <strong>⛽ Combustível</strong> acima.
              </span>
            </div>
          )}

          {/* ── Gastos Gerais do dia (itens) ── */}
          <div className="rounded-xl border border-glass-border bg-hawk-input/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-hawk-muted uppercase tracking-wide flex items-center gap-1.5">
                <span>💸</span> Gastos Gerais do dia
              </p>
              <span className="text-xs text-hawk-dim">
                Total: <strong className="text-hawk-text">{formatarMoeda(
                  (gastosGeraisItens || []).reduce((s, i) => s + (Number(i.valor) || 0), 0)
                )}</strong>
              </span>
            </div>

            {(!gastosGeraisItens || gastosGeraisItens.length === 0) && (
              <p className="text-xs text-hawk-dim">
                Adicione gastos como almoço, pedágio, lavagem... A IA usa a descrição para te orientar sobre onde está gastando mais.
              </p>
            )}

            <div className="space-y-2">
              {(gastosGeraisItens || []).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    className={`${inputClass} flex-1`}
                    placeholder="Descrição (ex: Almoço)"
                    value={item.descricao}
                    onChange={e => onAtualizarItemGasto(idx, 'descricao', e.target.value)}
                  />
                  <input
                    type="number"
                    className={`${inputClass} w-24`}
                    placeholder="R$"
                    value={item.valor}
                    onChange={e => onAtualizarItemGasto(idx, 'valor', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoverItemGasto(idx)}
                    title="Remover"
                    className="p-2 rounded-lg text-hawk-muted hover:text-hawk-red hover:bg-hawk-red/10 transition-colors flex-shrink-0"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onAdicionarItemGasto}
              className="w-full py-2 rounded-lg border border-dashed border-hawk-green/40 text-hawk-green text-xs font-semibold hover:bg-hawk-green/5 transition-colors"
            >
              + Adicionar gasto
            </button>
          </div>

          {/* Horas totais */}
          <Field label="⏱️ Total de Horas Rodadas">
            <div className="flex items-center gap-3">
              <input
                type="text"
                className={inputClass}
                placeholder="Ex: 8h30 (calculado automaticamente)"
                value={horarioRodado}
                onChange={e => setHorarioRodado(e.target.value)}
              />
            </div>
            <p className="text-xs text-hawk-dim mt-1">
              Calculado automaticamente ao preencher Início / Término, ou digite diretamente.
            </p>
          </Field>

          {/* Categorias */}
          <div>
            <p className="text-xs font-semibold text-hawk-muted uppercase tracking-wide mb-3">
              🚗 Categorias & Apps Ativos no Dia
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS_DISPONIVEIS.map(cat => {
                const ativo = categoriasSelecionadas.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategoria(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 ${
                      ativo
                        ? 'bg-hawk-green/15 border-hawk-green/40 text-hawk-green'
                        : 'bg-glass border-glass-border text-hawk-muted hover:border-hawk-green/30 hover:text-hawk-text'
                    }`}
                  >
                    {ativo ? '✓' : '+'} {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="rounded-xl border border-hawk-red/25 bg-hawk-red/8 px-4 py-3 text-sm text-hawk-red leading-relaxed">
              <strong className="font-semibold">⚠️ Falha ao Salvar:</strong>{' '}
              {erro.includes('permission') || erro.includes('Permission')
                ? 'Permissão negada! Verifique as Firestore Rules no Firebase Console.'
                : `Erro: ${erro}`}
            </div>
          )}

          {/* Botão salvar */}
          <button
            onClick={onSalvar}
            disabled={salvando}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl
                       bg-hawk-green text-hawk-bg font-bold text-sm
                       hover:opacity-90 hover:shadow-green-glow
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 active:scale-[0.98]"
          >
            {salvando ? (
              <>
                <span className="w-4 h-4 border-2 border-hawk-bg/30 border-t-hawk-bg rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              '💾 Salvar Dia'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
