import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { COMPANY_POLICIES, chooseAICompanyPolicy } from '../src/game/CompanyRules.js';
import { getPropertyPortfolio } from '../src/game/PropertyRules.js';

function setup(mapId = 'city-loop') {
  const state = new GameState({ seed: 4409 });
  state.setupGame([0, 1].map((profileIndex, index) => ({ profileIndex, name: `董事玩家 ${index + 1}`,
    isAI: index === 1, aiDifficulty: 'HARD', aiStrategy: index ? 'CARD' : 'ECONOMY' })), 30000, { mapId });
  return { state, engine: new GameEngine(state), player: state.players[0], rival: state.players[1] };
}

function chair(state, player, companyId) {
  const company = state.companyManager.get(companyId);
  player.stocks[company.stockId] = { shares: 60, avgPrice: 100 };
  state.companyManager.updateChairmen(state.players);
  return company;
}

describe('company board and chairman perks', () => {
  it('lets only the chairman fund one policy per cycle from company treasury', () => {
    const { state, engine, player, rival } = setup();
    const company = chair(state, player, 'AURORA_RETAIL');
    company.treasury = 1800;
    expect(engine.execute({ type: 'SET_COMPANY_POLICY', playerId: rival.id, payload: { companyId: company.id, policyId: 'DIVIDEND' } }).success).toBe(false);
    const selected = engine.execute({ type: 'SET_COMPANY_POLICY', playerId: player.id, payload: { companyId: company.id, policyId: 'DIVIDEND' } });
    expect(selected).toMatchObject({ success: true, type: 'COMPANY_POLICY_SET', cost: 500, treasury: 1300 });
    expect(company).toMatchObject({ policyId: 'DIVIDEND', policyStartedRound: 1 });
    expect(engine.execute({ type: 'SET_COMPANY_POLICY', playerId: player.id, payload: { companyId: company.id, policyId: 'EXPANSION' } }).reason)
      .toBe('公司本周期已有经营政策');
  });

  it('changes settlement economics, records policy history, and clears the cycle policy', () => {
    const { state, player } = setup();
    const company = chair(state, player, 'AURORA_RETAIL');
    company.treasury = 2000;
    company.periodRevenue = 1000;
    state.companyManager.startPolicy(company.id, player.id, 'DIVIDEND', 3);
    const cashBefore = player.cash;
    const result = state.companyManager.settle(state.players, { int: () => 0 }).find(entry => entry.companyId === company.id);
    expect(result).toMatchObject({ policyId: 'DIVIDEND', operation: 0, dividendPool: 850 });
    expect(player.cash).toBe(cashBefore + 850);
    expect(company.policyId).toBeNull();
    expect(company.policyHistory.at(-1)).toMatchObject({ policyId: 'DIVIDEND', round: 3, dividendPool: 850 });
  });

  it('awards innovation points and makes reserve policy cap operating loss', () => {
    const { state, player } = setup();
    const tech = chair(state, player, 'CLOUD_COMPUTE');
    tech.treasury = 2000;
    const pointsBefore = player.cardPoints;
    state.companyManager.startPolicy(tech.id, player.id, 'INNOVATION', 2);
    const innovation = state.companyManager.settle(state.players, { int: () => 0 }).find(entry => entry.companyId === tech.id);
    expect(innovation).toMatchObject({ policyId: 'INNOVATION', operation: 300 });
    expect(player.cardPoints).toBe(pointsBefore + 80);

    const reserve = chair(state, player, 'HARBOR_INSURANCE');
    reserve.treasury = 1000;
    state.companyManager.startPolicy(reserve.id, player.id, 'RESERVE', 6);
    expect(state.companyManager.settle(state.players, { int: () => -350 }).find(entry => entry.companyId === reserve.id))
      .toMatchObject({ policyId: 'RESERVE', operation: -50 });
  });

  it('applies retail, insurance, transit, construction, technology, and material perks', () => {
    const { state, engine, player, rival } = setup('fortune-crossroads');
    player.skillName = '无';
    ['AURORA_RETAIL', 'HARBOR_INSURANCE', 'SKY_TRANSIT', 'NOVA_BUILD', 'CLOUD_COMPUTE', 'SUMMIT_MATERIAL']
      .forEach(companyId => chair(state, player, companyId));

    const remoteDice = { id: 'REMOTE_DICE', cost: 45 };
    expect(engine.getCardCost(player, remoteDice)).toBeLessThan(remoteDice.cost);
    expect(engine.getItemCost(player, state.inventoryManager.getDefinition('MOTOR'))).toBe(68);

    state.rng.int = () => 1;
    expect(engine.rollDice(player)).toMatchObject({ steps: 2, bonusSteps: 1 });
    state.phase = 'PRE_ROLL_ACTION';

    state.propertyManager.buyProperty(18, player.id, 'LAB');
    state.propertyManager.getProperty(18).level = 1;
    expect(engine.startResearch(player, 18, 'TIME_MACHINE')).toMatchObject({ success: true, task: { roundsRemaining: 1 } });

    state.propertyManager.buyProperty(1, player.id);
    state.propertyManager.upgradeProperty(1);
    const cashBeforeSale = player.cash;
    const recovered = Math.round(state.getTile(1).buildCost * 0.65);
    expect(getPropertyPortfolio(state, player.id).find(entry => entry.tileId === 1).liquidationValue).toBe(recovered);
    expect(engine.sellBuilding(player, 1)).toMatchObject({ success: true, value: recovered });
    expect(player.cash).toBe(cashBeforeSale + recovered);

    state.propertyManager.buyProperty(3, rival.id);
    const fullRent = state.propertyManager.calculateToll(3, null, 1, player);
    player.cash = 30000;
    expect(engine.settleRent(player, 3)).toMatchObject({ success: true, amount: Math.round(fullRent * 0.8) });

    const purchaseTile = state.mapDefinition.tiles.find(tile => tile.type === 'PROPERTY'
      && state.propertyManager.getProperty(tile.id).owner === null);
    const purchaseCash = player.cash;
    const discountedPrice = Math.round(purchaseTile.price * 0.85);
    expect(engine.purchaseProperty(player, purchaseTile.id)).toMatchObject({ success: true, cost: discountedPrice });
    expect(player.cash).toBe(purchaseCash - discountedPrice);
  });

  it('lets AI choose an affordable strategy-aligned board policy', () => {
    const { state, rival } = setup();
    const company = chair(state, rival, 'CLOUD_COMPUTE');
    company.treasury = 900;
    expect(chooseAICompanyPolicy(rival, state)).toEqual({ companyId: company.id, policyId: 'INNOVATION' });
    company.treasury = 400;
    expect(chooseAICompanyPolicy(rival, state)).toEqual({ companyId: company.id, policyId: 'RESERVE' });
    expect(COMPANY_POLICIES).toHaveLength(4);
  });

  it('migrates V8 company records with policy defaults into V9', () => {
    const { state } = setup();
    const legacy = state.createSnapshot();
    legacy.version = 8;
    legacy.companies = legacy.companies.map(({ policyId, policyStartedRound, policyHistory, ...company }) => company);
    const restored = new GameState({ seed: 1 });
    restored.restoreSnapshot(legacy);
    expect(restored.companyManager.companies.every(company => company.policyId === null && company.policyHistory.length === 0)).toBe(true);
    expect(restored.createSnapshot().version).toBe(9);
  });
});
