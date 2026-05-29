// ═══════════════════════════════════════════════════════════════
// HAWK DRIVER — Testes Unitários: helpers.js
// Cobre todas as funções utilitárias com casos normais e de borda.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  formatarMoeda,
  formatarData,
  formatarDataChave,
  chaveMes,
  parsarHoras,
  somarHoras,
  pad,
  nomeCaixinha,
  despesaAtivaNoPeriodo,
  gerarGrupoId,
  MESES,
  CAIXINHAS_INFO,
} from '../utils/helpers';

// ─── formatarMoeda ────────────────────────────────────────────
describe('formatarMoeda', () => {
  it('formata valor positivo corretamente', () => {
    expect(formatarMoeda(1234.56)).toBe('R$\u00a01.234,56');
  });

  it('formata zero corretamente', () => {
    expect(formatarMoeda(0)).toBe('R$\u00a00,00');
  });

  it('formata valor negativo corretamente', () => {
    expect(formatarMoeda(-500)).toBe('-R$\u00a0500,00');
  });

  it('trata NaN como zero', () => {
    expect(formatarMoeda(NaN)).toBe('R$\u00a00,00');
  });

  it('trata undefined como zero', () => {
    expect(formatarMoeda(undefined)).toBe('R$\u00a00,00');
  });

  it('aceita string numérica', () => {
    expect(formatarMoeda('250.75')).toBe('R$\u00a0250,75');
  });
});

// ─── formatarData ─────────────────────────────────────────────
describe('formatarData', () => {
  it('converte YYYY-MM-DD para DD/MM/AAAA', () => {
    expect(formatarData('2024-05-28')).toBe('28/05/2024');
  });

  it('retorna string vazia para valor vazio', () => {
    expect(formatarData('')).toBe('');
    expect(formatarData(null)).toBe('');
    expect(formatarData(undefined)).toBe('');
  });

  it('formata datas com dia e mês de 1 dígito corretamente', () => {
    expect(formatarData('2024-01-05')).toBe('05/01/2024');
  });
});

// ─── formatarDataChave ────────────────────────────────────────
describe('formatarDataChave', () => {
  it('retorna formato YYYY-MM-DD a partir de Date', () => {
    // Usa fuso fixo via UTC para evitar problemas de timezone no CI
    const data = new Date('2024-05-28T12:00:00');
    const resultado = formatarDataChave(data);
    expect(resultado).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(resultado).toBe('2024-05-28');
  });

  it('formata corretamente 1 de janeiro', () => {
    const data = new Date('2025-01-01T12:00:00');
    expect(formatarDataChave(data)).toBe('2025-01-01');
  });
});

// ─── chaveMes ─────────────────────────────────────────────────
describe('chaveMes', () => {
  it('formata mês 0 (janeiro) do ano 2024', () => {
    expect(chaveMes(0, 2024)).toBe('2024-01');
  });

  it('formata mês 11 (dezembro) do ano 2024', () => {
    expect(chaveMes(11, 2024)).toBe('2024-12');
  });

  it('formata mês 4 (maio) com zero à esquerda', () => {
    expect(chaveMes(4, 2024)).toBe('2024-05');
  });
});

// ─── parsarHoras ──────────────────────────────────────────────
describe('parsarHoras', () => {
  it('parseia formato "8h30" corretamente', () => {
    expect(parsarHoras('8h30')).toBeCloseTo(8.5);
  });

  it('parseia "10h00"', () => {
    expect(parsarHoras('10h00')).toBe(10);
  });

  it('parseia "1h" (sem minutos)', () => {
    expect(parsarHoras('1h')).toBe(1);
  });

  it('parseia número decimal como string', () => {
    expect(parsarHoras('8.5')).toBe(8.5);
  });

  it('retorna 0 para string vazia', () => {
    expect(parsarHoras('')).toBe(0);
  });

  it('retorna 0 para null/undefined', () => {
    expect(parsarHoras(null)).toBe(0);
    expect(parsarHoras(undefined)).toBe(0);
  });

  it('retorna 0 para string inválida', () => {
    expect(parsarHoras('invalido')).toBe(0);
  });

  it('parseia "0h30" como 0.5 horas', () => {
    expect(parsarHoras('0h30')).toBeCloseTo(0.5);
  });
});

// ─── somarHoras ───────────────────────────────────────────────
describe('somarHoras', () => {
  it('soma registros com horas corretamente', () => {
    const registros = [
      { horarioRodado: '8h00' },
      { horarioRodado: '2h30' },
    ];
    expect(somarHoras(registros)).toBe('10h30');
  });

  it('retorna "0h00" para array vazio', () => {
    expect(somarHoras([])).toBe('0h00');
  });

  it('ignora registros sem horarioRodado', () => {
    const registros = [
      { horarioRodado: '5h00' },
      { totalBruto: 300 }, // sem horarioRodado
    ];
    expect(somarHoras(registros)).toBe('5h00');
  });

  it('soma minutos que ultrapassam 60', () => {
    const registros = [
      { horarioRodado: '1h45' },
      { horarioRodado: '0h30' },
    ];
    expect(somarHoras(registros)).toBe('2h15');
  });
});

