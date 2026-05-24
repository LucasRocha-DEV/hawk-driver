import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

function formatarDataChave(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export default function ConsistenciaPanel({ registrosMap = {}, mesAtivo = new Date() }) {
  // ─── HELPER: Verificar se data pertence à semana corrente (Seg-Dom) ───
  const isInCurrentWeek = (dateStr) => {
    const hoje = new Date();
    // Ajustar para segunda-feira da semana corrente
    const diaSemana = hoje.getDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sab
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

  // ─── CÁLCULO DE DIAS ÚTEIS (Seg-Sex) NO MÊS ATIVO ───
  const diasUteisNoMes = useMemo(() => {
    const ano = mesAtivo.getFullYear();
    const mes = mesAtivo.getMonth();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    let uteis = 0;
    for (let dia = 1; dia <= totalDias; dia++) {
      const d = new Date(ano, mes, dia);
      const diaSemana = d.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        uteis++;
      }
    }
    return uteis;
  }, [mesAtivo]);

  // ─── CÁLCULO DA SEQUÊNCIA (STREAK) ATUAL DE DIAS TRABALHADOS ───
  const streakInfo = useMemo(() => {
    const hoje = new Date();
    let streakAtual = 0;
    let streakTemp = new Date(hoje);

    // Se não trabalhou hoje, verifica se trabalhou ontem para manter a contagem da sequência
    const chaveHoje = formatarDataChave(streakTemp);
    const chaveOntem = formatarDataChave(new Date(hoje.getTime() - 24 * 60 * 60 * 1000));
    
    if (!registrosMap[chaveHoje] && !registrosMap[chaveOntem]) {
      streakAtual = 0;
    } else {
      if (!registrosMap[chaveHoje]) {
        streakTemp.setDate(streakTemp.getDate() - 1);
      }
      
      while (true) {
        const chave = formatarDataChave(streakTemp);
        if (registrosMap[chave]) {
          streakAtual++;
          streakTemp.setDate(streakTemp.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Melhor sequência no mês ativo
    const anoRef = mesAtivo.getFullYear();
    const mesRef = mesAtivo.getMonth();
    const totalDias = new Date(anoRef, mesRef + 1, 0).getDate();
    let melhorStreak = 0;
    let streakAcumulado = 0;

    for (let dia = 1; dia <= totalDias; dia++) {
      const diaStr = String(dia).padStart(2, '0');
      const mesStr = String(mesRef + 1).padStart(2, '0');
      const chave = `${anoRef}-${mesStr}-${diaStr}`;
      
      if (registrosMap[chave]) {
        streakAcumulado++;
        if (streakAcumulado > melhorStreak) {
          melhorStreak = streakAcumulado;
        }
      } else {
        streakAcumulado = 0;
      }
    }

    return { streakAtual, melhorStreak };
  }, [registrosMap, mesAtivo]);

  // ─── METAS E ESTATÍSTICAS DA SEMANA E DO MÊS ───
  const stats = useMemo(() => {
    const chavesRegistros = Object.keys(registrosMap);
    
    // Registros da semana corrente
    const registrosSemana = chavesRegistros.filter(isInCurrentWeek);
    const diasTrabalhadosSemana = registrosSemana.length;

    // Dias poupados na semana (pelo menos uma caixinha enviada)
    const diasPoupadosSemana = registrosSemana.filter(chave => {
      const r = registrosMap[chave];
      return (
        r.caixinhaEmergenciaEnviada ||
        r.caixinhaManutencaoEnviada ||
        r.caixinhaEmpresaEnviada ||
        r.caixinhaLivreEnviada ||
        r.caixinhaContasEnviada
      );
    }).length;

    // Registros do mês ativo
    const mesRef = mesAtivo.getMonth();
    const anoRef = mesAtivo.getFullYear();
    const registrosMes = chavesRegistros.filter(chave => {
      const d = new Date(chave + 'T12:00:00');
      return d.getMonth() === mesRef && d.getFullYear() === anoRef;
    });

    const diasTrabalhadosMes = registrosMes.length;

    // Dias poupados no mês
    const diasPoupadosMes = registrosMes.filter(chave => {
      const r = registrosMap[chave];
      return (
        r.caixinhaEmergenciaEnviada ||
        r.caixinhaManutencaoEnviada ||
        r.caixinhaEmpresaEnviada ||
        r.caixinhaLivreEnviada ||
        r.caixinhaContasEnviada
      );
    }).length;

    // Taxa de poupança
    const taxaPoupancaMes = diasTrabalhadosMes > 0 
      ? Math.round((diasPoupadosMes / diasTrabalhadosMes) * 100) 
      : 0;

    const taxaPoupancaSemana = diasTrabalhadosSemana > 0
      ? Math.round((diasPoupadosSemana / diasTrabalhadosSemana) * 100)
      : 0;

    return {
      diasTrabalhadosSemana,
      diasPoupadosSemana,
      taxaPoupancaSemana,
      diasTrabalhadosMes,
      diasPoupadosMes,
      taxaPoupancaMes
    };
  }, [registrosMap, mesAtivo]);

  // ─── DADOS DO GRÁFICO DE ÁREA ACUMULADO ───
  const dadosGraficoArea = useMemo(() => {
    const anoRef = mesAtivo.getFullYear();
    const mesRef = mesAtivo.getMonth();
    const totalDias = new Date(anoRef, mesRef + 1, 0).getDate();
    
    const dados = [];
    let acumTrabalho = 0;
    let acumPoupado = 0;

    // Gerar até o dia de hoje se for o mês corrente, ou o mês inteiro se for mês passado
    const hoje = new Date();
    const limiteDia = (hoje.getMonth() === mesRef && hoje.getFullYear() === anoRef) 
      ? hoje.getDate() 
      : totalDias;

    for (let dia = 1; dia <= limiteDia; dia++) {
      const diaStr = String(dia).padStart(2, '0');
      const mesStr = String(mesRef + 1).padStart(2, '0');
      const chave = `${anoRef}-${mesStr}-${diaStr}`;

      if (registrosMap[chave]) {
        acumTrabalho++;
        const r = registrosMap[chave];
        if (
          r.caixinhaEmergenciaEnviada ||
          r.caixinhaManutencaoEnviada ||
          r.caixinhaEmpresaEnviada ||
          r.caixinhaLivreEnviada ||
          r.caixinhaContasEnviada
        ) {
          acumPoupado++;
        }
      }

      dados.push({
        name: `Dia ${dia}`,
        trabalhados: acumTrabalho,
        poupados: acumPoupado
      });
    }

    return dados;
  }, [registrosMap, mesAtivo]);

  // ─── ALERTAS DINÂMICOS ANTI-PROCRASTINAÇÃO ───
  const alertas = useMemo(() => {
    const lista = [];
    const hoje = new Date();

    // 1. Alerta de Inatividade
    let diasSemRegistrar = 0;
    let temp = new Date(hoje);
    while (true) {
      const chave = formatarDataChave(temp);
      if (registrosMap[chave]) {
        break;
      }
      diasSemRegistrar++;
      temp.setDate(temp.getDate() - 1);
      // Evitar loop infinito se não houver registros
      if (diasSemRegistrar > 15) break;
    }

    if (diasSemRegistrar >= 3 && Object.keys(registrosMap).length > 0) {
      lista.push({
        tipo: 'danger',
        icone: '⚠️',
        titulo: 'Alerta de Procrastinação!',
        mensagem: `Você está sem registrar trabalho há ${diasSemRegistrar} dias. A consistência é o que diferencia os amadores dos profissionais! Ligue o app e bora faturar!`,
        sugestao: 'Meta de hoje: Faça pelo menos 5 corridas para quebrar o gelo.'
      });
    }

    // 2. Alerta de Streak (Sequência)
    if (streakInfo.streakAtual >= 3) {
      lista.push({
        tipo: 'success',
        icone: '🔥',
        titulo: 'Hawk on Fire!',
        mensagem: `Incrível! Você está em uma sequência de ${streakInfo.streakAtual} dias seguidos de trabalho inteligente.`,
        sugestao: 'Continue assim! Sua disciplina de hoje é o seu conforto de amanhã.'
      });
    }

    // 3. Alerta de Poupança Mensal
    if (stats.diasTrabalhadosMes >= 3) {
      if (stats.taxaPoupancaMes < 40) {
        lista.push({
          tipo: 'warning',
          icone: '🚨',
          titulo: 'Atenção com as Caixinhas!',
          mensagem: `Sua taxa de poupança está baixa (${stats.taxaPoupancaMes}%). Você trabalhou ${stats.diasTrabalhadosMes} dias mas só poupou em ${stats.diasPoupadosMes}.`,
          sugestao: 'Priorize mandar o dinheiro para as caixinhas antes que ele suma da conta!'
        });
      } else if (stats.taxaPoupancaMes >= 80) {
        lista.push({
          tipo: 'success',
          icone: '🏆',
          titulo: 'Mestre da Poupança!',
          mensagem: `Excelente! Taxa de consistência poupadora em ${stats.taxaPoupancaMes}% este mês.`,
          sugestao: 'Você tem disciplina de ouro. Sua liberdade financeira agradece!'
        });
      }
    }

    return lista;
  }, [registrosMap, streakInfo, stats]);

  // Mensagens motivacionais de consistência semanal de trabalho
  const mensagemConsistenciaTrabalho = () => {
    const dias = stats.diasTrabalhadosSemana;
    if (dias === 0) return { texto: '⚠️ Você ainda não registrou trabalho esta semana! Bora começar!', classe: 'alert-red' };
    if (dias <= 2) return { texto: '💪 Bom início, mas acelere para alcançar sua meta semanal!', classe: 'alert-yellow' };
    if (dias <= 4) return { texto: '🔥 Excelente ritmo! Falta muito pouco para bater a meta semanal!', classe: 'alert-blue' };
    return { texto: '🏆 Incrível! Meta semanal atingida. Aproveite para descansar se necessário!', classe: 'alert-green' };
  };

  const statusTrabalho = mensagemConsistenciaTrabalho();

  return (
    <div className="consistencia-panel">
      <h2 className="section-title">📊 Painel de Consistência e Performance</h2>
      
      {/* ─── ALERTAS DINÂMICOS ─── */}
      {alertas.length > 0 && (
        <div className="consistencia-alerts-wrapper">
          {alertas.map((a, idx) => (
            <div key={idx} className={`consistencia-alert alert-${a.tipo}`}>
              <span className="alert-icon">{a.icone}</span>
              <div className="alert-content">
                <span className="alert-title">{a.titulo}</span>
                <p className="alert-message">{a.mensagem}</p>
                <span className="alert-sugestao">{a.sugestao}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── STREAKS & METRICS CARDS ─── */}
      <div className="stat-grid">
        <div className="stat-item streak-counter">
          <span className="streak-icon">🔥</span>
          <div className="streak-details">
            <span className="streak-title">Sequência Atual</span>
            <span className="streak-value">{streakInfo.streakAtual} Dias</span>
            <span className="streak-sub">Melhor do mês: {streakInfo.melhorStreak} dias</span>
          </div>
        </div>

        <div className="stat-item">
          <span className="stat-icon">🚗</span>
          <div className="stat-details">
            <span className="stat-title">Trabalho Semanal</span>
            <span className="stat-value">{stats.diasTrabalhadosSemana} / 5 Dias</span>
            <div className="progress-bar">
              <div 
                className="progress-fill fill-green" 
                style={{ width: `${Math.min((stats.diasTrabalhadosSemana / 5) * 100, 100)}%` }}
              ></div>
            </div>
            <span className="stat-sub">{statusTrabalho.texto}</span>
          </div>
        </div>

        <div className="stat-item">
          <span className="stat-icon">💰</span>
          <div className="stat-details">
            <span className="stat-title">Taxa de Poupança (Mês)</span>
            <span className="stat-value">{stats.taxaPoupancaMes}%</span>
            <div className="progress-bar">
              <div 
                className="progress-fill fill-purple" 
                style={{ width: `${stats.taxaPoupancaMes}%` }}
              ></div>
            </div>
            <span className="stat-sub">
              Poupou em {stats.diasPoupadosMes} de {stats.diasTrabalhadosMes} dias rodados
            </span>
          </div>
        </div>
      </div>

      {/* ─── DETALHES DE PERFORMANCE MENSAL ─── */}
      <div className="section-card mt-24">
        <h3 className="subsection-title">📈 Trajetória de Consistência Mensal</h3>
        <p className="section-description">
          Abaixo você acompanha seu crescimento acumulativo de dias trabalhados versus dias em que conseguiu guardar dinheiro nas caixinhas do banco. O ideal é manter as duas curvas o mais próximas possível!
        </p>

        {dadosGraficoArea.length > 0 ? (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={dadosGraficoArea}>
                <defs>
                  <linearGradient id="colorTrabalho" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#00d4aa" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorPoupança" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6c5ce7" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6c5ce7" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} label={{ value: 'Acumulado (Dias)', angle: -90, position: 'insideLeft', fill: '#888', style: {textAnchor: 'middle'} }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(26, 26, 46, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="trabalhados" 
                  name="Dias Trabalhados" 
                  stroke="#00d4aa" 
                  fillOpacity={1} 
                  fill="url(#colorTrabalho)" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="poupados" 
                  name="Dias Poupados" 
                  stroke="#6c5ce7" 
                  fillOpacity={1} 
                  fill="url(#colorPoupança)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="empty-state">Nenhum registro para exibir o gráfico de performance.</p>
        )}
      </div>
    </div>
  );
}
