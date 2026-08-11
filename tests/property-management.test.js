import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { chooseAIPropertyManagement, getDistrictPortfolio, getPropertyPortfolio } from '../src/game/PropertyRules.js';

function setup(mapId = 'city-loop') {
  const state = new GameState({ seed: 9104 });
  state.setupGame([0, 1].map((profileIndex, index) => ({ profileIndex, name: `地产玩家 ${index + 1}`,
    isAI: index === 1, aiDifficulty: 'HARD', aiStrategy: index ? 'PROPERTY' : 'ECONOMY' })), 30000, { mapId });
  return { state, engine: new GameEngine(state), player: state.players[0], ai: state.players[1] };
}

describe('property management center', () => {
  it('supports voluntary building sales, mortgages, and redemption before rolling', () => {
    const { state, engine, player } = setup();
    state.propertyManager.buyProperty(1, player.id);
    state.propertyManager.upgradeProperty(1);
    const cashBeforeSale = player.cash;
    expect(engine.execute({ type: 'SELL_BUILDING', playerId: player.id, payload: { tileId: 1 } }))
      .toMatchObject({ success: true, kind: 'BUILDING', level: 0, value: 300 });
    expect(player.cash).toBe(cashBeforeSale + 300);
    expect(engine.execute({ type: 'MORTGAGE_PROPERTY', playerId: player.id, payload: { tileId: 1 } }))
      .toMatchObject({ success: true, value: 500 });
    expect(state.propertyManager.calculateToll(1)).toBe(0);
    const cashBeforeRedeem = player.cash;
    expect(engine.execute({ type: 'REDEEM_PROPERTY', playerId: player.id, payload: { tileId: 1 } }))
      .toMatchObject({ success: true, cost: 550 });
    expect(player.cash).toBe(cashBeforeRedeem - 550);
    expect(state.propertyManager.calculateToll(1)).toBeGreaterThan(0);
  });

  it('converts residential lots into chain stores and applies network rent', () => {
    const { state, engine, player } = setup();
    [1, 3].forEach(tileId => state.propertyManager.buyProperty(tileId, player.id));
    const base = state.propertyManager.calculateToll(1);
    const cashBefore = player.cash;
    expect(engine.execute({ type: 'CHOOSE_BUILDING_TYPE', playerId: player.id, payload: { tileId: 1, buildingType: 'CHAIN_STORE' } }))
      .toMatchObject({ success: true, buildingType: 'CHAIN_STORE', cost: 150 });
    expect(engine.execute({ type: 'CHOOSE_BUILDING_TYPE', playerId: player.id, payload: { tileId: 3, buildingType: 'CHAIN_STORE' } }).success).toBe(true);
    expect(player.cash).toBe(cashBefore - 150 - 175);
    expect(state.propertyManager.calculateToll(1)).toBe(Math.floor(base * 1.25));
  });

  it('locks listed and researching property while preserving failed conversion state', () => {
    const { state, engine, player } = setup('fortune-crossroads');
    state.propertyManager.buyProperty(18, player.id, 'MALL');
    state.propertyManager.getProperty(18).level = 4;
    const reference = state.getTile(18).price + state.getTile(18).buildCost * 4;
    const offer = engine.createMarketOffer(player, { kind: 'PROPERTY', contentId: 18, price: reference });
    expect(offer.success).toBe(true);
    expect(engine.execute({ type: 'CHOOSE_BUILDING_TYPE', playerId: player.id, payload: { tileId: 18, buildingType: 'PARK' } }).reason)
      .toBe('地产挂牌中，请先撤销挂牌');
    engine.cancelMarketOffer(player, offer.offer.id);
    player.cash = 0;
    expect(engine.execute({ type: 'CHOOSE_BUILDING_TYPE', playerId: player.id, payload: { tileId: 18, buildingType: 'PARK' } }))
      .toMatchObject({ success: false, reason: '现金不足' });
    expect(state.propertyManager.getProperty(18)).toMatchObject({ buildingType: 'MALL', level: 4 });
  });

  it('summarizes portfolio value and district monopoly progress', () => {
    const { state, player } = setup();
    [1, 3, 5].forEach(tileId => state.propertyManager.buyProperty(tileId, player.id));
    const portfolio = getPropertyPortfolio(state, player.id);
    expect(portfolio).toHaveLength(3);
    expect(portfolio.every(entry => entry.monopoly)).toBe(true);
    expect(portfolio.reduce((sum, entry) => sum + entry.value, 0)).toBe(3600);
    expect(getDistrictPortfolio(state, player.id).find(group => group.groupId === 'GREEN'))
      .toMatchObject({ owned: 3, total: 3, complete: true, contested: false });
  });

  it('lets AI redeem assets, build a chain network, and raise emergency liquidity', () => {
    const { state, ai } = setup();
    state.currentPlayerIndex = ai.id;
    [1, 3, 5].forEach(tileId => state.propertyManager.buyProperty(tileId, ai.id));
    const property = state.propertyManager.getProperty(1);
    property.isMortgaged = true;
    property.mortgageValue = 500;
    expect(chooseAIPropertyManagement(ai, state)).toEqual({ type: 'REDEEM_PROPERTY', tileId: 1 });
    property.isMortgaged = false;
    property.mortgageValue = 0;
    expect(chooseAIPropertyManagement(ai, state)).toEqual({ type: 'CHOOSE_BUILDING_TYPE', tileId: 1, buildingType: 'CHAIN_STORE' });
    ai.cash = 1000;
    expect(chooseAIPropertyManagement(ai, state)).toEqual({ type: 'MORTGAGE_PROPERTY', tileId: 5 });
  });

  it('rejects voluntary management outside the pre-roll phase', () => {
    const { state, engine, player } = setup();
    state.propertyManager.buyProperty(1, player.id);
    state.phase = 'MOVING';
    expect(engine.execute({ type: 'MORTGAGE_PROPERTY', playerId: player.id, payload: { tileId: 1 } }))
      .toMatchObject({ success: false, reason: '只能在掷骰前经营地产' });
  });

  it('does not charge cash when a commercial building choice is invalid', () => {
    const { state, engine, player } = setup('fortune-crossroads');
    player.currentTile = 18;
    state.phase = 'LANDING_ACTION';
    const cashBefore = player.cash;
    expect(engine.execute({ type: 'PURCHASE_PROPERTY', playerId: player.id, payload: { tileId: 18, buildingType: 'INVALID' } }))
      .toMatchObject({ success: false, reason: '商业建筑类型无效' });
    expect(player.cash).toBe(cashBefore);
    expect(state.propertyManager.getProperty(18).owner).toBeNull();
  });

  it('cancels a debtor market listing before financial settlement begins', () => {
    const { state, engine, player, ai } = setup();
    player.cards = ['REMOTE_DICE'];
    expect(engine.createMarketOffer(player, { kind: 'CARD', contentId: 'REMOTE_DICE', price: 900 }).success).toBe(true);
    state.propertyManager.buyProperty(19, ai.id);
    state.propertyManager.getProperty(19).level = 4;
    player.cash = 0;
    expect(engine.settleRent(player, 19)).toMatchObject({ success: true, type: 'DEBT_REQUIRED' });
    expect(state.marketOffers).toHaveLength(0);
    expect(state.marketHistory.at(-1)).toMatchObject({ type: 'CANCELLED', reason: 'DEBT_SETTLEMENT' });
  });
});
