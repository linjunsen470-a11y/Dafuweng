import { beforeEach, describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/GameEngine.js';
import { GameState } from '../src/game/GameState.js';

function createState(profileIndices = [0, 1, 2], options = {}) {
  const state = new GameState({ seed: 314159 });
  state.setupGame(profileIndices.map((profileIndex, index) => ({
    profileIndex,
    name: `玩家${index + 1}`,
    isAI: index > 0
  })), 20000, options);
  return { state, engine: new GameEngine(state) };
}

describe('phase one character talents', () => {
  it('applies commercial genius land and card discounts', () => {
    const { state, engine } = createState([0, 1]);
    const player = state.players[0];
    expect(engine.purchaseProperty(player, 1).cost).toBe(850);
    expect(engine.getCardCost(player, { id: 'REMOTE_DICE', cost: 45 })).toBe(38);
  });

  it('applies land guardian opening cash and rent premium', () => {
    const { state, engine } = createState([0, 1]);
    const [visitor, owner] = state.players;
    expect(owner.cash).toBe(23000);
    state.propertyManager.buyProperty(1, owner.id);
    const base = state.propertyManager.calculateToll(1, state.newsEffect, state.priceIndex);
    expect(engine.settleRent(visitor, 1).amount).toBe(Math.round(base * 1.2));
  });

  it('applies stock expert sale profit and rent immunity', () => {
    const { state, engine } = createState([2, 1]);
    const player = state.players[0];
    state.stockMarket.stocks.find(stock => stock.id === 'TECH').price = 100;
    player.stocks.TECH = { shares: 1, avgPrice: 100 };
    expect(state.stockMarket.sellStock(player, 'TECH', 1).revenue).toBe(115);
    state.propertyManager.buyProperty(1, state.players[1].id);
    state.rng.next = () => 0.1;
    expect(engine.settleRent(player, 1).type).toBe('RENT_WAIVED');
  });

  it('applies oil tycoon capital, strategic card discount, and longer summons', () => {
    const { state, engine } = createState([3, 1]);
    const player = state.players[0];
    expect(player).toMatchObject({ cash: 23000, cardPoints: 200 });
    expect(player.cards).toContain('LAND_BUY');
    expect(engine.getCardCost(player, { id: 'NUKES', cost: 120 })).toBe(60);
    player.cards = ['SUMMON_GOD'];
    expect(engine.useCard(player, 'SUMMON_GOD').success).toBe(true);
    expect(player.godTurns).toBe(5);
  });

  it('applies wind ninja doubled shop points and obstacle dodge', () => {
    const { state, engine } = createState([4, 1]);
    const player = state.players[0];
    expect(engine.resolveSpecialLanding(player, 2)).toMatchObject({ amount: 120 });
    state.propertyManager.getProperty(1).hasObstacle = true;
    state.rng.next = () => 0.1;
    engine.beginMove(player, 1);
    const moved = engine.advanceMove(player);
    expect(moved.events.some(event => event.type === 'OBSTACLE_DODGED')).toBe(true);
  });

  it('converts negative chance cards into rewards for nature blessing', () => {
    const { state, engine } = createState([5, 1]);
    const player = state.players[0];
    state.eventManager.drawChanceCard = () => ({ title: '罚款', amount: 1000, isGain: false });
    const before = player.cash;
    expect(engine.resolveSpecialLanding(player, 4)).toMatchObject({ type: 'CASH_GAINED', amount: 1000 });
    expect(player.cash).toBe(before + 1000);
  });

  it('applies cowboy and business prodigy opening bonuses', () => {
    const { state } = createState([6, 11]);
    expect(state.players[0].cash).toBe(22000);
    expect(state.players[1].cardPoints).toBe(200);
  });

  it('grants cowboy bonus movement from the deterministic game RNG', () => {
    const { state, engine } = createState([6, 1]);
    state.rng.int = () => 1;
    state.rng.next = () => 0.1;
    const roll = engine.rollDice(state.players[0]);
    expect(roll).toMatchObject({ dice: [1], steps: 3, bonusSteps: 2 });
  });

  it('gives baseball vitality extra shop points and a card discount', () => {
    const { state, engine } = createState([7, 1]);
    const player = state.players[0];
    const before = player.cardPoints;
    expect(engine.resolveSpecialLanding(player, 2)).toMatchObject({ type: 'CARD_POINTS', amount: 100 });
    expect(player.cardPoints).toBe(before + 100);
    expect(engine.getCardCost(player, { id: 'REMOTE_DICE', cost: 45 })).toBe(41);
  });

  it('halves negative durations for sweetheart protection', () => {
    const { state, engine } = createState([0, 9]);
    const [player, sweetheart] = state.players;
    player.cards = ['TURTLE'];
    expect(engine.useCard(player, 'TURTLE', sweetheart.id).success).toBe(true);
    expect(sweetheart.turtleTurns).toBe(2);
  });

  it('gives the swordmaster confinement evasion and stock profit bonus', () => {
    const { state, engine } = createState([10, 1]);
    const swordmaster = state.players[0];
    state.rng.next = () => 0.1;
    expect(engine.resolveSpecialLanding(swordmaster, 8).type).toBe('NEGATIVE_BLOCKED');
    expect(swordmaster.jailTurns).toBe(0);

    state.stockMarket.stocks.find(stock => stock.id === 'TECH').price = 100;
    swordmaster.stocks.TECH = { shares: 1, avgPrice: 100 };
    const sold = state.stockMarket.sellStock(swordmaster, 'TECH', 1);
    expect(sold.revenue).toBe(110);
  });

  it('applies the royal rent premium', () => {
    const { state, engine } = createState([0, 8]);
    const [visitor, owner] = state.players;
    state.propertyManager.buyProperty(1, owner.id);
    const base = state.propertyManager.calculateToll(1, state.newsEffect, state.priceIndex);
    expect(engine.settleRent(visitor, 1).amount).toBe(Math.round(base * 1.25));
  });

  it('discounts upgrades for the business prodigy', () => {
    const { state, engine } = createState([11, 1]);
    const player = state.players[0];
    state.propertyManager.buyProperty(1, player.id);
    const before = player.cash;
    const upgraded = engine.upgradeProperty(player, 1);
    expect(upgraded.cost).toBe(450);
    expect(player.cash).toBe(before - 450);
  });
});

describe('phase one card semantics', () => {
  let state;
  let engine;
  let player;
  let opponent;

  beforeEach(() => {
    ({ state, engine } = createState([0, 1, 2]));
    [player, opponent] = state.players;
  });

  it('hibernate skips turns instead of applying turtle movement', () => {
    player.cards = ['HIBERNATE'];
    expect(engine.useCard(player, 'HIBERNATE').success).toBe(true);
    expect(opponent.hibernateTurns).toBe(3);
    expect(opponent.turtleTurns).toBe(0);
    opponent.hibernateTurns = 1;
    state.players[2].hibernateTurns = 0;
    const transition = state.nextTurn();
    expect(transition.currentPlayer.id).toBe(2);
    expect(opponent.hibernateTurns).toBe(0);
  });

  it('sleepwalk creates automatic random movement and rent immunity state', () => {
    player.cards = ['SLEEPWALK'];
    expect(engine.useCard(player, 'SLEEPWALK', opponent.id).success).toBe(true);
    expect(opponent.sleepwalkTurns).toBe(3);
    state.nextTurn();
    expect(opponent.isSleepwalkingThisTurn).toBe(true);
    expect(opponent.rentShieldActiveThisTurn).toBe(true);
  });

  it('transfer card redirects the next cash penalty and is consumed once', () => {
    player.cards = ['TRANSFER_CARD'];
    expect(engine.useCard(player, 'TRANSFER_CARD', opponent.id).success).toBe(true);
    state.eventManager.drawChanceCard = () => ({ title: '测试罚款', amount: 1000, isGain: false });
    const playerCash = player.cash;
    const opponentCash = opponent.cash;
    engine.resolveSpecialLanding(player, 4);
    expect(player.cash).toBe(playerCash);
    expect(opponent.cash).toBe(opponentCash - 1000);
    expect(player.penaltyTransferTargetId).toBeNull();
  });

  it('uses graph distance for missile blast ranges on forked maps', () => {
    ({ state, engine } = createState([0, 1], { mapId: 'island-fork' }));
    player = state.players[0];
    player.cards = ['MISSILE'];
    state.propertyManager.getProperty(8).level = 2;
    state.propertyManager.getProperty(10).level = 2;
    expect(engine.useCard(player, 'MISSILE', 7).success).toBe(true);
    expect(state.propertyManager.getProperty(8).level).toBe(1);
    expect(state.propertyManager.getProperty(10).level).toBe(1);
  });
});
