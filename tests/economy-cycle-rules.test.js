import { describe, expect, it } from 'vitest';
import { calculatePriceIndex, daysUntilSettlement, formatGameDate } from '../src/game/EconomyCycleRules.js';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';

describe('game calendar and inflation', () => {
  it.each([['STANDARD', 10], ['QUICK', 5]])('holds prices between steps and caps them in %s', (mode, days) => {
    for (const [step, price] of [1, 1.5, 2.2, 3.2, 4.5, 6].entries()) {
      expect(calculatePriceIndex(1 + step * days, mode)).toBe(price);
      expect(calculatePriceIndex((step + 1) * days, mode)).toBe(price);
    }
    expect(calculatePriceIndex(120, mode)).toBe(6);
  });

  it('advances one calendar day per table rotation, including month and year boundaries', () => {
    const state = new GameState({ seed: 1 });
    state.setupGame([{ profileIndex: 5 }, { profileIndex: 1 }]);
    state.round = 31;
    state.nextTurn();
    expect(formatGameDate(state.round)).toBe('2026-01-31');
    state.nextTurn();
    expect(formatGameDate(state.round)).toBe('2026-02-01');
    expect(formatGameDate(366)).toBe('2027-01-01');
  });

  it.each([['STANDARD', 5], ['QUICK', 4]])('counts down to the actual %s settlement', (mode, period) => {
    const state = new GameState({ seed: 2 });
    state.setupGame([{ profileIndex: 5 }, { profileIndex: 1 }], undefined, { mode });
    state.round = period - 1;
    expect(daysUntilSettlement(state.round, period)).toBe(1);
    state.nextTurn();
    state.nextTurn();
    expect(state.economicCycle.lastSettlementRound).toBe(period);
    expect(daysUntilSettlement(state.round, period)).toBe(period);
  });

  it('charges the quoted prices and inflates rent faster than purchase and construction', () => {
    const state = new GameState({ seed: 7 });
    state.setupGame([{ profileIndex: 5 }, { profileIndex: 1 }], 50000);
    const engine = new GameEngine(state);
    const [owner, visitor] = state.players;
    const buy = engine.getPropertyActionCost(owner, 1, 'BUY');
    const build = engine.getPropertyActionCost(owner, 1, 'UPGRADE');
    state.round = 31;
    expect(state.priceIndex).toBe(3.2);
    expect(engine.purchaseProperty(owner, 1).cost).toBe(Math.round(buy * 1.55));
    expect(engine.upgradeProperty(owner, 1).cost).toBe(Math.round(build * 1.55));
    expect(owner.cash).toBe(50000 - Math.round(buy * 1.55) - Math.round(build * 1.55));
    const rent = Math.floor(state.getTile(1).tolls[1] * 3.2);
    expect(engine.settleRent(visitor, 1)).toMatchObject({ amount: rent });
  });
});
