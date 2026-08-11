import { describe, expect, it } from 'vitest';
import { estimateStockSaleRevenue, getDebtPortfolio } from '../src/game/DebtRules.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { GameState } from '../src/game/GameState.js';

function setup() {
  const state = new GameState({ seed: 90210 });
  state.setupGame([
    { profileIndex: 4, name: '债务人', isAI: false },
    { profileIndex: 1, name: '债权人', isAI: true }
  ], 10000, { mapId: 'city-loop' });
  return { state, engine: new GameEngine(state), debtor: state.players[0], creditor: state.players[1] };
}

function enterDebt(state, debtor, creditor, amountDue) {
  debtor.cash = 100;
  state.pendingDebt = { debtorId: debtor.id, creditorId: creditor.id, amountDue, source: 'RENT:1' };
  state.phase = 'DEBT_SETTLEMENT';
}

describe('debt settlement rules', () => {
  it('calculates a complete liquidatable portfolio and solvency', () => {
    const { state, debtor, creditor } = setup();
    enterDebt(state, debtor, creditor, 3000);
    debtor.deposit = 400;
    state.stockMarket.stocks.find(stock => stock.id === 'TECH').price = 100;
    debtor.stocks.TECH = { shares: 5, avgPrice: 80 };
    state.propertyManager.buyProperty(1, debtor.id);
    state.propertyManager.upgradeProperty(1);
    state.propertyManager.upgradeProperty(1);

    const portfolio = getDebtPortfolio(state, debtor);
    expect(portfolio).toMatchObject({
      amountDue: 3000,
      gap: 2900,
      cash: 100,
      deposit: 400,
      stockValue: 500,
      propertyValue: 1100,
      liquidatableTotal: 2100,
      solvent: false,
      source: { label: '绿洲 1号过路费', creditorName: '债权人' }
    });
  });

  it('offers deposit withdrawal but never offers redemption during a debt crisis', () => {
    const { state, engine, debtor, creditor } = setup();
    enterDebt(state, debtor, creditor, 900);
    debtor.deposit = 500;
    state.propertyManager.buyProperty(1, debtor.id);
    const property = state.propertyManager.getProperty(1);
    property.isMortgaged = true;
    property.mortgageValue = 500;

    const actions = engine.getLegalActions(debtor.id);
    expect(actions).toContainEqual(expect.objectContaining({ type: 'LIQUIDATE_DEPOSIT', amount: 500 }));
    expect(actions.some(action => action.type === 'REDEEM_PROPERTY')).toBe(false);
    const withdrawn = engine.execute({ type: 'LIQUIDATE_DEPOSIT', playerId: debtor.id, payload: { amount: 500 } });
    expect(withdrawn).toMatchObject({ success: true, kind: 'DEPOSIT', value: 500 });
    expect([debtor.cash, debtor.deposit]).toEqual([600, 0]);
  });

  it('sells only the stock shares needed to cover the shortfall', () => {
    const { state, engine, debtor, creditor } = setup();
    enterDebt(state, debtor, creditor, 400);
    debtor.cash = 100;
    const stock = state.stockMarket.stocks.find(item => item.id === 'TECH');
    stock.price = 100;
    debtor.stocks.TECH = { shares: 10, avgPrice: 80 };

    const result = engine.execute({ type: 'AUTO_SETTLE_DEBT', playerId: debtor.id });
    expect(result).toMatchObject({ success: true, type: 'DEBT_PAID', amount: 400 });
    expect(debtor.stocks.TECH).toMatchObject({ shares: 7, avgPrice: 80 });
    expect(result.events).toContainEqual(expect.objectContaining({ kind: 'STOCK', shares: 3, value: 300 }));
  });

  it('uses only the required deposit and preserves all market assets', () => {
    const { state, engine, debtor, creditor } = setup();
    enterDebt(state, debtor, creditor, 300);
    debtor.deposit = 500;
    debtor.stocks.TECH = { shares: 4, avgPrice: 90 };
    const result = engine.execute({ type: 'AUTO_SETTLE_DEBT', playerId: debtor.id });

    expect(result.type).toBe('DEBT_PAID');
    expect(debtor.deposit).toBe(300);
    expect(debtor.stocks.TECH.shares).toBe(4);
  });

  it('clears non-property inventory when bankruptcy is declared', () => {
    const { state, engine, debtor, creditor } = setup();
    enterDebt(state, debtor, creditor, 50000);
    debtor.cards = ['REMOTE_DICE'];
    debtor.items = ['BARRIER'];
    debtor.cardPoints = 180;
    debtor.vehicle = 'CAR';
    const result = engine.execute({ type: 'DECLARE_BANKRUPTCY', playerId: debtor.id });

    expect(result.type).toBe('PLAYER_BANKRUPT');
    expect(debtor).toMatchObject({ cards: [], items: [], cardPoints: 0, vehicle: 'WALK', isBankrupt: true });
  });

  it('applies stock-sale character bonuses to debt estimates', () => {
    const { state, debtor } = setup();
    debtor.skillName = '股市高手';
    const stock = state.stockMarket.stocks.find(item => item.id === 'TECH');
    stock.price = 100;
    expect(estimateStockSaleRevenue(debtor, stock, 10)).toBe(1150);
  });
});
