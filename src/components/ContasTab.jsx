import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot, doc, query, where } from 'firebase/firestore';
import { formatarMoeda, chaveMes, MESES, despesaAtivaNoPeriodo } from '../utils/helpers';
import NavegacaoMes from './NavegacaoMes';
import { usePreferencias } from '../contexts/PreferenciasContext';

export default function ContasTab() {
  const { usuario } = useAuth();
  const { rotuloEsposa, emojiEsposa } = usePreferencias();

  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());
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
      const ativas = lista.filter(d => despesaAtivaNoPeriodo(d, mesAtual, anoAtual));
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
         isPago = !!item.pago;
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

    // Barras de SAÚDE usam apenas os fundos de custeio (que não acumulam como reserva):
    //  - Empresa: só a caixinha Empresa (Manutenção é reserva e infla o indicador)
    //  - Pessoal: Contas + Conta Principal (Reserva/Emergência e Livre ficam de fora)
    const sEmpresa = (Number(saldos.empresa) || 0);
    const sPessoal = (Number(saldos.contas) || 0) + (Number(saldos.saldoConta) || 0);

    return {
      totalEmpresa: tEmpresa, totalEmpresaPago: tEmpresaPago, saldoEmpresa: sEmpresa,
      totalPessoal: tPessoal, totalPessoalPago: tPessoalPago, saldoPessoal: sPessoal,
      totalEsposa: tEsposa, totalEsposaPago: tEsposaPago
    };
  }, [despesasFixas, gastosVariaveis, saldos, mesAtualKey, mesAtual, anoAtual]);


  if (loading) return <div className="tab-content"><p>Carregando análises...</p></div>;

  const pendenteEmpresa = totalEmpresa - totalEmpresaPago;
  const pendentePessoalGeral = (totalPessoal + totalEsposa) - (totalPessoalPago + totalEsposaPago);
  
  // Total real de dinheiro: soma TODAS as caixinhas (inclui reservas) — calculado
  // de forma independente das barras de saúde para não contar a Conta Principal 2x.
  const dinheiroGeral =
    (Number(saldos.saldoConta) || 0) +
    (Number(saldos.empresa) || 0) +
    (Number(saldos.manutencao) || 0) +
    (Number(saldos.contas) || 0) +
    (Number(saldos.emergencia) || 0) +
    (Number(saldos.livre) || 0);
  const devendoGeral = pendenteEmpresa + pendentePessoalGeral;
  const saldoLivreReal = dinheiroGeral - devendoGeral;

  const custoFixoMensalEmpresa = totalEmpresa || 1;
  const mesesAdiantadosEmpresa = (saldoEmpresa / custoFixoMensalEmpresa).toFixed(1);
  const progressoEmpresaPct = Math.min(100, Math.round((saldoEmpresa / custoFixoMensalEmpresa) * 100)) || 0;
  
  const custoFixoMensalPessoal = (totalPessoal + totalEsposa) || 1;
  const progressoPessoalPct = Math.min(100, Math.round((saldoPessoal / custoFixoMensalPessoal) * 100)) || 0;

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-2xl font-bold text-hawk-text flex items-center justify-center gap-2">
          <span>📈</span> Termômetro Financeiro
        </h2>
        <p className="text-sm text-hawk-muted">
          Esta aba unifica todos os seus registros de Despesas Fixas e Variáveis.
        </p>
      </div>

      {/* Navegação de Mês */}
      <NavegacaoMes
        mesAtual={mesAtual}
        anoAtual={anoAtual}
        setMesAtual={setMesAtual}
        setAnoAtual={setAnoAtual}
      />

      {/* VISOR PAZ DE ESPÍRITO (O Grande Visor) */}
      <div className={`rounded-3xl border p-8 text-center shadow-card-hover transition-all duration-300
        ${saldoLivreReal >= 0 
          ? 'border-hawk-green/30 bg-gradient-to-br from-hawk-green/10 to-hawk-card/80' 
          : 'border-hawk-red/30 bg-gradient-to-br from-hawk-red/10 to-hawk-card/80'}`
      }>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-hawk-muted mb-4">
          Se você pagar TUDO do mês de {MESES[mesAtual]} hoje, te sobrariam:
        </h3>
        <div className={`text-5xl md:text-6xl font-black tracking-tight mb-4
          ${saldoLivreReal >= 0 
            ? 'text-hawk-green drop-shadow-[0_0_15px_rgba(0,212,170,0.3)]' 
            : 'text-hawk-red drop-shadow-[0_0_15px_rgba(255,107,107,0.3)]'}`
        }>
          {formatarMoeda(saldoLivreReal)}
        </div>
        <p className="text-sm text-hawk-text/80 font-medium bg-black/20 inline-block px-4 py-2 rounded-full border border-white/5">
          (Total em Dinheiro Atual: <strong className="text-hawk-text">{formatarMoeda(dinheiroGeral)}</strong> | Total Devendo: <strong className="text-hawk-text">{formatarMoeda(devendoGeral)}</strong>)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* BARRA EMPRESA */}
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card flex flex-col hover:border-hawk-purple/30 transition-colors duration-300">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-hawk-text flex items-center gap-2">
              <span>🏢</span> Saúde da Empresa
            </h3>
            <span className="text-xs text-hawk-muted font-medium">Custos vs Caixinha Empresa</span>
          </div>
          
          <div className="flex justify-between items-end mb-2 text-sm">
            <span className="text-hawk-muted">Saldo Atual: <strong className="text-hawk-text text-base">{formatarMoeda(saldoEmpresa)}</strong></span>
            <span className="text-hawk-muted">Meta: <strong className="text-hawk-text text-base">{formatarMoeda(totalEmpresa)}</strong></span>
          </div>

          <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 mb-3">
            <div 
              className={`h-full transition-all duration-1000 rounded-full ${progressoEmpresaPct >= 100 ? 'bg-gradient-to-r from-hawk-green to-[#00b894] shadow-[0_0_15px_#00d4aa]' : 'bg-gradient-to-r from-hawk-red to-hawk-yellow'}`}
              style={{ width: `${progressoEmpresaPct}%` }} 
            />
          </div>
          
          <div className="text-xs text-center font-medium mb-6">
            {progressoEmpresaPct >= 100 ? (
              <span className="text-hawk-green">✅ Custos Operacionais 100% garantidos.</span>
            ) : (
              <span className="text-hawk-red">Ainda faltam <strong className="font-bold">{formatarMoeda(totalEmpresa - saldoEmpresa)}</strong> para empatar os custos.</span>
            )}
          </div>

          {/* Módulo Visionário */}
          <div className="mt-auto rounded-xl p-4 bg-hawk-purple/10 border border-hawk-purple/20 flex gap-3 items-start">
            <span className="text-xl leading-none">🔮</span>
            <span className="text-sm text-hawk-text/90 leading-relaxed">
              <strong>Módulo Visionário:</strong> Com os fundos atuais da Empresa, você consegue rodar com todos os custos fixos pagos por <strong className="text-hawk-purple text-base px-1">{mesesAdiantadosEmpresa} meses</strong> adiantados.
            </span>
          </div>
        </div>

        {/* BARRA PESSOAL */}
        <div className="rounded-2xl border border-glass-border bg-hawk-card p-6 shadow-card flex flex-col hover:border-hawk-blue/30 transition-colors duration-300">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-hawk-text flex items-center gap-2">
              <span>👤</span> Saúde Pessoal
            </h3>
            <span className="text-xs text-hawk-muted font-medium">Suas contas e da {rotuloEsposa.toLowerCase()} vs Contas + Conta Principal</span>
          </div>
          
          <div className="flex justify-between items-end mb-2 text-sm">
            <span className="text-hawk-muted">Saldo Pessoal: <strong className="text-hawk-text text-base">{formatarMoeda(saldoPessoal)}</strong></span>
            <span className="text-hawk-muted">Meta: <strong className="text-hawk-text text-base">{formatarMoeda(totalPessoal + totalEsposa)}</strong></span>
          </div>

          <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 mb-3">
            <div 
              className={`h-full transition-all duration-1000 rounded-full ${progressoPessoalPct >= 100 ? 'bg-gradient-to-r from-hawk-blue to-hawk-purple shadow-[0_0_15px_#6c5ce7]' : 'bg-gradient-to-r from-hawk-red to-[#e17055]'}`}
              style={{ width: `${progressoPessoalPct}%` }} 
            />
          </div>
          
          <div className="text-xs text-center font-medium mb-6">
            {progressoPessoalPct >= 100 ? (
              <span className="text-hawk-blue">✅ A casa está totalmente blindada!</span>
            ) : (
              <span className="text-hawk-red">Ainda faltam <strong className="font-bold">{formatarMoeda((totalPessoal + totalEsposa) - saldoPessoal)}</strong> para o mês pessoal fechar em verde.</span>
            )}
          </div>
          
          <div className="mt-auto rounded-xl p-4 bg-pink-500/10 border border-pink-500/20 flex justify-between items-center gap-2">
            <span className="text-sm text-hawk-text/90">
              {emojiEsposa} Deste montante, Gastos {rotuloEsposa}:
            </span>
            <strong className="text-pink-400 text-base">{formatarMoeda(totalEsposa)}</strong>
          </div>
        </div>

      </div>
    </div>
  );
}
