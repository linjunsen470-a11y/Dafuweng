import { beforeEach, describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/GameEngine.js';
import { GameState } from '../src/game/GameState.js';

describe('GameEngine landing commands', () => {
  let state;
  let engine;
  let buyer;
  let owner;

  beforeEach(() => {
    state = new GameState({ seed: 2468 });
    state.setupGame([
      { profileIndex: 0, name: '买家', isAI: false },
      { profileIndex: 1, name: '地主', isAI: true }
    ], 20000);
    engine = new GameEngine(state);
    [buyer, owner] = state.players;
  });

  it('inspects and purchases an empty property with character discount', () => {
    expect(engine.inspectLanding(buyer, 1).kind).toBe('PURCHASE');
    const result = engine.purchaseProperty(buyer, 1);
    expect(result).toMatchObject({ success: true, level: 0, cost: 850 });
    expect(state.propertyManager.getProperty(1).owner).toBe(buyer.id);
    expect(buyer.cash).toBe(19150);
  });

  it('rejects invalid purchases without mutating cash', () => {
    state.propertyManager.buyProperty(1, owner.id);
    const cash = buyer.cash;
    expect(engine.purchaseProperty(buyer, 1).success).toBe(false);
    expect(buyer.cash).toBe(cash);
  });

  it('settles rent between players and reports the amount', () => {
    state.propertyManager.buyProperty(1, owner.id);
    const before = buyer.cash;
    const result = engine.settleRent(buyer, 1);
    expect(result.type).toBe('RENT_PAID');
    expect(result.amount).toBeGreaterThan(0);
    expect(buyer.cash).toBe(before - result.amount);
  });

  it('applies bank and spirit tiles through the same special resolver', () => {
    const bank = engine.resolveSpecialLanding(buyer, 12);
    expect(bank).toMatchObject({ type: 'CASH_GAINED', amount: 2000 });
    const spirit = engine.resolveSpecialLanding(buyer, 18);
    expect(spirit).toMatchObject({ type: 'STATUS_APPLIED', status: 'MISFORTUNE' });
    expect(buyer.godTurns).toBe(3);
  });
});
