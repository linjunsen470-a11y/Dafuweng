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

  it('upgrades owned property through level four and then reports max level', () => {
    state.propertyManager.buyProperty(1, buyer.id);
    for (let expectedLevel = 1; expectedLevel <= 4; expectedLevel++) {
      const result = engine.upgradeProperty(buyer, 1);
      expect(result).toMatchObject({ success: true, level: expectedLevel });
    }
    expect(engine.inspectLanding(buyer, 1).kind).toBe('OWN_MAX');
    expect(engine.upgradeProperty(buyer, 1).success).toBe(false);
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
    const bank = engine.resolveSpecialLanding(buyer, 24);
    expect(bank).toMatchObject({ type: 'OPEN_BANK', cash: 20000, deposit: 0 });
    const spirit = engine.resolveSpecialLanding(buyer, 26);
    expect(spirit).toMatchObject({ type: 'STATUS_APPLIED', status: 'BAD' });
    expect(buyer.godTurns).toBe(3);
  });

  it('resolves coupon, fortune-star, and monster landmarks on the crossroads map', () => {
    state.setupGame([
      { profileIndex: 0, name: '买家', isAI: false },
      { profileIndex: 1, name: '地主', isAI: true }
    ], 20000, { mapId: 'fortune-crossroads' });
    engine = new GameEngine(state);
    [buyer, owner] = state.players;

    const pointsBefore = buyer.cardPoints;
    expect(engine.resolveSpecialLanding(buyer, 15)).toMatchObject({ type: 'COUPON_COLLECTED', amount: 30 });
    expect(buyer.cardPoints).toBe(pointsBefore + 30);

    const cardsBefore = buyer.cards.length;
    expect(engine.resolveSpecialLanding(buyer, 6)).toMatchObject({ type: 'STATUS_APPLIED', status: 'LUCK' });
    expect(buyer.cards).toHaveLength(cardsBefore + 1);

    state.propertyManager.buyProperty(1, owner.id);
    state.propertyManager.upgradeProperty(1);
    state.propertyManager.upgradeProperty(1);
    const monster = engine.resolveSpecialLanding(buyer, 5);
    expect(monster).toMatchObject({ type: 'MONSTER_ATTACK', targetTileId: 1, previousLevel: 2 });
    expect(state.propertyManager.getProperty(1).level).toBe(0);
    expect(state.propertyManager.getProperty(1).owner).toBe(owner.id);
  });
});
