import Calendar from 'react-calendar';

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
  gastosGerais, setGastosGerais,
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
        <div className="px-5 pt-5 pb-3 border-b border-glass-border">
          <p className="text-xs font-bold uppercase tracking-widest text-hawk-muted flex items-center gap-2">
            <span>📝</span> Registro do Dia —{' '}
            <span className="text-hawk-text normal-case font-semibold">
              {dataSelecionada.toLocaleDateString('pt-BR')}
            </span>
          </p>
        </div>

        <div className="p-5 space-y-5">
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

            <Field label="Gastos Gerais (R$)">
              <input
                type="number"
                className={inputClass}
                placeholder="Ex: 80.00"
                value={gastosGerais}
                onChange={e => setGastosGerais(e.target.value)}
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
