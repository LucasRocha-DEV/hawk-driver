import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function formatarMoeda(valor) {
  const v = Number(valor);
  return (isNaN(v) ? 0 : v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parsarHoras(horarioStr) {
  if (!horarioStr || typeof horarioStr !== 'string') return 0;
  const match = horarioStr.match(/(\d+)h(\d*)/);
  if (match) {
    const horas = parseInt(match[1], 10) || 0;
    const minutos = parseInt(match[2], 10) || 0;
    return horas + (minutos / 60);
  }
  const f = parseFloat(horarioStr);
  return isNaN(f) ? 0 : f;
}

function getDiaSemanaNome(diaIdx) {
  const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return nomes[diaIdx];
}

function classificarTurno(horaInicio, horaFim) {
  if (!horaInicio || !horaFim) return 'Não Informado';
  const hS = Number(horaInicio.split(':')[0]);
  const hE = Number(horaFim.split(':')[0]);
  if (isNaN(hS) || isNaN(hE)) return 'Não Informado';

  const getNome = (h) => {
    if (h >= 0 && h < 6) return 'Madrugada';
    if (h >= 6 && h < 12) return 'Manhã';
    if (h >= 12 && h < 18) return 'Tarde';
    return 'Noite';
  };
  
  const s = getNome(hS);
  const e = getNome(hE);
  if (s === e) return s;
  return `${s} ➔ ${e}`;
}

export default function AnaliseTab() {
  const { usuario } = useAuth();
  const [registrosMap, setRegistrosMap] = useState({});
  const [filtroMes, setFiltroMes] = useState('todos');

  useEffect(() => {
    if (!usuario) return;
    const registrosRef = collection(db, 'usuarios', usuario.uid, 'registros');
    const unsubscribe = onSnapshot(registrosRef, (snapshot) => {
      const mapa = {};
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          mapa[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        }
      });
      setRegistrosMap(mapa);
    });
    return () => unsubscribe();
  }, [usuario]);

  const mesesDisponiveis = useMemo(() => {
    const chaves = Object.keys(registrosMap);
    const mesesSet = new Set();
    chaves.forEach(chave => {
      if (chave && chave.includes('-')) {
        const parts = chave.split('-');
        if (parts.length >= 2) {
          mesesSet.add(`${parts[0]}-${parts[1]}`);
        }
      }
    });
    return Array.from(mesesSet).sort((a, b) => b.localeCompare(a));
  }, [registrosMap]);

  const registrosFiltrados = useMemo(() => {
    const todos = Object.values(registrosMap).filter(r => r && r.id);
    if (filtroMes === 'todos') return todos;
    return todos.filter(r => r.id.startsWith(filtroMes));
  }, [registrosMap, filtroMes]);

  // ANÁLISE POR DIA DA SEMANA (Comparar Segunda x Segunda, etc)
  const analiseDiasDaSemana = useMemo(() => {
    const diasArray = Array(7).fill(0).map((_, i) => ({
      idx: i,
      nome: getDiaSemanaNome(i),
      shortNome: getDiaSemanaNome(i).slice(0, 3),
      qtd: 0,
      totalLiquido: 0,
      totalHoras: 0
    }));

    registrosFiltrados.forEach(r => {
      const d = new Date(r.id + 'T12:00:00');
      if (isNaN(d.getTime())) return;
      
      const diaSemana = d.getDay(); // 0 a 6
      const liq = r.totalLiquido != null ? Number(r.totalLiquido) : (Number(r.totalBruto||0) - Number(r.gastosGerais||0));
      const hr = parsarHoras(r.horarioRodado);

      diasArray[diaSemana].qtd += 1;
      diasArray[diaSemana].totalLiquido += liq;
      diasArray[diaSemana].totalHoras += hr;
    });

    return diasArray.map(d => ({
      ...d,
      mediaDiaria: d.qtd > 0 ? d.totalLiquido / d.qtd : 0,
      ganhoHora: d.totalHoras > 0 ? d.totalLiquido / d.totalHoras : 0
    }));
  }, [registrosFiltrados]);

  // ANÁLISE DE TURNOS
  const analiseTurnos = useMemo(() => {
    const turnos = {};
    registrosFiltrados.forEach(r => {
      const turno = classificarTurno(r.horaInicio, r.horaFim);
      if (turno === 'Não Informado') return;
      
      if (!turnos[turno]) turnos[turno] = { nome: turno, qtd: 0, totalLiquido: 0, totalHoras: 0, somaInicio: 0, somaFim: 0 };
      
      const liq = r.totalLiquido != null ? Number(r.totalLiquido) : (Number(r.totalBruto||0) - Number(r.gastosGerais||0));
      const hr = parsarHoras(r.horarioRodado);
      
      let valInicio = r.horaInicio ? Number(r.horaInicio.split(':')[0]) + Number(r.horaInicio.split(':')[1])/60 : 0;
      let valFim = r.horaFim ? Number(r.horaFim.split(':')[0]) + Number(r.horaFim.split(':')[1])/60 : 0;
      if (valFim < valInicio) valFim += 24;

      turnos[turno].qtd += 1;
      turnos[turno].totalLiquido += liq;
      turnos[turno].totalHoras += hr;
      turnos[turno].somaInicio += valInicio;
      turnos[turno].somaFim += valFim;
    });

    return Object.values(turnos).map(t => {
      let mInicio = t.somaInicio / t.qtd;
      let mFim = t.somaFim / t.qtd;
      return {
        ...t,
        mediaInicio: mInicio,
        mediaFim: mFim,
        ganhoHora: t.totalHoras > 0 ? t.totalLiquido / t.totalHoras : 0
      };
    }).sort((a, b) => b.ganhoHora - a.ganhoHora);
  }, [registrosFiltrados]);

  // INSIGHTS
  const insights = useMemo(() => {
    const ativos = analiseDiasDaSemana.filter(d => d.qtd > 0);
    if (ativos.length === 0) return null;
    
    const melhorDia = [...ativos].sort((a, b) => b.mediaDiaria - a.mediaDiaria)[0];
    const melhorDiaHora = [...ativos].sort((a, b) => b.ganhoHora - a.ganhoHora)[0];
    
    let turnoMsg = '';
    if (analiseTurnos.length > 0) {
      const t = analiseTurnos[0];
      turnoMsg = `No geral, o seu turno mais lucrativo é **${t.nome}**, fazendo **${formatarMoeda(t.ganhoHora)} por hora**.`;
    }

    return {
      melhorDia,
      melhorDiaHora,
      turnoMsg
    };
  }, [analiseDiasDaSemana, analiseTurnos]);

  const CustomTooltipRecharts = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#1e1e24', padding: '12px', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{label}</p>
          <p style={{ margin: '4px 0', color: payload[0].color }}>Rendimento: {formatarMoeda(payload[0].value)}/h</p>
          <p style={{ margin: '4px 0', color: '#aaa' }}>Média de Ganho do Dia: {formatarMoeda(payload[0].payload.mediaDiaria)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="analise-tab">
      <div className="section-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>📊 Análise Uber</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
              Inteligência de rendimento por dia da semana e performance de horários e turnos.
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
                const parts = m.split('-');
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 15);
                const l = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>;
              })}
            </select>
          </div>
        </div>
      </div>

      {registrosFiltrados.length === 0 ? (
        <div className="section-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="empty-state">Sem dados para o período.</p>
        </div>
      ) : (
        <>
          {/* Insights */}
          {insights && (
            <div className="section-card" style={{ background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.1), rgba(0, 212, 170, 0.05))', marginBottom: '24px', border: '1px solid rgba(108, 92, 231, 0.2)' }}>
              <h3 className="subsection-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                🧠 Insights Inteligentes da sua Operação
              </h3>
              <ul style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', paddingLeft: '20px' }}>
                <li style={{ marginBottom: '6px' }}>
                  Historicamente, trabalhar às <strong>{insights.melhorDia.nome}s</strong> gera a maior média bruta diária: <strong>{formatarMoeda(insights.melhorDia.mediaDiaria)}</strong>.
                </li>
                <li style={{ marginBottom: '6px' }}>
                  No entanto, a maior eficiência financeira (R$ ganho por hora rodada) ocorre às <strong>{insights.melhorDiaHora.nome}s</strong>, pagando <strong>{formatarMoeda(insights.melhorDiaHora.ganhoHora)}/h</strong>.
                </li>
                {insights.turnoMsg && <li dangerouslySetInnerHTML={{ __html: insights.turnoMsg.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />}
              </ul>
            </div>
          )}

          {/* Gráfico de Barras: Melhores Dias */}
          <div className="section-card" style={{ marginBottom: '24px' }}>
            <h3 className="subsection-title">📅 Rendimento por Hora em cada Dia da Semana</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '24px' }}>
              Comparando os mesmos dias da semana para encontrar os melhores dias para trabalhar e folgar.
            </p>
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer>
                <BarChart data={analiseDiasDaSemana} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="shortNome" stroke="#888" fontSize={12} />
                  <YAxis stroke="#888" fontSize={12} tickFormatter={(val) => `R$${val}`} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltipRecharts />} />
                  <Bar dataKey="ganhoHora" radius={[6, 6, 0, 0]}>
                    {analiseDiasDaSemana.map((entry, index) => {
                      // Final de semana cor diferente (Sábado 6, Domingo 0)
                      const color = (entry.idx === 0 || entry.idx === 6) ? '#6c5ce7' : '#00d4aa';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '16px', fontSize: '0.8rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 12, height: 12, background: '#00d4aa', borderRadius: 2 }} /> Dias Úteis</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 12, height: 12, background: '#6c5ce7', borderRadius: 2 }} /> Fins de Semana</span>
            </div>
          </div>

          {/* Ranking de Turnos */}
          <div className="section-card">
            <h3 className="subsection-title">⏱️ Performance e Marcação por Turnos</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '24px' }}>
              Identifique se a madrugada, manhã, tarde ou noite entregam mais rentabilidade.
            </p>
            {analiseTurnos.length > 0 ? (
              <div className="historico-table-wrapper" style={{ border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
                <table className="historico-table">
                  <thead>
                    <tr>
                      <th>Turno de Trabalho</th>
                      <th>Registros</th>
                      <th>Rendimento Hora</th>
                      <th>Média Líquida/Turno</th>
                      <th style={{ width: '40%' }}>Mapa do Dia (Timeline Visual)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analiseTurnos.map((t, idx) => {
                      const mLiq = t.totalLiquido / t.qtd;
                      
                      const start = t.mediaInicio;
                      const end = t.mediaFim;
                      const duration = end - start;
                      
                      let bars = [];
                      if (end > 24) {
                         const startPct = (start / 24) * 100;
                         const endPct = ((end - 24) / 24) * 100;
                         const width1 = 100 - startPct;
                         bars.push({ left: startPct, width: width1 });
                         bars.push({ left: 0, width: endPct });
                      } else {
                         const startPct = (start / 24) * 100;
                         const widthPct = (duration / 24) * 100;
                         bars.push({ left: startPct, width: widthPct });
                      }
                      
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{t.nome}</td>
                          <td>{t.qtd} dias</td>
                          <td style={{ color: 'var(--green)', fontWeight: 'bold' }}>{formatarMoeda(t.ganhoHora)}/h</td>
                          <td>{formatarMoeda(mLiq)}</td>
                          <td style={{ width: '40%' }}>
                            <div style={{ position: 'relative', width: '100%', height: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                              {/* Divisórias de 6 horas */}
                              <div style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.1)' }} />
                              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.1)' }} />
                              <div style={{ position: 'absolute', left: '75%', top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.1)' }} />
                              
                              {/* Preenchimento das horas trabalhadas */}
                              {bars.map((b, i) => (
                                <div key={i} style={{
                                  position: 'absolute', top: 0, bottom: 0,
                                  left: `${b.left}%`, width: `${b.width}%`,
                                  background: 'linear-gradient(90deg, #00d4aa, #6c5ce7)',
                                  boxShadow: '0 0 8px rgba(0, 212, 170, 0.4)',
                                  borderRadius: '12px'
                                }} title={`De ${Math.floor(start)}h até ${Math.floor(end > 24 ? end - 24 : end)}h`} />
                              ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#888', marginTop: '6px', fontWeight: 500 }}>
                              <span>00h</span>
                              <span>06h</span>
                              <span>12h</span>
                              <span>18h</span>
                              <span>00h</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Registre as horas de início e término na aba de Ganhos para gerar este mapa.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
