import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

// Helper: Format to BRL currency
function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Helper: Parse hour string (e.g. "8h30" to 8.5)
function parsarHoras(horarioStr) {
  if (!horarioStr) return 0;
  const match = horarioStr.match(/(\d+)h(\d*)/);
  if (match) {
    const horas = parseInt(match[1], 10) || 0;
    const minutos = parseInt(match[2], 10) || 0;
    return horas + minutos / 60;
  }
  return parseFloat(horarioStr) || 0;
}

// Helper: Classify the shift based on start and end time
function classificarTurno(horaInicio, horaFim) {
  if (!horaInicio || !horaFim) return 'Não Informado';
  const [hStart] = horaInicio.split(':').map(Number);
  const [hEnd] = horaFim.split(':').map(Number);
  
  const obterNomePeriodo = (h) => {
    if (h >= 0 && h < 6) return 'Madrugada 🌙';
    if (h >= 6 && h < 12) return 'Manhã 🌅';
    if (h >= 12 && h < 18) return 'Tarde ☀️';
    return 'Noite 🌌';
  };
  
  const pStart = obterNomePeriodo(hStart);
  const pEnd = obterNomePeriodo(hEnd);
  
  if (pStart === pEnd) return pStart;
  // Clean emojis for combination name
  const pStartClean = pStart.split(' ')[0];
  const pEndClean = pEnd.split(' ')[0];
  return `${pStartClean} ➔ ${pEndClean} 🌓`;
}

// Helper: Detect weekend (Saturday = 6, Sunday = 0)
function isFimDeSemana(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const diaSemana = d.getDay();
  return diaSemana === 0 || diaSemana === 6;
}

