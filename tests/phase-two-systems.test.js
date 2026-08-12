import { describe, expect, it } from 'vitest';
import { AIPlayer } from '../src/game/AIPlayer.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { GameState } from '../src/game/GameState.js';
import { GRAND_BAY_MAP } from '../src/game/MapData.js';

function setup(options = {}, profiles = [0, 1, 2, 3]) {
  const state = new GameState({ seed: 98765, maxRounds: 40 });
  state.setupGame(profiles.map((profileIndex, index) => ({
    profileIndex,
    name: `P${index + 1}`,
    isAI: index > 0,
    aiDifficulty: 'HARD'
  })), 20000, options);
  return { state, engine: new GameEngine(state) };
}

describe('phase two economy and facilities', () => {
  it('moves money between cash and deposits and includes deposits in net worth', () => {
    const { state, engine } = setup({ initialDeposit: 5000 });
    const player = state.players[0];
    expect(engine.bankTransfer(player, 'DEPOSIT', 4000)).toMatchObject({ success: true, cash: 16000, deposit: 9000 });
    expect(engine.bankTransfer(player, 'WITHDRAW', 2000)).toMatchObject({ success: true, cash: 18000, deposit: 7000 });
    expect(state.calculateAssetBreakdown(player)).toMatchObject({ cash: 18000, deposit: 7000, total: 25000 });
  });

  it('pays five-round deposit interest', () => {
    const { state } = setup({ initialDeposit: 10000 });
    state.round = 5;
    state.onRoundEnd();
    expect(state.players[0].deposit).toBe(10500);
  });

  it('provides four purchasable chain-store large properties', () => {
    const { state, engine } = setup({ mapId: 'grand-bay' });
    const bigTiles = GRAND_BAY_MAP.tiles.filter(tile => tile.type === 'BIG_PROPERTY');
    expect(bigTiles).toHaveLength(4);
    const tile = bigTiles[0];
    const player = state.players[0];
    expect(AIPlayer.evaluateLandPurchase(player, tile, state)).toBe(true);
    expect(engine.purchaseProperty(player, tile.id)).toMatchObject({ success: true, tileId: tile.id });
  });

  it('sells lottery tickets and pays the accumulated pot to matching tickets', () => {
    const { state, engine } = setup();
    const player = state.players[0];
    const before = player.cash;
    expect(engine.buyLottery(player, 7).success).toBe(true);
    state.rng.int = () => 7;
    state.drawLottery();
    expect(player.cash).toBe(before - 200 + 2200);
    expect(state.lottery.pot).toBe(2000);
  });

  it('casts selectable magic-house global effects', () => {
    const { state, engine } = setup();
    const before = state.players.map(player => player.cash);
    expect(engine.castMagic(state.players[0], 'CASH_RAIN').success).toBe(true);
    expect(state.players.map(player => player.cash)).toEqual(before.map(cash => cash + 800));
  });
});

describe('phase two gods, mechanisms, and modes', () => {
  it('moves board gods and attaches a colliding NPC god to a player', () => {
    const { state } = setup({ mapId: 'grand-bay' });
    const player = state.players[0];
    state.boardGods[0].tileId = 1;
    player.currentTile = 1;
    const god = state.checkBoardGodCollision(player);
    expect(god.type).toBe('FORTUNE');
    expect(player).toMatchObject({ godType: 'FORTUNE', godTurns: 5 });
    expect(god.tileId).not.toBe(1);
  });

  it('toggles all branch routes through a map mechanism', () => {
    const { state, engine } = setup({ mapId: 'grand-bay' });
    expect(state.mapRuntime.getNextOptions(12)).toHaveLength(2);
    expect(engine.triggerMapMechanism(state.players[0])).toMatchObject({ type: 'MECHANISM_TRIGGERED', activeRoute: 1 });
    expect(state.mapRuntime.getNextOptions(12)).toEqual([84]);
  });

  it('lets teammates upgrade each other properties and wins by team', () => {
    const { state, engine } = setup({ mode: 'TEAM', teams: true });
    state.propertyManager.buyProperty(1, state.players[0].id);
    expect(engine.inspectLanding(state.players[2], 1).kind).toBe('UPGRADE');
    expect(engine.upgradeProperty(state.players[2], 1).success).toBe(true);
    state.players[1].isBankrupt = true;
    state.players[3].isBankrupt = true;
    expect(state.checkWinCondition()).toBe(true);
    expect(state.winningTeamId).toBe(0);
  });

  it('creates a buffed lord and resolves challenger victory', () => {
    const { state } = setup({ mode: 'CHALLENGE' });
    const lord = state.players.at(-1);
    expect(lord).toMatchObject({ isLord: true, isAI: true, teamId: 'LORD' });
    expect(lord.cash).toBeGreaterThan(20000);
    lord.isBankrupt = true;
    expect(state.checkWinCondition()).toBe(true);
    expect(state.winReason).toBe('LORD_DEFEATED');
  });

  it('replaces land investment with attack supplies and cash damage in heat mode', () => {
    const { state, engine } = setup({ mode: 'HEAT', mapId: 'city-loop' }, [0, 1]);
    const [attacker, target] = state.players;
    expect(engine.inspectLanding(attacker, 1).kind).toBe('SPECIAL');
    expect(engine.resolveSpecialLanding(attacker, 1).type).toBe('HEAT_SUPPLY');
    attacker.cards = ['MISSILE'];
    attacker.currentTile = 1;
    target.currentTile = 1;
    const before = target.cash;
    expect(engine.useCard(attacker, 'MISSILE', 1).success).toBe(true);
    expect(target.cash).toBe(before - 1800);
  });
});