// ─── pad ──────────────────────────────────────────────────────
describe('pad', () => {
  it('adiciona zero à esquerda para número de 1 dígito', () => {
    expect(pad(5)).toBe('05');
    expect(pad(0)).toBe('00');
  });

  it('não altera número de 2 dígitos', () => {
    expect(pad(12)).toBe('12');
    expect(pad(59)).toBe('59');
  });
});

// ─── nomeCaixinha ─────────────────────────────────────────────
describe('nomeCaixinha', () => {
  it('retorna o nome correto para IDs conhecidos', () => {
    expect(nomeCaixinha('emergencia')).toBe('Reserva de Emergência');
    expect(nomeCaixinha('manutencao')).toBe('Manutenção');
    expect(nomeCaixinha('empresa')).toBe('Empresa');
    expect(nomeCaixinha('livre')).toBe('Livre / Lazer');
    expect(nomeCaixinha('contas')).toBe('Contas');
  });

  it('retorna o próprio ID para chaves desconhecidas (fallback)', () => {
    expect(nomeCaixinha('desconhecido')).toBe('desconhecido');
  });
});

// ─── despesaAtivaNoPeriodo ────────────────────────────────────
describe('despesaAtivaNoPeriodo', () => {
  it('despesa recorrente ativa desde o início', () => {
    const despesa = { mesInicio: 0, anoInicio: 2024, recorrente: true };
    expect(despesaAtivaNoPeriodo(despesa, 5, 2024)).toBe(true);
  });

  it('despesa não iniciada ainda não está ativa', () => {
    const despesa = { mesInicio: 6, anoInicio: 2024, recorrente: true };
    expect(despesaAtivaNoPeriodo(despesa, 5, 2024)).toBe(false);
  });

  it('despesa encerrada não está ativa no mês posterior', () => {
    const despesa = {
      mesInicio: 0, anoInicio: 2024,
      mesFim: 4, anoFim: 2024,
      recorrente: true,
    };
    expect(despesaAtivaNoPeriodo(despesa, 5, 2024)).toBe(false);
  });

  it('despesa encerrada está ativa no mês de encerramento', () => {
    const despesa = {
      mesInicio: 0, anoInicio: 2024,
      mesFim: 5, anoFim: 2024,
      recorrente: true,
    };
    expect(despesaAtivaNoPeriodo(despesa, 5, 2024)).toBe(true);
  });

  it('despesa não recorrente ativa apenas no mês de criação', () => {
    const despesa = { mesInicio: 3, anoInicio: 2024, recorrente: false };
    expect(despesaAtivaNoPeriodo(despesa, 3, 2024)).toBe(true);
    expect(despesaAtivaNoPeriodo(despesa, 4, 2024)).toBe(false);
  });

  it('despesa sem campo recorrente funciona como recorrente', () => {
    // Quando recorrente não é false, trata como ativa
    const despesa = { mesInicio: 0, anoInicio: 2024 };
    expect(despesaAtivaNoPeriodo(despesa, 11, 2025)).toBe(true);
  });
});

// ─── gerarGrupoId ─────────────────────────────────────────────
describe('gerarGrupoId', () => {
  it('retorna uma string não vazia', () => {
    const id = gerarGrupoId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('gera IDs únicos a cada chamada', () => {
    const id1 = gerarGrupoId();
    const id2 = gerarGrupoId();
    expect(id1).not.toBe(id2);
  });
});

// ─── Constantes ───────────────────────────────────────────────
describe('Constantes', () => {
  it('MESES tem 12 itens', () => {
    expect(MESES).toHaveLength(12);
    expect(MESES[0]).toBe('Janeiro');
    expect(MESES[11]).toBe('Dezembro');
  });

  it('CAIXINHAS_INFO contém as 7 caixinhas esperadas', () => {
    const chaves = Object.keys(CAIXINHAS_INFO);
    expect(chaves).toContain('emergencia');
    expect(chaves).toContain('manutencao');
    expect(chaves).toContain('empresa');
    expect(chaves).toContain('livre');
    expect(chaves).toContain('contas');
    expect(chaves).toContain('saldoRetidoApps');
    expect(chaves).toContain('saldoConta');
  });

  it('cada caixinha tem nome, emoji e cor', () => {
    Object.values(CAIXINHAS_INFO).forEach(caixinha => {
      expect(caixinha).toHaveProperty('nome');
      expect(caixinha).toHaveProperty('emoji');
      expect(caixinha).toHaveProperty('cor');
      expect(caixinha.nome.length).toBeGreaterThan(0);
    });
  });
});
