import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

function formatarDataChave(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// ── Alerta Dinâmico ──
function AlertCard({ tipo, icone, titulo, mensagem, sugestao }) {
  const styles = {
    danger:  { border: 'border-hawk-red/30',    bg: 'bg-hawk-red/8',    text: 'text-hawk-red' },
    success: { border: 'border-hawk-green/30',  bg: 'bg-hawk-green/8',  text: 'text-hawk-green' },
    warning: { border: 'border-hawk-yellow/30', bg: 'bg-hawk-yellow/8', text: 'text-hawk-yellow' },
  };
  const s = styles[tipo] || styles.warning;

  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-4 flex gap-4 items-start`}>
      <span className="text-2xl flex-shrink-0">{icone}</span>
      <div className="flex flex-col gap-1">
        <span className={`font-bold text-sm ${s.text}`}>{titulo}</span>
        <p className="text-xs text-hawk-muted leading-relaxed">{mensagem}</p>
        <span className={`text-xs font-semibold ${s.text} opacity-80`}>💡 {sugestao}</span>
      </div>
    </div>
  );
}

// ── Stat Card com barra de progresso ──
function StatCard({ icon, title, value, sub, progress, progressColor }) {
  return (
    <div className="rounded-xl border border-glass-border bg-glass p-4 flex flex-col gap-2 hover:bg-hawk-hover transition-colors duration-200">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-semibold text-hawk-muted uppercase tracking-wide">{title}</span>
      </div>
      <span className="text-2xl font-bold text-hawk-text">{value}</span>
      {progress !== undefined && (
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, progress)}%`, background: progressColor || '#00d4aa' }}
          />
        </div>
      )}
      {sub && <span className="text-xs text-hawk-dim leading-relaxed">{sub}</span>}
    </div>
  );
}