// Helper: Format day of week for exhibit
function obterDiaSemanaNome(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const opcoes = { weekday: 'long' };
  const nome = d.toLocaleDateString('pt-BR', opcoes);
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export default function AnaliseTab() {
  const { usuario } = useAuth();
  const [registrosMap, setRegistrosMap] = useState({});
  const [filtroMes, setFiltroMes] = useState('todos'); // 'todos' ou 'YYYY-MM'

  // ─── Real-time Firestore listener ───
  useEffect(() => {
    if (!usuario) return;
    const registrosRef = collection(db, 'usuarios', usuario.uid, 'registros');
    const unsubscribe = onSnapshot(registrosRef, (snapshot) => {
      const mapa = {};
      snapshot.forEach(docSnap => {
        mapa[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
      });
      setRegistrosMap(mapa);
    });
    return () => unsubscribe();
  }, [usuario]);

  // ─── Generate list of available months for filter ───
  const mesesDisponiveis = useMemo(() => {
    const chaves = Object.keys(registrosMap);
    const mesesSet = new Set();
    chaves.forEach(chave => {
      const [ano, mes] = chave.split('-');
      if (ano && mes) mesesSet.add(`${ano}-${mes}`);
    });
    return Array.from(mesesSet).sort((a, b) => b.localeCompare(a));
  }, [registrosMap]);

  // ─── Filtered registers array ───
  const registrosFiltrados = useMemo(() => {
    const todos = Object.values(registrosMap);
    if (filtroMes === 'todos') return todos;
    return todos.filter(r => r.id.startsWith(filtroMes));
  }, [registrosMap, filtroMes]);

  // ─── 1. SHIFT/TURN ANALYSIS ───
  const analiseTurnos = useMemo(() => {
    const turnos = {};
    
    registrosFiltrados.forEach(r => {
      const turno = classificarTurno(r.horaInicio, r.horaFim);
      if (turno === 'Não Informado') return; // Skip days with no shift registration
      
      if (!turnos[turno]) {
        turnos[turno] = {
          nome: turno,
          dias: 0,
          totalLiquido: 0,
          totalBruto: 0,
          totalHoras: 0,
          totalKm: 0
        };
      }
      
      const bruto = r.totalBruto || 0;
      const gastos = r.gastosGerais || 0;
      const liquido = r.totalLiquido != null ? r.totalLiquido : bruto - gastos;
      const horas = parsarHoras(r.horarioRodado);
      
      turnos[turno].dias += 1;
      turnos[turno].totalLiquido += liquido;
      turnos[turno].totalBruto += bruto;
      turnos[turno].totalHoras += horas;
      turnos[turno].totalKm += r.km || 0;
    });
    
    // Calculate averages and format
    return Object.values(turnos).map(t => {
      const ganhoHora = t.totalHoras > 0 ? t.totalLiquido / t.totalHoras : 0;
      const ganhoKm = t.totalKm > 0 ? t.totalLiquido / t.totalKm : 0;
      return {
        ...t,
        ganhoHora,
        ganhoKm
      };
    }).sort((a, b) => b.ganhoHora - a.ganhoHora); // Best hourly rate first
  }, [registrosFiltrados]);

  // ─── 2. WEEKDAY VS WEEKEND ANALYSIS ───
  const analiseDias = useMemo(() => {
    const dados = {
      semana: {
        nome: 'Dias Úteis (Seg a Sex) 💼',
        dias: 0,
        totalLiquido: 0,
        totalBruto: 0,
        totalHoras: 0,
        totalKm: 0,
        totalViagens: 0
      },
      fds: {
        nome: 'Finais de Semana (Sáb/Dom) 🏖️',
        dias: 0,
        totalLiquido: 0,
        totalBruto: 0,
        totalHoras: 0,
        totalKm: 0,
        totalViagens: 0
      }
    };
    
    registrosFiltrados.forEach(r => {
      const fds = isFimDeSemana(r.id);
      const grupo = fds ? dados.fds : dados.semana;
      
      const bruto = r.totalBruto || 0;
      const gastos = r.gastosGerais || 0;
      const liquido = r.totalLiquido != null ? r.totalLiquido : bruto - gastos;
      const horas = parsarHoras(r.horarioRodado);
      
      grupo.dias += 1;
      grupo.totalLiquido += liquido;
      grupo.totalBruto += bruto;
      grupo.totalHoras += horas;
      grupo.totalKm += r.km || 0;
      grupo.totalViagens += r.viagens || 0;
    });
    
    // Process averages
    const processarAverages = (g) => {
      if (g.dias === 0) return { ...g, mediaDiaria: 0, ganhoHora: 0, ganhoKm: 0, mediaViagens: 0 };
      return {
        ...g,
        mediaDiaria: g.totalLiquido / g.dias,
        ganhoHora: g.totalHoras > 0 ? g.totalLiquido / g.totalHoras : 0,
        ganhoKm: g.totalKm > 0 ? g.totalLiquido / g.totalKm : 0,
        mediaViagens: g.totalViagens / g.dias
      };
    };
    
    return {
      semana: processarAverages(dados.semana),
      fds: processarAverages(dados.fds)
    };
  }, [registrosFiltrados]);

  // ─── 3. CATEGORIES COMBINATIONS PERFORMANCE ───
  const analiseCategorias = useMemo(() => {
    const combinacoes = {};
    
    registrosFiltrados.forEach(r => {
      // Build sorted combination name (e.g. "Black + Comfort")
      let setup = 'Nenhuma Categoria';
      if (r.categorias && r.categorias.length > 0) {
        setup = [...r.categorias].sort().join(' + ');
      }
      
      if (!combinacoes[setup]) {
        combinacoes[setup] = {
          nome: setup,
          dias: 0,
          totalLiquido: 0,
          totalBruto: 0,
          totalHoras: 0,
          totalKm: 0
        };
      }
      
      const bruto = r.totalBruto || 0;
      const gastos = r.gastosGerais || 0;
      const liquido = r.totalLiquido != null ? r.totalLiquido : bruto - gastos;
      const horas = parsarHoras(r.horarioRodado);
      
      combinacoes[setup].dias += 1;
      combinacoes[setup].totalLiquido += liquido;
      combinacoes[setup].totalBruto += bruto;
      combinacoes[setup].totalHoras += horas;
      combinacoes[setup].totalKm += r.km || 0;
    });
    
    return Object.values(combinacoes).map(c => {
      const ganhoHora = c.totalHoras > 0 ? c.totalLiquido / c.totalHoras : 0;
      const ganhoKm = c.totalKm > 0 ? c.totalLiquido / c.totalKm : 0;
      return {
        ...c,
        ganhoHora,
        ganhoKm
      };
    }).sort((a, b) => b.ganhoHora - a.ganhoHora);
  }, [registrosFiltrados]);

  // ─── Recommendations & Golden Nugget ───
  const recomendacao = useMemo(() => {
    if (analiseTurnos.length === 0 && analiseCategorias.length === 0) return null;
    
    let turnoTxt = '';
    if (analiseTurnos.length > 0) {
      const melhor = analiseTurnos[0];
      turnoTxt = `Seu melhor período de rodagem é o **${melhor.nome}**, rendendo em média **${formatarMoeda(melhor.ganhoHora)}/hora** de ganho líquido.`;
    }
    
    let catTxt = '';
    if (analiseCategorias.length > 0) {
      const melhorCat = analiseCategorias.find(c => c.nome !== 'Nenhuma Categoria') || analiseCategorias[0];
      catTxt = `Trabalhar com a combinação **"${melhorCat.nome}"** tem sido a estratégia mais rentável, com um rendimento médio de **${formatarMoeda(melhorCat.ganhoHora)}/hora**.`;
    }
    
    let fdsTxt = '';
    if (analiseDias.semana.dias > 0 && analiseDias.fds.dias > 0) {
      const diff = analiseDias.fds.ganhoHora - analiseDias.semana.ganhoHora;
      if (diff > 5) {
        fdsTxt = `🎉 **Fim de semana lucrativo:** Rodar nos finais de semana está rendendo **${formatarMoeda(diff)} a mais por hora** do que nos dias úteis! Aproveite o sábado e domingo para alavancar seu caixa.`;
      } else if (diff < -5) {
        fdsTxt = `💼 **Dias úteis mais fortes:** O trânsito de dias de semana está rendendo **${formatarMoeda(Math.abs(diff))}/hora a mais** do que os finais de semana. Fique atento às tarifas dinâmicas comerciais.`;
      } else {
        fdsTxt = `⚖️ **Rendimento equilibrado:** Seu rendimento por hora é muito similar tanto no final de semana quanto nos dias úteis. Escolha sua folga com base no seu descanso preferencial.`;
      }
    }

    return {
      turnoTxt,
      catTxt,
      fdsTxt
    };
  }, [analiseTurnos, analiseDias, analiseCategorias]);

  return (
    <div className="analise-tab">
      {/* HEADER & FILTER */}
      <div className="section-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>📊 Central de Inteligência de Performance</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
              Análises automatizadas dos turnos, categorias de apps ativos e comparação de fins de semana.
            </p>
          </div>
          <div className="form-group" style={{ minWidth: '180px' }}>
            <select
              className="form-select"
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="todos">📅 Todo o Histórico</option>
              {mesesDisponiveis.map(m => {
                const [ano, mes] = m.split('-');
                const dataObjeto = new Date(Number(ano), Number(mes) - 1, 15);
                const label = dataObjeto.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
              })}
            </select>
          </div>
        </div>
      </div>

      {registrosFiltrados.length === 0 ? (
        <div className="section-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="empty-state">
            Nenhum registro encontrado no período selecionado.<br />
            Preencha seus registros diários com os horários de início/fim e categorias na aba **Uber / Ganhos** para gerar a inteligência!
          </p>
        </div>
      ) : (
        <>
          {/* INSIGHTS RAPIDOS / RECOMENDAÇÕES */}
          {recomendacao && (
            <div className="section-card" style={{ background: 'linear-gradient(135deg, var(--purple-dim), rgba(0, 212, 170, 0.05))', marginBottom: '24px', border: '1px solid rgba(108, 92, 231, 0.2)' }}>
              <h3 className="subsection-title" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💡 Hawk AI — Recomendações e Insights de Ouro
              </h3>
              <ul style={{ color: 'rgba(240, 240, 245, 0.85)', fontSize: '0.88rem', paddingLeft: '20px', lineHeight: '1.7' }}>
                {recomendacao.turnoTxt && <li style={{ marginBottom: '8px' }} dangerouslySetInnerHTML={{ __html: recomendacao.turnoTxt.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></li>}
                {recomendacao.catTxt && <li style={{ marginBottom: '8px' }} dangerouslySetInnerHTML={{ __html: recomendacao.catTxt.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></li>}
                {recomendacao.fdsTxt && <li style={{ marginBottom: '4px' }} dangerouslySetInnerHTML={{ __html: recomendacao.fdsTxt.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></li>}
              </ul>
            </div>
          )}

          {/* GRID: WEEKDAY VS WEEKEND */}
          <h2 className="section-title">⚖️ Comparativo Justo: Dias Úteis vs Fins de Semana</h2>
          <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            {/* WEEKDAYS */}
            <div className="section-card" style={{ padding: '24px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <h3 className="subsection-title" style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                {analiseDias.semana.nome}
              </h3>
              {analiseDias.semana.dias > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Dias Trabalhados:</span>
                    <span style={{ fontWeight: 600 }}>{analiseDias.semana.dias} dias</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Média Diária Líquida:</span>
                    <span style={{ fontWeight: 600, color: 'var(--green)' }}>{formatarMoeda(analiseDias.semana.mediaDiaria)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rendimento por Hora:</span>
                    <span style={{ fontWeight: 700, color: 'var(--purple)' }}>{formatarMoeda(analiseDias.semana.ganhoHora)}/h</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rendimento por Km:</span>
                    <span style={{ fontWeight: 600 }}>{formatarMoeda(analiseDias.semana.ganhoKm)}/km</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Média de Corridas/Dia:</span>
                    <span style={{ fontWeight: 600 }}>{analiseDias.semana.mediaViagens.toFixed(1)} viagens</span>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '16px' }}>Nenhum dia útil registrado no período.</p>
              )}
            </div>

            {/* WEEKENDS */}
            <div className="section-card" style={{ padding: '24px', background: 'rgba(255, 255, 255, 0.02)' }}>
              <h3 className="subsection-title" style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                {analiseDias.fds.nome}
              </h3>
              {analiseDias.fds.dias > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Dias Trabalhados:</span>
                    <span style={{ fontWeight: 600 }}>{analiseDias.fds.dias} dias</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Média Diária Líquida:</span>
                    <span style={{ fontWeight: 600, color: 'var(--green)' }}>{formatarMoeda(analiseDias.fds.mediaDiaria)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rendimento por Hora:</span>
                    <span style={{ fontWeight: 700, color: 'var(--purple)' }}>{formatarMoeda(analiseDias.fds.ganhoHora)}/h</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rendimento por Km:</span>
                    <span style={{ fontWeight: 600 }}>{formatarMoeda(analiseDias.fds.ganhoKm)}/km</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Média de Corridas/Dia:</span>
                    <span style={{ fontWeight: 600 }}>{analiseDias.fds.mediaViagens.toFixed(1)} viagens</span>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '16px' }}>Nenhum final de semana registrado no período.</p>
              )}
            </div>
          </div>

          {/* TURN/SHIFT ANALYSIS TABLE */}
          <div className="section-card" style={{ marginBottom: '32px' }}>
            <h3 className="subsection-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⏱️ Performance por Estilo e Período de Rodagem
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
              Ranquear os períodos com melhor rendimento por hora de trabalho líquida real.
            </p>
            {analiseTurnos.length > 0 ? (
              <div className="historico-table-wrapper" style={{ border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
                <table className="historico-table">
                  <thead>
                    <tr>
                      <th>Turno de Trabalho</th>
                      <th>Dias Rodados</th>
                      <th>Total Líquido</th>
                      <th>Total Horas</th>
                      <th>Ganho por Hora (R$/h)</th>
                      <th>Ganho por Km (R$/km)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analiseTurnos.map((t, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{t.nome}</td>
                        <td>{t.dias} dias</td>
                        <td>{formatarMoeda(t.totalLiquido)}</td>
                        <td>{t.totalHoras.toFixed(1)}h</td>
                        <td className="td-liquido">{formatarMoeda(t.ganhoHora)}/h</td>
                        <td>{formatarMoeda(t.ganhoKm)}/km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Defina o início e término dos seus registros para ver dados de turno.</p>
            )}
          </div>

          {/* CATEGORY & APP SETUP RANKING */}
          <div className="section-card">
            <h3 className="subsection-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              🚗 Performance por Setup de Categorias e Apps
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
              Veja quais combinações de categorias (ex: UberX, Comfort, Black) ou se ligar a 99 em paralelo traz os melhores resultados.
            </p>
            {analiseCategorias.length > 0 ? (
              <div className="historico-table-wrapper" style={{ border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
                <table className="historico-table">
                  <thead>
                    <tr>
                      <th>Setup Ativo (Categorias / Apps)</th>
                      <th>Dias Rodados</th>
                      <th>Total Líquido</th>
                      <th>Ganho Médio / Hora</th>
                      <th>Ganho Médio / Km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analiseCategorias.map((c, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: c.nome.includes('Black') ? 'var(--yellow)' : 'var(--text-primary)' }}>
                          {c.nome}
                        </td>
                        <td>{c.dias} dias</td>
                        <td>{formatarMoeda(c.totalLiquido)}</td>
                        <td className="td-liquido">{formatarMoeda(c.ganhoHora)}/h</td>
                        <td>{formatarMoeda(c.ganhoKm)}/km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Adicione as categorias ativas nos seus registros para compilar o ranking.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
