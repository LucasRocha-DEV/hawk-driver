import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot, doc, query, where } from 'firebase/firestore';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function chaveMes(mes, ano) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function ContasTab() {
  const { usuario } = useAuth();

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const mesAtualKey = chaveMes(mesAtual, anoAtual);

  const [despesasFixas, setDespesasFixas] = useState([]);
  const [gastosVariaveis, setGastosVariaveis] = useState([]);
  const [saldos, setSaldos] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario) return;

    // 1. Snapshot Despesas Fixas (Não filtra por mês na query porque dependem de logica de vigência)
    const qFixas = collection(db, 'usuarios', usuario.uid, 'despesas_fixas');
    const unsubFixas = onSnapshot(qFixas, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filtra as que estão ativas neste mês
      const ativas = lista.filter(d => {
        const mesInicio = d.mesInicio ?? d.mes ?? 0;
        const anoInicio = d.anoInicio ?? d.ano ?? 2020;
        const periodoAtual = anoAtual * 12 + mesAtual;
        const periodoInicio = anoInicio * 12 + mesInicio;
        if (periodoAtual < periodoInicio) return false;
        if (d.recorrente === false) return periodoAtual === periodoInicio;
        if (d.mesFim != null && d.anoFim != null && d.mesFim !== '' && d.anoFim !== '') {
          const periodoFim = Number(d.anoFim) * 12 + Number(d.mesFim);
          if (periodoAtual > periodoFim) return false;
        }
        return true;
      });
      setDespesasFixas(ativas);
    });

    // 2. Snapshot Gastos Variáveis (Filtra por mês atual no Firebase)
    const qVariaveis = query(
      collection(db, 'usuarios', usuario.uid, 'despesas_variaveis'),
      where('mes', '==', mesAtual),
      where('ano', '==', anoAtual)
    );
    const unsubVariaveis = onSnapshot(qVariaveis, (snap) => {
      setGastosVariaveis(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Snapshot Saldos
    const unsubSaldos = onSnapshot(doc(db, 'usuarios', usuario.uid, 'saldos', 'atual'), (docSnap) => {
      if (docSnap.exists()) {
        setSaldos(docSnap.data());
      }
      setLoading(false);
    });

    return () => {
      unsubFixas();
      unsubVariaveis();
      unsubSaldos();
    };
  }, [usuario, mesAtual, anoAtual]);

  const {
    totalEmpresa, totalEmpresaPago, saldoEmpresa,
    totalPessoal, totalPessoalPago, saldoPessoal,
    totalEsposa, totalEsposaPago
  } = useMemo(() => {
    let tEmpresa = 0; let tEmpresaPago = 0;
    let tPessoal = 0; let tPessoalPago = 0;
    let tEsposa = 0; let tEsposaPago = 0;

    const somarItem = (item, isFixa) => {
      const val = Number(item.valor) || 0;
      
      let isPago = false;
      if (isFixa) {
         if (item.pagoPorMes != null && typeof item.pagoPorMes === 'object') isPago = !!item.pagoPorMes[mesAtualKey];
         else isPago = item.pago === true && item.mes === mesAtual && item.ano === anoAtual;
      } else {
         isPago = !!item.pago; // Gastos Variaveis tem boolean normal
      }

      const ehEmpresa = item.natureza === 'EMPRESA';
      const ehEsposa = item.isEsposa === true;

      if (ehEmpresa) {
        tEmpresa += val;
        if (isPago) tEmpresaPago += val;
      } else if (ehEsposa) {
        tEsposa += val;
        if (isPago) tEsposaPago += val;
      } else {
        tPessoal += val;
        if (isPago) tPessoalPago += val;
      }
    };

    despesasFixas.forEach(d => somarItem(d, true));
    gastosVariaveis.forEach(g => somarItem(g, false));

    const sEmpresa = (Number(saldos.empresa) || 0) + (Number(saldos.manutencao) || 0);
    const sPessoal = (Number(saldos.contas) || 0) + (Number(saldos.emergencia) || 0) + (Number(saldos.livre) || 0);

    return {
      totalEmpresa: tEmpresa, totalEmpresaPago: tEmpresaPago, saldoEmpresa: sEmpresa,
      totalPessoal: tPessoal, totalPessoalPago: tPessoalPago, saldoPessoal: sPessoal,
      totalEsposa: tEsposa, totalEsposaPago: tEsposaPago
    };
  }, [despesasFixas, gastosVariaveis, saldos, mesAtualKey, mesAtual, anoAtual]);


  if (loading) return <div className="tab-content"><p>Carregando análises...</p></div>;

  const pendenteEmpresa = totalEmpresa - totalEmpresaPago;
  const pendentePessoalGeral = (totalPessoal + totalEsposa) - (totalPessoalPago + totalEsposaPago);
  
  const dinheiroGeral = (Number(saldos.saldoConta)||0) + saldoEmpresa + saldoPessoal;
  const devendoGeral = pendenteEmpresa + pendentePessoalGeral;
  const saldoLivreReal = dinheiroGeral - devendoGeral;

  const custoFixoMensalEmpresa = totalEmpresa || 1;
  const mesesAdiantadosEmpresa = (saldoEmpresa / custoFixoMensalEmpresa).toFixed(1);
  const progressoEmpresaPct = Math.min(100, Math.round((saldoEmpresa / custoFixoMensalEmpresa) * 100)) || 0;
  
  const custoFixoMensalPessoal = (totalPessoal + totalEsposa) || 1;
  const progressoPessoalPct = Math.min(100, Math.round((saldoPessoal / custoFixoMensalPessoal) * 100)) || 0;

  return (
    <div className="tab-content">
      <div className="dashboard-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 className="dashboard-title">📈 Termômetro Financeiro</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Esta aba unifica todos os seus registros de Despesas Fixas e Variáveis.</p>
      </div>

      {/* VISOR PAZ DE ESPÍRITO (O Grande Visor) */}
      <div className="section-card" style={{ textAlign: 'center', marginBottom: '24px', background: saldoLivreReal >= 0 ? 'linear-gradient(145deg, rgba(0,212,170,0.1), rgba(22,22,35,0.8))' : 'linear-gradient(145deg, rgba(255,107,107,0.1), rgba(22,22,35,0.8))' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Se você pagar TUDO do mês de {MESES[mesAtual]} hoje, te sobrariam:
        </h3>
        <div style={{ fontSize: '3rem', fontWeight: 800, color: saldoLivreReal >= 0 ? '#00d4aa' : '#ff6b6b', textShadow: saldoLivreReal >= 0 ? '0 0 20px rgba(0,212,170,0.4)' : '0 0 20px rgba(255,107,107,0.4)' }}>
          {formatarMoeda(saldoLivreReal)}
        </div>
        <p style={{ margin: '12px 0 0 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          (Total em Dinheiro Atual: {formatarMoeda(dinheiroGeral)} | Total Devendo: {formatarMoeda(devendoGeral)})
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        
        {/* BARRA EMPRESA */}
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>🏢 Saúde da Empresa</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Custos vs Caixinhas da Empresa</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
            <span>Saldo Atual: <strong>{formatarMoeda(saldoEmpresa)}</strong></span>
            <span>Meta de Custos: <strong>{formatarMoeda(totalEmpresa)}</strong></span>
          </div>

          <div style={{ width: '100%', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              width: `${progressoEmpresaPct}%`, height: '100%',
              background: progressoEmpresaPct >= 100 ? 'linear-gradient(90deg, #00b894, #00d4aa)' : 'linear-gradient(90deg, #ff6b6b, #ffd93d)',
              transition: 'width 1s ease-in-out',
              boxShadow: progressoEmpresaPct >= 100 ? '0 0 15px #00d4aa' : 'none'
            }} />
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.85rem', textAlign: 'center' }}>
            {progressoEmpresaPct >= 100 ? (
              <span style={{ color: '#00d4aa', fontWeight: 'bold' }}>✅ Custos Operacionais 100% garantidos.</span>
            ) : (
              <span style={{ color: '#ff6b6b' }}>Ainda faltam {formatarMoeda(totalEmpresa - saldoEmpresa)} para empatar os custos.</span>
            )}
          </div>

          {/* Módulo Visionário */}
          <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(108, 92, 231, 0.1)', borderRadius: '12px', border: '1px solid rgba(108, 92, 231, 0.2)' }}>
            <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>🔮</span>
            <span style={{ fontSize: '0.9rem' }}>
              <strong>Módulo Visionário:</strong> Com os fundos atuais da Empresa, você consegue rodar com todos os custos fixos pagos por <strong style={{ color: '#a29bfe', fontSize: '1.1rem' }}>{mesesAdiantadosEmpresa} meses</strong> adiantados.
            </span>
          </div>
        </div>

        {/* BARRA PESSOAL */}
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>👤 Saúde Pessoal</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Suas contas e da esposa vs Caixinhas Pessoais</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
            <span>Saldo Pessoal: <strong>{formatarMoeda(saldoPessoal)}</strong></span>
            <span>Meta de Custos: <strong>{formatarMoeda(totalPessoal + totalEsposa)}</strong></span>
          </div>

          <div style={{ width: '100%', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              width: `${progressoPessoalPct}%`, height: '100%',
              background: progressoPessoalPct >= 100 ? 'linear-gradient(90deg, #0984e3, #6c5ce7)' : 'linear-gradient(90deg, #ff6b6b, #e17055)',
              transition: 'width 1s ease-in-out',
              boxShadow: progressoPessoalPct >= 100 ? '0 0 15px #6c5ce7' : 'none'
            }} />
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.85rem', textAlign: 'center' }}>
            {progressoPessoalPct >= 100 ? (
              <span style={{ color: '#0984e3', fontWeight: 'bold' }}>✅ A casa está totalmente blindada!</span>
            ) : (
              <span style={{ color: '#ff6b6b' }}>Ainda faltam {formatarMoeda((totalPessoal + totalEsposa) - saldoPessoal)} para o mês pessoal fechar em verde.</span>
            )}
          </div>
          
          <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(253, 121, 168, 0.1)', borderRadius: '12px', border: '1px solid rgba(253, 121, 168, 0.2)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>👩 Deste montante, o que é Gastos Esposa:</span>
            <strong style={{ color: '#fd79a8' }}>{formatarMoeda(totalEsposa)}</strong>
          </div>
        </div>

      </div>
    </div>
  );
}