export default function ConsistenciaPanel({ registrosMap = {}, mesAtivo = new Date() }) {

  // ─── Verificar se data pertence à semana corrente ───
  const isInCurrentWeek = (dateStr) => {
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    const diferencaParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    const segundaFeira = new Date(hoje);
    segundaFeira.setDate(hoje.getDate() + diferencaParaSegunda);
    segundaFeira.setHours(0, 0, 0, 0);
    const domingo = new Date(segundaFeira);
    domingo.setDate(segundaFeira.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);
    const dataRegistro = new Date(dateStr + 'T12:00:00');
    return dataRegistro >= segundaFeira && dataRegistro <= domingo;
  };

  // ─── Streak ───
  const streakInfo = useMemo(() => {
    const hoje = new Date();
    let streakAtual = 0;
    let streakTemp = new Date(hoje);
    const chaveHoje = formatarDataChave(streakTemp);
    const chaveOntem = formatarDataChave(new Date(hoje.getTime() - 24 * 60 * 60 * 1000));

    if (!registrosMap[chaveHoje] && !registrosMap[chaveOntem]) {
      streakAtual = 0;
    } else {
      if (!registrosMap[chaveHoje]) streakTemp.setDate(streakTemp.getDate() - 1);
      while (true) {
        const chave = formatarDataChave(streakTemp);
        if (registrosMap[chave]) {
          streakAtual++;
          streakTemp.setDate(streakTemp.getDate() - 1);
        } else break;
      }
    }

    const anoRef = mesAtivo.getFullYear();
    const mesRef = mesAtivo.getMonth();
    const totalDias = new Date(anoRef, mesRef + 1, 0).getDate();
    let melhorStreak = 0, streakAcumulado = 0;
    for (let dia = 1; dia <= totalDias; dia++) {
      const chave = `${anoRef}-${String(mesRef + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      if (registrosMap[chave]) {
        streakAcumulado++;
        if (streakAcumulado > melhorStreak) melhorStreak = streakAcumulado;
      } else streakAcumulado = 0;
    }
    return { streakAtual, melhorStreak };
  }, [registrosMap, mesAtivo]);

  // ─── Stats ───
  const stats = useMemo(() => {
    const chavesRegistros = Object.keys(registrosMap);
    const registrosSemana = chavesRegistros.filter(isInCurrentWeek);
    const diasTrabalhadosSemana = registrosSemana.length;
    const diasPoupadosSemana = registrosSemana.filter(chave => {
      const r = registrosMap[chave];
      return r.caixinhaEmergenciaEnviada || r.caixinhaManutencaoEnviada || r.caixinhaEmpresaEnviada || r.caixinhaLivreEnviada || r.caixinhaContasEnviada;
    }).length;

    const mesRef = mesAtivo.getMonth();
    const anoRef = mesAtivo.getFullYear();
    const registrosMes = chavesRegistros.filter(chave => {
      const d = new Date(chave + 'T12:00:00');
      return d.getMonth() === mesRef && d.getFullYear() === anoRef;
    });
    const diasTrabalhadosMes = registrosMes.length;
    const diasPoupadosMes = registrosMes.filter(chave => {
      const r = registrosMap[chave];
      return r.caixinhaEmergenciaEnviada || r.caixinhaManutencaoEnviada || r.caixinhaEmpresaEnviada || r.caixinhaLivreEnviada || r.caixinhaContasEnviada;
    }).length;

    const taxaPoupancaMes = diasTrabalhadosMes > 0 ? Math.round((diasPoupadosMes / diasTrabalhadosMes) * 100) : 0;
    const taxaPoupancaSemana = diasTrabalhadosSemana > 0 ? Math.round((diasPoupadosSemana / diasTrabalhadosSemana) * 100) : 0;

    return { diasTrabalhadosSemana, diasPoupadosSemana, taxaPoupancaSemana, diasTrabalhadosMes, diasPoupadosMes, taxaPoupancaMes };
  }, [registrosMap, mesAtivo]);

  // ─── Alertas ───
  const alertas = useMemo(() => {
    const lista = [];
    const hoje = new Date();
    let diasSemRegistrar = 0;
    let temp = new Date(hoje);
    while (true) {
      const chave = formatarDataChave(temp);
      if (registrosMap[chave]) break;
      diasSemRegistrar++;
      temp.setDate(temp.getDate() - 1);
      if (diasSemRegistrar > 15) break;
    }

    if (diasSemRegistrar >= 3 && Object.keys(registrosMap).length > 0) {
      lista.push({
        tipo: 'danger', icone: '⚠️', titulo: 'Alerta de Procrastinação!',
        mensagem: `Você está sem registrar trabalho há ${diasSemRegistrar} dias. A consistência é o que diferencia os amadores dos profissionais!`,
        sugestao: 'Meta de hoje: Faça pelo menos 5 corridas para quebrar o gelo.'
      });
    }
    if (streakInfo.streakAtual >= 3) {
      lista.push({
        tipo: 'success', icone: '🔥', titulo: 'Hawk on Fire!',
        mensagem: `Incrível! Você está em uma sequência de ${streakInfo.streakAtual} dias seguidos de trabalho inteligente.`,
        sugestao: 'Continue assim! Sua disciplina de hoje é o seu conforto de amanhã.'
      });
    }
    if (stats.diasTrabalhadosMes >= 3) {
      if (stats.taxaPoupancaMes < 40) {
        lista.push({
          tipo: 'warning', icone: '🚨', titulo: 'Atenção com as Caixinhas!',
          mensagem: `Sua taxa de poupança está baixa (${stats.taxaPoupancaMes}%). Você trabalhou ${stats.diasTrabalhadosMes} dias mas só poupou em ${stats.diasPoupadosMes}.`,
          sugestao: 'Priorize mandar o dinheiro para as caixinhas antes que ele suma!'
        });
      } else if (stats.taxaPoupancaMes >= 80) {
        lista.push({
          tipo: 'success', icone: '🏆', titulo: 'Mestre da Poupança!',
          mensagem: `Excelente! Taxa de consistência poupadora em ${stats.taxaPoupancaMes}% este mês.`,
          sugestao: 'Você tem disciplina de ouro. Sua liberdade financeira agradece!'
        });
      }
    }
    return lista;
  }, [registrosMap, streakInfo, stats]);

  // ─── Gráfico de área acumulado ───
  const dadosGraficoArea = useMemo(() => {
    const anoRef = mesAtivo.getFullYear();
    const mesRef = mesAtivo.getMonth();
    const totalDias = new Date(anoRef, mesRef + 1, 0).getDate();
    const dados = [];
    let acumTrabalho = 0, acumPoupado = 0;
    const hoje = new Date();
    const limiteDia = (hoje.getMonth() === mesRef && hoje.getFullYear() === anoRef) ? hoje.getDate() : totalDias;

    for (let dia = 1; dia <= limiteDia; dia++) {
      const chave = `${anoRef}-${String(mesRef + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      if (registrosMap[chave]) {
        acumTrabalho++;
        const r = registrosMap[chave];
        if (r.caixinhaEmergenciaEnviada || r.caixinhaManutencaoEnviada || r.caixinhaEmpresaEnviada || r.caixinhaLivreEnviada || r.caixinhaContasEnviada) {
          acumPoupado++;
        }
      }
      dados.push({ name: `Dia ${dia}`, trabalhados: acumTrabalho, poupados: acumPoupado });
    }
    return dados;
  }, [registrosMap, mesAtivo]);

  // ─── Mensagem de status semanal ───
  const statusSemanal = () => {
    const d = stats.diasTrabalhadosSemana;
    if (d === 0) return { msg: '⚠️ Ainda não registrou trabalho esta semana!', color: 'text-hawk-red' };
    if (d <= 2)  return { msg: '💪 Bom início! Acelere para sua meta semanal.', color: 'text-hawk-yellow' };
    if (d <= 4)  return { msg: '🔥 Excelente ritmo! Falta pouco para a meta!', color: 'text-hawk-blue' };
    return { msg: '🏆 Meta semanal atingida! Incrível!', color: 'text-hawk-green' };
  };
  const status = statusSemanal();

  return (
    <div className="rounded-2xl border border-glass-border bg-hawk-card shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-glass-border">
        <p className="text-xs font-bold uppercase tracking-widest text-hawk-muted flex items-center gap-2">
          <span>📊</span> Painel de Consistência e Performance
        </p>
      </div>

      <div className="p-5 space-y-6">

        {/* ── Alertas ── */}
        {alertas.length > 0 && (
          <div className="space-y-3">
            {alertas.map((a, i) => <AlertCard key={i} {...a} />)}
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            icon="🔥"
            title="Sequência Atual"
            value={`${streakInfo.streakAtual} Dias`}
            sub={`Melhor do mês: ${streakInfo.melhorStreak} dias`}
          />
          <StatCard
            icon="🚗"
            title="Trabalho Semanal"
            value={`${stats.diasTrabalhadosSemana} / 5 Dias`}
            progress={(stats.diasTrabalhadosSemana / 5) * 100}
            progressColor="#00d4aa"
            sub={<span className={status.color}>{status.msg}</span>}
          />
          <StatCard
            icon="💰"
            title="Taxa de Poupança (Mês)"
            value={`${stats.taxaPoupancaMes}%`}
            progress={stats.taxaPoupancaMes}
            progressColor="#6c5ce7"
            sub={`Poupou em ${stats.diasPoupadosMes} de ${stats.diasTrabalhadosMes} dias rodados`}
          />
        </div>

        {/* ── Gráfico de Área ── */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-hawk-muted uppercase tracking-widest flex items-center gap-2 mb-1">
              <span>📈</span> Trajetória de Consistência Mensal
            </p>
            <p className="text-xs text-hawk-dim leading-relaxed">
              Dias trabalhados × dias em que guardou dinheiro. O ideal é manter as duas curvas juntas!
            </p>
          </div>

          {dadosGraficoArea.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dadosGraficoArea}>
                <defs>
                  <linearGradient id="colorTrabalho" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00d4aa" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00d4aa" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorPoupanca" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6c5ce7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6c5ce7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="#55556a" fontSize={11} />
                <YAxis stroke="#55556a" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(26,26,46,0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend />
                <Area type="monotone" dataKey="trabalhados" name="Dias Trabalhados" stroke="#00d4aa" fillOpacity={1} fill="url(#colorTrabalho)" strokeWidth={2} />
                <Area type="monotone" dataKey="poupados"    name="Dias Poupados"    stroke="#6c5ce7" fillOpacity={1} fill="url(#colorPoupanca)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-hawk-muted">
              <span className="text-4xl opacity-30">📈</span>
              <p className="text-sm">Nenhum registro para exibir o gráfico de performance.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
