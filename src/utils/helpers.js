// ═══════════════════════════════════════════════════════════
// HAWK DRIVER — Módulo Utilitário Compartilhado
// Centraliza funções, constantes e helpers usados em todo o app.
// ═══════════════════════════════════════════════════════════

// ─── Constantes ───

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Tipos de combustível suportados pelos veículos cadastrados.
 * A `unidade` define como o rendimento (consumo) e o preço são interpretados:
 *   L   → km por litro / R$ por litro
 *   m³  → km por metro cúbico / R$ por metro cúbico (GNV)
 *   kWh → km por kWh / R$ por kWh (elétrico)
 */
export const TIPOS_COMBUSTIVEL = {
  gasolina: { label: 'Gasolina', unidade: 'L',   emoji: '⛽' },
  etanol:   { label: 'Etanol',   unidade: 'L',   emoji: '🌱' },
  diesel:   { label: 'Diesel',   unidade: 'L',   emoji: '🛢️' },
  gnv:      { label: 'GNV',       unidade: 'm³',  emoji: '💨' },
  eletrico: { label: 'Elétrico',  unidade: 'kWh', emoji: '⚡' },
};

export const CAIXINHAS_INFO = {
  emergencia:      { nome: 'Reserva de Emergência', emoji: '🚨', cor: '#ffd93d', grupo: 'pessoal' },
  manutencao:      { nome: 'Manutenção',            emoji: '🔧', cor: '#ff6b6b', grupo: 'empresa' },
  empresa:         { nome: 'Empresa',               emoji: '🏢', cor: '#6c5ce7', grupo: 'empresa' },
  livre:           { nome: 'Livre / Lazer',          emoji: '💸', cor: '#00b894', grupo: 'pessoal' },
  contas:          { nome: 'Contas',                 emoji: '💳', cor: '#0984e3', grupo: 'pessoal' },
  saldoRetidoApps: { nome: 'A Receber dos Apps',     emoji: '⏳', cor: '#00cec9', grupo: 'retido' },
  saldoConta:      { nome: 'Conta Principal',        emoji: '🏦', cor: '#00d4aa', grupo: 'conta' }
};

/**
 * Retorna o nome bonito de uma caixinha a partir do seu ID.
 * Substitui a lógica manual espalhada em vários componentes.
 */
export function nomeCaixinha(caixinhaId) {
  return CAIXINHAS_INFO[caixinhaId]?.nome || caixinhaId;
}

// ─── Formatação ───

/**
 * Formata um número para moeda BRL (R$ 1.234,56).
 */
