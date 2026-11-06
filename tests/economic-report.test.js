import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { createEconomicCycleReport, getEconomicReportHeadline } from '../src/game/EconomicReportRules.js';

function createReportState() {
  return {
    priceIndex: 1.2,
    players: [
      { id: 0, name: '小满', color: '#f00', cash: 11200, deposit: 5250, cardPoints: 140, isBankrupt: false },
      { id: 1, name: '阿土伯', color: '#fa0', cash: 9300, deposit: 2100, cardPoints: 80, isBankrupt: false }
    ],
    companyManager: {
      get: id => ({ id, name: id === 'A' ? '星河百货' : '蓝港保险', icon: id === 'A' ? '🏬' : '🛟' })
    },
    stockMarket: {
      stocks: [
        { id: 'TECH', name: '星河智造', code: '600001', price: 110, change: 10, history: [95, 100, 110] },
        { id: 'REALTY', name: '云庭置业', code: '600002', price: 230, change: -4, history: [250, 240, 230] }
      ]
    }
  };
}

describe('economic cycle report', () => {
  it('aggregates interest, dividends and player cycle gains', () => {
    const report = createEconomicCycleReport({
      state: createReportState(), period: 2, round: 10,
      before: [
        { playerId: 0, cash: 10000, deposit: 5000, cardPoints: 100 },
        { playerId: 1, cash: 9000, deposit: 2000, cardPoints: 80 }
      ],
      lottery: { number: 7, winnerIds: [0], winnerNames: ['小满'], prize: 1000, potBefore: 3000, potAfter: 2000, rollover: false },
      interestPayments: [{ playerId: 0, amount: 250 }, { playerId: 1, amount: 100 }],
      settlements: [
        { companyId: 'A', operation: 500, dividendPool: 300, treasury: 2200, payments: [{ playerId: 0, amount: 200 }, { playerId: 1, amount: 100 }], policyId: 'DIVIDEND' }
      ],
      modeEvents: []
    });
    expect(report.id).toBe('cycle-2-round-10');
    expect(report.players[0]).toMatchObject({ playerId: 0, interest: 250, dividend: 200, cycleGain: 1450, pointsDelta: 40 });
    expect(report.totals).toEqual({ interest: 350, dividends: 300, playerGain: 1850 });
    expect(report.companies[0]).toMatchObject({ name: '星河百货', dividendPool: 300 });
    expect(report.stocks.map(stock => stock.id)).toEqual(['TECH', 'REALTY']);
    expect(getEconomicReportHeadline(report).title).toContain('小满');
  });

  it('stores a complete report when a real economic cycle settles', () => {
    const state = new GameState({ seed: 24680 });
    state.setupGame([
      { name: '小满', profileIndex: 0, isAI: false },
      { name: '阿土伯', profileIndex: 1, isAI: true }
    ], 20000, { initialDeposit: 5000 });
    state.round = state.economicCycle.roundsPerPeriod;
    state.lottery.tickets.push({ playerId: 0, number: 1 });
    state.onRoundEnd();
    const event = state.pendingDomainEvents.find(entry => entry.type === 'ECONOMIC_CYCLE_ENDED');
    expect(event?.report).toBe(state.economicCycle.lastReport);
    expect(event?.report.players).toHaveLength(2);
    expect(event?.report.companies).toHaveLength(6);
    expect(event?.report.stocks).toHaveLength(6);
    expect(event?.report.lottery.number).toBeGreaterThanOrEqual(1);
    expect(event?.report.totals.interest).toBe(500);
  });

  it('preserves the last report through snapshot restore', () => {
    const state = new GameState({ seed: 99 });
    state.setupGame([
      { name: '小满', profileIndex: 0, isAI: false },
      { name: '阿土伯', profileIndex: 1, isAI: true }
    ], 20000, { initialDeposit: 5000 });
    state.round = state.economicCycle.roundsPerPeriod;
    state.onRoundEnd();
    const restored = new GameState({ seed: 1 });
    restored.restoreSnapshot(state.createSnapshot());
    expect(restored.economicCycle.lastReport).toEqual(state.economicCycle.lastReport);
  });
});
