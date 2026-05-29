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

  // Lembretes Diários (EmailJS)
  useEffect(() => {
    if (!usuario || notas.length === 0 || lembretesVerificados.current) return;
    const verificarEEnviarLembretes = async () => {
      lembretesVerificados.current = true;
      const hojeStr = new Date().toISOString().split('T')[0];
      const amanhaDate = new Date();
      amanhaDate.setDate(amanhaDate.getDate() + 1);
      const amanhaStr = amanhaDate.toISOString().split('T')[0];

      for (const nota of notas) {
        if (nota.tag === 'Lembrete' && nota.lembreteData && !nota.notificado) {
          const isHoje = nota.lembreteData === hojeStr;
          const isAmanha = nota.lembreteData === amanhaStr;
          
          if (isHoje || isAmanha) {
            try {
              const serviceId = 'service_1frjvqc'; 
              const templateId = 'template_xfhgeoe'; 
              const publicKey = 't13na8-V7eKws36yp';
              if (serviceId === 'YOUR_SERVICE_ID') continue;

              await emailjs.send(serviceId, templateId, {
                to_name: usuario.displayName,
                to_email: usuario.email,
                titulo: nota.titulo || 'Lembrete do Hawk Driver',
                mensagem: nota.texto,
                data: nota.lembreteData,
                hora: nota.lembreteHora || 'Não especificada',
                tipo: isHoje ? 'HOJE' : 'AMANHÃ'
              }, publicKey);

              if (isHoje) {
                const docRef = doc(db, 'usuarios', usuario.uid, 'observacoes', nota.id);
                await updateDoc(docRef, { notificado: true });
              }
            } catch (err) {
              console.error('Erro ao enviar email de lembrete:', err);
            }
          }
        }
      }
    };
    verificarEEnviarLembretes();
  }, [notas, usuario]);

  const notasFiltradas = useMemo(() => {
    let resultado = [...notas];
    if (filtroTag !== 'Todas') resultado = resultado.filter((n) => n.tag === filtroTag);
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      resultado = resultado.filter((n) => {
        const tituloMatch = (n.titulo || '').toLowerCase().includes(termo);
        const textoMatch = (n.texto || '').toLowerCase().includes(termo);
        return tituloMatch || textoMatch;
      });
    }
    resultado.sort((a, b) => {
      if (a.fixado && !b.fixado) return -1;
      if (!a.fixado && b.fixado) return 1;
      const tsA = a.criadoEm?.seconds || 0;
      const tsB = b.criadoEm?.seconds || 0;
      return tsB - tsA;
    });
    return resultado;
  }, [notas, filtroTag, busca]);

  function limparFormulario() {
    setTitulo('');
    setTexto('');
    setTag('');
    setLembreteData('');
    setLembreteHora('');
    setEditandoId(null);
  }

  async function handleSalvar(e) {
    e.preventDefault();
    if (!texto.trim() || !tag) return;
    const ref = collection(db, 'usuarios', usuario.uid, 'observacoes');
    const notaData = {
      titulo: titulo.trim(),
      texto: texto.trim(),
      tag,
      lembreteData: tag === 'Lembrete' ? lembreteData : null,
      lembreteHora: tag === 'Lembrete' ? lembreteHora : null,
    };
    
    if (editandoId) {
      const docRef = doc(db, 'usuarios', usuario.uid, 'observacoes', editandoId);
      await updateDoc(docRef, { ...notaData, editadoEm: serverTimestamp() });
    } else {
      await addDoc(ref, {
        ...notaData,
        fixado: false,
        notificado: false,
        criadoEm: serverTimestamp(),
        editadoEm: null
      });
    }
    limparFormulario();
  }

  function handleEditar(nota) {
    setTitulo(nota.titulo || '');
    setTexto(nota.texto || '');
    setTag(nota.tag || '');
    setLembreteData(nota.lembreteData || '');
    setLembreteHora(nota.lembreteHora || '');
    setEditandoId(nota.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleExcluir(id) {
    if (!window.confirm('Tem certeza que deseja excluir esta nota?')) return;
    const docRef = doc(db, 'usuarios', usuario.uid, 'observacoes', id);
    await deleteDoc(docRef);
    if (editandoId === id) limparFormulario();
  }

  async function handleFixar(nota) {
    const docRef = doc(db, 'usuarios', usuario.uid, 'observacoes', nota.id);
    await updateDoc(docRef, { fixado: !nota.fixado });
  }

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 space-y-6 animate-fade-in">
      
      {/* HEADER & FORM */}
      <div className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card">
        <h2 className="text-xl font-bold text-hawk-text mb-6 flex items-center gap-2">
          <span>{editandoId ? '✎' : '📝'}</span> 
          {editandoId ? 'Editar Nota' : 'Nova Nota'}
        </h2>

        <form onSubmit={handleSalvar} className="space-y-4">
          <input
            type="text"
            placeholder="Título (opcional)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-3 text-sm text-hawk-text focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors"
          />

          <textarea
            placeholder="Escreva sua nota... *"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            required
            rows={5}
            className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-3 text-sm text-hawk-text focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors resize-y min-h-[100px]"
          />

          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            required
            className="w-full bg-hawk-input border border-glass-border rounded-xl px-4 py-3 text-sm text-hawk-text focus:outline-none focus:ring-1 focus:border-hawk-purple/50 transition-colors cursor-pointer appearance-none"
            style={{ color: tag ? TAG_COLOR_MAP[tag] : undefined }}
          >
            <option value="" className="text-hawk-muted">Selecione uma tag *</option>
            {TAGS.map((t) => (
              <option key={t.label} value={t.label} style={{ color: t.color }}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Campos Lembrete */}
          {tag === 'Lembrete' && (
            <div className="flex gap-4 p-4 rounded-xl bg-hawk-input/50 border border-yellow-500/20">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-yellow-500">📅 Data do Aviso (E-mail)</label>
                <input
                  type="date"
                  value={lembreteData}
                  onChange={(e) => setLembreteData(e.target.value)}
                  className="w-full bg-hawk-bg border border-glass-border rounded-lg px-3 py-2 text-sm text-hawk-text focus:outline-none focus:border-yellow-500/50"
                  required
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-yellow-500">⏰ Hora (Opcional)</label>
                <input
                  type="time"
                  value={lembreteHora}
                  onChange={(e) => setLembreteHora(e.target.value)}
                  className="w-full bg-hawk-bg border border-glass-border rounded-lg px-3 py-2 text-sm text-hawk-text focus:outline-none focus:border-yellow-500/50"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-hawk-purple hover:bg-hawk-purple/90 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(108,92,231,0.2)] active:scale-95">
              {editandoId ? 'Atualizar Nota' : 'Salvar Nota'}
            </button>
            {editandoId && (
              <button type="button" onClick={limparFormulario} className="flex-1 bg-hawk-card border border-glass-border hover:bg-glass-hover text-hawk-text font-semibold py-3 px-6 rounded-xl transition-all active:scale-95">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="space-y-4">
        <input
          type="text"
          placeholder="🔍 Buscar notas..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full bg-hawk-card border border-glass-border rounded-xl px-4 py-3 text-sm text-hawk-text focus:outline-none focus:ring-1 focus:border-hawk-purple/50 shadow-card"
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroTag('Todas')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${filtroTag === 'Todas' ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-hawk-muted border-glass-border hover:bg-white/5'}`}
          >
            Todas
          </button>
          {TAGS.map((t) => (
            <button
              key={t.label}
              onClick={() => setFiltroTag(t.label)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all border"
              style={{
                background: filtroTag === t.label ? t.color + '22' : 'transparent',
                borderColor: filtroTag === t.label ? t.color : 'rgba(255,255,255,0.08)',
                color: filtroTag === t.label ? t.color : 'rgba(255,255,255,0.5)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* NOTES LIST */}
      {notasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-glass-border border-dashed bg-hawk-card p-10 text-center shadow-card opacity-80">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-hawk-muted text-sm font-medium">Nenhuma nota encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notasFiltradas.map((nota) => {
            const tagColor = TAG_COLOR_MAP[nota.tag] || '#888';

            return (
              <div key={nota.id} className="rounded-2xl border border-glass-border bg-hawk-card p-5 shadow-card flex flex-col hover:border-white/10 transition-colors" style={{ borderLeftColor: tagColor, borderLeftWidth: '4px' }}>
                
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {nota.fixado && <span className="text-sm" title="Fixada">📌</span>}
                    {nota.titulo && (
                      <h3 className="font-bold text-hawk-text truncate flex-1">{nota.titulo}</h3>
                    )}
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 border" style={{ backgroundColor: tagColor + '15', color: tagColor, borderColor: tagColor + '30' }}>
                    {nota.tag}
                  </span>
                </div>

                {nota.tag === 'Lembrete' && nota.lembreteData && (
                  <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg mb-3 self-start">
                    <span className="text-xs">⏰</span>
                    <span className="text-[11px] font-bold text-yellow-500">
                      Aviso: {new Date(nota.lembreteData + 'T12:00:00').toLocaleDateString('pt-BR')} 
                      {nota.lembreteHora && ` às ${nota.lembreteHora}`}
                    </span>
                    {nota.notificado && <span className="text-[10px] text-hawk-green ml-1">(Enviado)</span>}
                  </div>
                )}

                <p className="text-sm text-hawk-text/80 whitespace-pre-wrap break-words leading-relaxed mb-4 flex-1">
                  {nota.texto}
                </p>

                <div className="flex justify-between items-center mt-auto pt-3 border-t border-glass-border">
                  <div className="text-[10px] text-hawk-dim flex flex-col">
                    <span>Criado: {formatTimestamp(nota.criadoEm)}</span>
                    {nota.editadoEm?.seconds && <span>Editado: {formatTimestamp(nota.editadoEm)}</span>}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleFixar(nota)} title={nota.fixado ? 'Desafixar' : 'Fixar'} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors border" style={{ background: nota.fixado ? 'rgba(255,217,61,0.1)' : 'transparent', borderColor: nota.fixado ? 'rgba(255,217,61,0.2)' : 'rgba(255,255,255,0.05)', color: nota.fixado ? '#ffd93d' : 'rgba(255,255,255,0.4)' }}>
                      📌
                    </button>
                    <button onClick={() => handleEditar(nota)} title="Editar" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-hawk-purple/10 hover:bg-hawk-purple/20 border border-hawk-purple/20 text-hawk-purple">
                      ✎
                    </button>
                    <button onClick={() => handleExcluir(nota.id)} title="Excluir" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-hawk-red/10 hover:bg-hawk-red/20 border border-hawk-red/20 text-hawk-red">
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
