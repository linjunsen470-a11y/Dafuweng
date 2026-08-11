import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/GameEngine.js';
import { GameState } from '../src/game/GameState.js';

function createGame(profiles = [0, 1]) {
  const state = new GameState({ seed: 20260730 });
  state.setupGame(profiles.map((profileIndex, index) => ({
    profileIndex,
    name: `玩家${index + 1}`,
    isAI: index > 0,
    aiDifficulty: 'HARD'
  })), 20000);
  return { state, engine: new GameEngine(state) };
}

describe('GameEngine command contract', () => {
  it('keeps stock and event services isolated per game', () => {
    const first = createGame();
    const second = createGame();
    first.state.stockMarket.stocks[0].price = 999;
    first.state.eventManager.setRandomSource(() => 0);
    expect(second.state.stockMarket.stocks[0].price).not.toBe(999);
    expect(first.state.stockMarket).not.toBe(second.state.stockMarket);
    expect(first.state.eventManager).not.toBe(second.state.eventManager);
  });

  it('exposes legal actions and executes card effects through commands', () => {
    const { state, engine } = createGame();
    const player = state.players[0];
    expect(engine.getLegalActions(player.id).some(action => action.type === 'ROLL_DICE' && action.enabled)).toBe(true);
    const target = engine.getCardAction(player, 'OBSTACLE').targets[0];
    const result = engine.execute({
      type: 'USE_CARD',
      playerId: player.id,
      payload: { cardId: 'OBSTACLE', targetId: target.id }
    });
    expect(result.success).toBe(true);
    expect(state.propertyManager.getProperty(target.id).hasObstacle).toBe(true);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'OBSTACLE_CHANGED',
      tileId: target.id,
      active: true
    }));
  });

  it('rejects pre-roll actions from a player who does not own the current turn', () => {
    const { state, engine } = createGame();
    const inactive = state.players[1];
    const cardsBefore = [...inactive.cards];
    const cashBefore = inactive.cash;

    expect(engine.getLegalActions(inactive.id).filter(action => action.enabled)).toEqual([]);
    expect(engine.execute({
      type: 'USE_CARD',
      playerId: inactive.id,
      payload: { cardId: 'TURN_AROUND', targetId: state.players[0].id }
    }).success).toBe(false);
    expect(engine.execute({
      type: 'BUY_STOCK',
      playerId: inactive.id,
      payload: { stockId: 'TECH', shares: 1 }
    }).success).toBe(false);
    expect(engine.execute({
      type: 'BUY_CARD',
      playerId: inactive.id,
      payload: { cardId: 'CLEANSE' }
    }).success).toBe(false);
    expect(inactive.cards).toEqual(cardsBefore);
    expect(inactive.cash).toBe(cashBefore);
  });

  it('rejects landing commands outside the landing phase or for another tile', () => {
    const { state, engine } = createGame();
    const player = state.players[0];
    expect(engine.execute({
      type: 'PURCHASE_PROPERTY',
      playerId: player.id,
      payload: { tileId: 1 }
    }).success).toBe(false);

    player.currentTile = 1;
    state.phase = 'LANDING_ACTION';
    expect(engine.execute({
      type: 'PURCHASE_PROPERTY',
      playerId: player.id,
      payload: { tileId: 3 }
    }).success).toBe(false);
    expect(engine.execute({
      type: 'PURCHASE_PROPERTY',
      playerId: player.id,
      payload: { tileId: 1 }
    }).success).toBe(true);
  });

  it('liquidates stocks, buildings and property before declaring bankruptcy', () => {
    const { state } = createGame();
    const player = state.players[0];
    state.propertyManager.buyProperty(1, player.id);
    state.propertyManager.upgradeProperty(1);
    player.cash = -500;
    const settlement = state.checkBankrupt(player);
    expect(settlement.bankrupt).toBe(false);
    expect(player.cash).toBe(300);
    expect(state.propertyManager.getProperty(1)).toMatchObject({ owner: null, level: 0 });
    expect(settlement.liquidations.map(item => item.kind)).toEqual(['BUILDING', 'PROPERTY']);
  });

  it('enters debt settlement and pays only available assets on bankruptcy', () => {
    const { state, engine } = createGame();
    const [debtor, owner] = state.players;
    debtor.cash = 100;
    state.propertyManager.buyProperty(29, owner.id);
    debtor.currentTile = 29;
    state.phase = 'LANDING_ACTION';
    const ownerBefore = owner.cash;
    const result = engine.execute({
      type: 'SETTLE_RENT',
      playerId: debtor.id,
      payload: { tileId: 29 }
    });
    expect(result.amountDue).toBeGreaterThan(100);
    expect(result.type).toBe('DEBT_REQUIRED');
    expect(state.phase).toBe('DEBT_SETTLEMENT');
    const settled = engine.execute({ type: 'AUTO_SETTLE_DEBT', playerId: debtor.id });
    expect(settled.type).toBe('PLAYER_BANKRUPT');
    expect(owner.cash).toBe(ownerBefore + 100);
    expect(debtor.isBankrupt).toBe(true);
    expect(settled.events).toContainEqual(expect.objectContaining({ type: 'PLAYER_BANKRUPT' }));
  });

  it('implements character stock profit and premium-card discounts', () => {
    const stockGame = createGame([2, 0]);
    const trader = stockGame.state.players[0];
    trader.stocks.TECH = { shares: 10, avgPrice: 50 };
    const sold = stockGame.engine.execute({
      type: 'SELL_STOCK',
      playerId: trader.id,
      payload: { stockId: 'TECH', shares: 10 }
    });
    expect(sold.revenue).toBe(Math.round(stockGame.state.stockMarket.stocks[0].price * 10 * 1.15));

    const cardGame = createGame([3, 0]);
    const tycoon = cardGame.state.players[0];
    const bought = cardGame.engine.execute({
      type: 'BUY_CARD',
      playerId: tycoon.id,
      payload: { cardId: 'DEMOLISH' }
    });
    expect(bought).toMatchObject({ success: true, cost: 30 });
  });

  it('creates V8 snapshots while restoring legacy V1 snapshots', () => {
    const { state } = createGame();
    const snapshot = state.createSnapshot();
    expect(snapshot.version).toBe(8);
    const legacy = { ...snapshot, version: 1 };
    delete legacy.winnerId;
    delete legacy.winReason;
    const restored = new GameState({ seed: 1 });
    expect(() => restored.restoreSnapshot(legacy)).not.toThrow();
    expect(restored.players).toHaveLength(2);
  });

  it('restores an in-progress route choice without losing pending state', () => {
    const { state, engine } = createGame();
    state.setMap('island-fork');
    const player = state.players[0];
    player.currentTile = 7;
    state.phase = 'ROLLING';
    engine.execute({ type: 'BEGIN_MOVE', playerId: player.id, payload: { steps: 3 } });
    engine.execute({ type: 'ADVANCE_MOVE', playerId: player.id });

    const restored = new GameState({ seed: 1 });
    restored.restoreSnapshot(state.createSnapshot());
    expect(restored.phase).toBe('ROUTE_CHOICE');
    expect(restored.pendingMove).toMatchObject({ playerId: player.id, remainingSteps: 3 });
    expect(restored.getTile(10)).toBeTruthy();
  });

  it('moves authoritatively through route choices and start bonuses', () => {
    const { state, engine } = createGame();
    state.setMap('island-fork');
    const player = state.players[0];
    player.currentTile = 7;
    state.phase = 'ROLLING';
    expect(engine.execute({ type: 'BEGIN_MOVE', playerId: player.id, payload: { steps: 3 } }).success).toBe(true);
    const choice = engine.execute({ type: 'ADVANCE_MOVE', playerId: player.id });
    expect(choice).toMatchObject({ type: 'ROUTE_CHOICE_REQUIRED', options: [8, 10] });
    engine.execute({ type: 'ADVANCE_MOVE', playerId: player.id, payload: { nextTileId: 10 } });
    engine.execute({ type: 'ADVANCE_MOVE', playerId: player.id });
    const finished = engine.execute({ type: 'ADVANCE_MOVE', playerId: player.id });
    expect(player.currentTile).toBe(12);
    expect(finished.events).toContainEqual(expect.objectContaining({ type: 'MOVEMENT_FINISHED', tileId: 12 }));
    expect(state.pendingMove).toBeNull();
  });

  it('supports building sales, mortgages and debt payment', () => {
    const { state, engine } = createGame();
    const [debtor, owner] = state.players;
    state.propertyManager.buyProperty(27, debtor.id);
    state.propertyManager.upgradeProperty(27);
    debtor.cash = 100;
    state.propertyManager.buyProperty(29, owner.id);
    debtor.currentTile = 29;
    state.phase = 'LANDING_ACTION';
    engine.execute({ type: 'SETTLE_RENT', playerId: debtor.id, payload: { tileId: 29 } });
    expect(engine.execute({ type: 'SELL_BUILDING', playerId: debtor.id, payload: { tileId: 27 } }).success).toBe(true);
    const mortgage = engine.execute({ type: 'MORTGAGE_PROPERTY', playerId: debtor.id, payload: { tileId: 27 } });
    expect(mortgage.success).toBe(true);
    expect(state.propertyManager.getProperty(27).isMortgaged).toBe(true);
    expect(engine.execute({ type: 'PAY_DEBT', playerId: debtor.id }).success).toBe(true);
    expect(state.pendingDebt).toBeNull();
  });
});
