import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import emailjs from '@emailjs/browser';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

const TAGS = [
  { label: 'Geral', color: '#0984e3' },
  { label: 'Meta', color: '#00d4aa' },
  { label: 'Lembrete', color: '#ffd93d' },
  { label: 'Dica', color: '#6c5ce7' },
  { label: 'Uber', color: '#a29bfe' },
  { label: 'Importante', color: '#ff6b6b' }
];

const TAG_COLOR_MAP = TAGS.reduce((acc, t) => {
  acc[t.label] = t.color;
  return acc;
}, {});

function formatTimestamp(ts) {
  if (!ts || !ts.seconds) return '';
  const d = new Date(ts.seconds * 1000);
  const date = d.toLocaleDateString('pt-BR');
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

export default function ObservacoesTab() {
  const { usuario } = useAuth();

  const [notas, setNotas] = useState([]);
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [tag, setTag] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [filtroTag, setFiltroTag] = useState('Todas');
  const [busca, setBusca] = useState('');

  // Lembrete states
  const [lembreteData, setLembreteData] = useState('');
  const [lembreteHora, setLembreteHora] = useState('');
  const lembretesVerificados = useRef(false);

  // Firestore listener
  useEffect(() => {
    if (!usuario) return;

    const ref = collection(db, 'usuarios', usuario.uid, 'observacoes');
    const q = query(ref, orderBy('criadoEm', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dados = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotas(dados);
    });

    return () => unsubscribe();
  }, [usuario]);

  // ─── Verificador Diário de Lembretes (EmailJS) ───
  useEffect(() => {
    if (!usuario || notas.length === 0 || lembretesVerificados.current) return;
    
    const verificarEEnviarLembretes = async () => {
      lembretesVerificados.current = true;
      const hojeStr = new Date().toISOString().split('T')[0];
      
      // Data de amanhã
      const amanhaDate = new Date();
      amanhaDate.setDate(amanhaDate.getDate() + 1);
      const amanhaStr = amanhaDate.toISOString().split('T')[0];

      for (const nota of notas) {
        if (nota.tag === 'Lembrete' && nota.lembreteData && !nota.notificado) {
          
          const isHoje = nota.lembreteData === hojeStr;
          const isAmanha = nota.lembreteData === amanhaStr;
          
          if (isHoje || isAmanha) {
            try {
              // ATENÇÃO: Substitua pelos seus IDs reais do EmailJS (conta gratuita em emailjs.com)
              const serviceId = 'service_1frjvqc'; 
              const templateId = 'template_xfhgeoe'; 
              const publicKey = 't13na8-V7eKws36yp';
              
              if (serviceId === 'YOUR_SERVICE_ID') {
                 console.log('EmailJS não configurado. Lembrete que seria enviado:', nota.titulo);
                 continue;
              }

              await emailjs.send(serviceId, templateId, {
                to_name: usuario.displayName,
                to_email: usuario.email,
                titulo: nota.titulo || 'Lembrete do Hawk Driver',
                mensagem: nota.texto,
                data: nota.lembreteData,
                hora: nota.lembreteHora || 'Não especificada',
                tipo: isHoje ? 'HOJE' : 'AMANHÃ'
              }, publicKey);

              // Marcar como notificado se for o lembrete de HOJE
              // (deixa o de amanhã livre para ser enviado amanhã também, se quiser)
              if (isHoje) {
                const docRef = doc(db, 'usuarios', usuario.uid, 'observacoes', nota.id);
                await updateDoc(docRef, { notificado: true });
              }
              
              console.log('Lembrete enviado com sucesso:', nota.titulo);
            } catch (err) {
              console.error('Erro ao enviar email de lembrete:', err);
            }
          }
        }
      }
    };

    verificarEEnviarLembretes();
  }, [notas, usuario]);

  // Filtered & sorted notes
  const notasFiltradas = useMemo(() => {
    let resultado = [...notas];

    // Tag filter
    if (filtroTag !== 'Todas') {
      resultado = resultado.filter((n) => n.tag === filtroTag);
    }

    // Text search
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      resultado = resultado.filter((n) => {
        const tituloMatch = (n.titulo || '').toLowerCase().includes(termo);
        const textoMatch = (n.texto || '').toLowerCase().includes(termo);
        return tituloMatch || textoMatch;
      });
    }

    // Sort: pinned first, then by criadoEm desc
    resultado.sort((a, b) => {
      if (a.fixado && !b.fixado) return -1;
      if (!a.fixado && b.fixado) return 1;
      const tsA = a.criadoEm?.seconds || 0;
      const tsB = b.criadoEm?.seconds || 0;
      return tsB - tsA;
    });

    return resultado;
  }, [notas, filtroTag, busca]);

  // Reset form
  function limparFormulario() {
    setTitulo('');
    setTexto('');
    setTag('');
    setLembreteData('');
    setLembreteHora('');
    setEditandoId(null);
  }

  // Save or update
  async function handleSalvar(e) {
    e.preventDefault();
    if (!texto.trim() || !tag) return;

    const ref = collection(db, 'usuarios', usuario.uid, 'observacoes');

    if (editandoId) {
      const docRef = doc(db, 'usuarios', usuario.uid, 'observacoes', editandoId);
      await updateDoc(docRef, {
        titulo: titulo.trim(),
        texto: texto.trim(),
        tag,
        lembreteData: tag === 'Lembrete' ? lembreteData : null,
        lembreteHora: tag === 'Lembrete' ? lembreteHora : null,
        editadoEm: serverTimestamp()
      });
    } else {
      await addDoc(ref, {
        titulo: titulo.trim(),
        texto: texto.trim(),
        tag,
        lembreteData: tag === 'Lembrete' ? lembreteData : null,
        lembreteHora: tag === 'Lembrete' ? lembreteHora : null,
        fixado: false,
        notificado: false,
        criadoEm: serverTimestamp(),
        editadoEm: null
      });
    }

    limparFormulario();
  }

  // Edit
  function handleEditar(nota) {
    setTitulo(nota.titulo || '');
    setTexto(nota.texto || '');
    setTag(nota.tag || '');
    setLembreteData(nota.lembreteData || '');
    setLembreteHora(nota.lembreteHora || '');
    setEditandoId(nota.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Delete
  async function handleExcluir(id) {
    if (!window.confirm('Tem certeza que deseja excluir esta nota?')) return;
    const docRef = doc(db, 'usuarios', usuario.uid, 'observacoes', id);
    await deleteDoc(docRef);
    if (editandoId === id) limparFormulario();
  }

  // Toggle pin
  async function handleFixar(nota) {
    const docRef = doc(db, 'usuarios', usuario.uid, 'observacoes', nota.id);
    await updateDoc(docRef, { fixado: !nota.fixado });
  }

  return (
    <div className="observacoes-tab">
      {/* ── Form ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', marginBottom: '1rem' }}>
          {editandoId ? '✎ Editar Nota' : '📝 Nova Nota'}
        </h2>

        <form onSubmit={handleSalvar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text"
            placeholder="Título (opcional)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="input"
          />

          <textarea
            placeholder="Escreva sua nota... *"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            required
            rows={5}
            className="input"
            style={{ resize: 'vertical', minHeight: '100px', fontFamily: 'DM Sans, sans-serif' }}
          />

          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            required
            className="input"
            style={{
              color: tag ? TAG_COLOR_MAP[tag] : undefined
            }}
          >
            <option value="">Selecione uma tag *</option>
            {TAGS.map((t) => (
              <option key={t.label} value={t.label} style={{ color: t.color }}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Campos condicionais para Lembrete */}
          {tag === 'Lembrete' && (
            <div style={{ display: 'flex', gap: '1rem', background: 'rgba(255, 217, 61, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 217, 61, 0.2)' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', color: '#ffd93d' }}>📅 Data do Aviso (E-mail)</label>
                <input
                  type="date"
                  value={lembreteData}
                  onChange={(e) => setLembreteData(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', color: '#ffd93d' }}>⏰ Hora (Opcional)</label>
                <input
                  type="time"
                  value={lembreteHora}
                  onChange={(e) => setLembreteHora(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              {editandoId ? 'Atualizar Nota' : 'Salvar Nota'}
            </button>
            {editandoId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={limparFormulario}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="🔍 Buscar notas..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="input"
        />
      </div>

      {/* ── Tag Filters ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className="btn btn-sm"
          onClick={() => setFiltroTag('Todas')}
          style={{
            background: filtroTag === 'Todas' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
            border: filtroTag === 'Todas' ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            padding: '0.35rem 0.85rem',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: filtroTag === 'Todas' ? 600 : 400,
            transition: 'all 0.2s ease'
          }}
        >
          Todas
        </button>
        {TAGS.map((t) => (
          <button
            key={t.label}
            className="btn btn-sm"
            onClick={() => setFiltroTag(t.label)}
            style={{
              background: filtroTag === t.label ? t.color + '33' : 'rgba(255,255,255,0.05)',
              border: filtroTag === t.label ? `1px solid ${t.color}` : '1px solid rgba(255,255,255,0.08)',
              color: filtroTag === t.label ? t.color : 'rgba(255,255,255,0.6)',
              padding: '0.35rem 0.85rem',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: filtroTag === t.label ? 600 : 400,
              transition: 'all 0.2s ease'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Notes List ── */}
      {notasFiltradas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.4)' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</p>
          <p>Nenhuma nota encontrada.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notasFiltradas.map((nota) => {
            const tagColor = TAG_COLOR_MAP[nota.tag] || '#888';

            return (
              <div
                key={nota.id}
                className="card"
                style={{
                  borderLeft: `3px solid ${tagColor}`,
                  position: 'relative'
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    {nota.fixado && (
                      <span style={{ fontSize: '0.9rem' }} title="Fixada">📌</span>
                    )}
                    {nota.titulo && (
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', fontFamily: 'Syne, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {nota.titulo}
                      </span>
                    )}
                  </div>

                  {/* Tag badge */}
                  <span
                    style={{
                      background: tagColor + '22',
                      color: tagColor,
                      border: `1px solid ${tagColor}55`,
                      padding: '0.15rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {nota.tag}
                  </span>
                </div>

                {/* Badge visual de Lembrete Data */}
                {nota.tag === 'Lembrete' && nota.lembreteData && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 217, 61, 0.1)', border: '1px solid rgba(255, 217, 61, 0.3)', padding: '4px 10px', borderRadius: '20px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem' }}>⏰</span>
                    <span style={{ fontSize: '0.8rem', color: '#ffd93d', fontWeight: 600 }}>
                      Aviso: {new Date(nota.lembreteData + 'T12:00:00').toLocaleDateString('pt-BR')} 
                      {nota.lembreteHora && ` às ${nota.lembreteHora}`}
                    </span>
                    {nota.notificado && <span style={{ fontSize: '0.7rem', color: '#00d4aa', marginLeft: '4px' }}>(Enviado)</span>}
                  </div>
                )}

                {/* Texto */}
                <p style={{
                  whiteSpace: 'pre-wrap',
                  color: 'rgba(255,255,255,0.75)',
                  lineHeight: 1.6,
                  marginBottom: '0.75rem',
                  wordBreak: 'break-word'
                }}>
                  {nota.texto}
                </p>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {/* Dates */}
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                    <span>Criado: {formatTimestamp(nota.criadoEm)}</span>
                    {nota.editadoEm && nota.editadoEm.seconds && (
                      <span style={{ marginLeft: '0.75rem' }}>
                        Editado: {formatTimestamp(nota.editadoEm)}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => handleFixar(nota)}
                      title={nota.fixado ? 'Desafixar' : 'Fixar'}
                      style={{
                        background: nota.fixado ? 'rgba(255,217,61,0.15)' : 'rgba(255,255,255,0.05)',
                        border: nota.fixado ? '1px solid rgba(255,217,61,0.3)' : '1px solid rgba(255,255,255,0.08)',
                        color: nota.fixado ? '#ffd93d' : 'rgba(255,255,255,0.5)',
                        borderRadius: '8px',
                        padding: '0.3rem 0.55rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      📌
                    </button>
                    <button
                      onClick={() => handleEditar(nota)}
                      title="Editar"
                      style={{
                        background: 'rgba(108,92,231,0.1)',
                        border: '1px solid rgba(108,92,231,0.25)',
                        color: '#6c5ce7',
                        borderRadius: '8px',
                        padding: '0.3rem 0.55rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleExcluir(nota.id)}
                      title="Excluir"
                      style={{
                        background: 'rgba(255,107,107,0.1)',
                        border: '1px solid rgba(255,107,107,0.25)',
                        color: '#ff6b6b',
                        borderRadius: '8px',
                        padding: '0.3rem 0.55rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