export function formatarMoeda(valor) {
  const v = Number(valor);
  return (isNaN(v) ? 0 : v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata uma data ISO (YYYY-MM-DD) para DD/MM/AAAA.
 */
export function formatarData(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Formata uma data ISO para exibição localizada pt-BR.
 */
export function formatarDataExibicao(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

/**
 * Gera a chave YYYY-MM-DD a partir de um objeto Date.
 */
export function formatarDataChave(data) {
  const d = new Date(data);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Retorna a data de hoje no formato ISO YYYY-MM-DD.
 */
export function dataHojeISO() {
  return formatarDataChave(new Date());
}

/**
 * Gera a chave mês/ano no formato "YYYY-MM".
 * @param {number} mes - Mês 0-indexed (getMonth())
 * @param {number} ano - Ano completo (getFullYear())
 */
export function chaveMes(mes, ano) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}`;
}

/**
 * Formata um timestamp do Firestore para exibição.
 */
export function formatarTimestamp(ts) {
  if (!ts || !ts.seconds) return '';
  const d = new Date(ts.seconds * 1000);
  const date = d.toLocaleDateString('pt-BR');
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

// ─── Cálculos ───

/**
 * Estima o custo de combustível/energia de uma viagem a partir do veículo e do km rodado.
 *
 * Suporta todos os perfis de motorista:
 *   - Combustível líquido (gasolina/etanol/diesel) e GNV: custo = (km / consumo) * precoUnidade
 *   - Elétrico 'medido': mesma fórmula (consumo em km/kWh, preço em R$/kWh)
 *   - Elétrico 'carga_fixa': custo = (km / kmPorCarga) * valorCarga
 *   - Elétrico 'gratis': custo = 0 (motorista que não paga energia)
 *
 * @param {object|null} veiculo - Documento do veículo ({ combustivel, consumo, precoUnidade, modoEletrico, valorCarga, kmPorCarga })
 * @param {number|string} km - Quilômetros rodados
 * @returns {{ custo: number, custoPorKm: number }} Sempre números finitos (0 quando indeterminado).
 */
export function estimarCustoCombustivel(veiculo, km) {
  const kmNum = Number(km) || 0;
  const zero = { custo: 0, custoPorKm: 0 };
  if (!veiculo || kmNum <= 0) return zero;

  let custo = 0;

  if (veiculo.combustivel === 'eletrico') {
    const modo = veiculo.modoEletrico || 'medido';
    if (modo === 'gratis') {
      custo = 0;
    } else if (modo === 'carga_fixa') {
      const kmPorCarga = Number(veiculo.kmPorCarga) || 0;
      const valorCarga = Number(veiculo.valorCarga) || 0;
      custo = kmPorCarga > 0 ? (kmNum / kmPorCarga) * valorCarga : 0;
    } else {
      const consumo = Number(veiculo.consumo) || 0;
      const preco = Number(veiculo.precoUnidade) || 0;
      custo = consumo > 0 ? (kmNum / consumo) * preco : 0;
    }
  } else {
    const consumo = Number(veiculo.consumo) || 0;
    const preco = Number(veiculo.precoUnidade) || 0;
    custo = consumo > 0 ? (kmNum / consumo) * preco : 0;
  }

  if (!isFinite(custo) || custo < 0) custo = 0;
  return { custo, custoPorKm: kmNum > 0 ? custo / kmNum : 0 };
}

/**
 * Soma as despesas de um registro diário, compatível com o formato antigo.
 *
 * Formato novo: { combustivel: number, gastosGeraisItens: [{ valor, descricao }] }
 * Formato legado: { gastosGerais: number } (campo único, somava tudo)
 *
 * @param {object} r - Documento do registro diário
 * @returns {number} Total de despesas do dia.
 */
export function totalDespesasRegistro(r) {
  if (!r) return 0;
  if (r.combustivel != null || r.gastosGeraisItens != null) {
    const itens = (r.gastosGeraisItens || []).reduce((s, i) => s + (Number(i.valor) || 0), 0);
    return (Number(r.combustivel) || 0) + itens;
  }
  return Number(r.gastosGerais) || 0; // legado
}

/**
 * Parseia uma string de horas como "8h30" ou "8.5" e retorna horas decimais.
 */
export function parsarHoras(horarioStr) {
  if (!horarioStr) return 0;
  const str = String(horarioStr);
  const match = str.match(/(\d+)h(\d*)/);
  if (match) {
    const horas = parseInt(match[1], 10) || 0;
    const minutos = parseInt(match[2], 10) || 0;
    return horas + minutos / 60;
  }
  const f = parseFloat(str);
  return isNaN(f) ? 0 : f;
}

/**
 * Soma as horas de um array de registros Uber e retorna string "Xh00".
 */
export function somarHoras(registros) {
  let totalMinutos = 0;
  registros.forEach(r => {
    if (r.horarioRodado) {
      const match = r.horarioRodado.match(/(\d+)h(\d*)/);
      if (match) {
        totalMinutos += (parseInt(match[1], 10) || 0) * 60 + (parseInt(match[2], 10) || 0);
      }
    }
  });
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Verifica se uma despesa fixa está ativa (vigente) em um dado mês/ano.
 * @param {object} despesa - O documento da despesa fixa
 * @param {number} mes - Mês 0-indexed
 * @param {number} ano - Ano completo
 */
export function despesaAtivaNoPeriodo(despesa, mes, ano) {
  const mesInicio = despesa.mesInicio ?? despesa.mes ?? 0;
  const anoInicio = despesa.anoInicio ?? despesa.ano ?? 2020;

  const periodoAtual = ano * 12 + mes;
  const periodoInicio = anoInicio * 12 + mesInicio;

  if (periodoAtual < periodoInicio) return false;

  if (despesa.recorrente === false) {
    return periodoAtual === periodoInicio;
  }

  if (despesa.mesFim != null && despesa.anoFim != null && despesa.mesFim !== '' && despesa.anoFim !== '') {
    const periodoFim = Number(despesa.anoFim) * 12 + Number(despesa.mesFim);
    if (periodoAtual > periodoFim) return false;
  }

  return true;
}

/**
 * Gera um ID único para grupos de parcelamento.
 */
export function gerarGrupoId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * Pad zero para números.
 */
export function pad(num) {
  return String(num).padStart(2, '0');
}
