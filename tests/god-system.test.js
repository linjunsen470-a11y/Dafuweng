import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { AIPlayer } from '../src/game/AIPlayer.js';
import { GOD_RULES, attachGod, getGodDuration, tickGodAtTurnStart } from '../src/game/GodRules.js';

const configs = [
  { profileIndex: 0, name: '小满', isAI: false },
  { profileIndex: 1, name: '阿土伯', isAI: true }
];

function setup() {
  const state = new GameState({ seed: 4411 });
  state.setupGame(configs, 20000);
  return { state, engine: new GameEngine(state), player: state.players[0], other: state.players[1] };
}

describe('roaming god system', () => {
  it('defines all eight gods with distinct presentation and rules', () => {
    expect(Object.keys(GOD_RULES)).toHaveLength(8);
    Object.values(GOD_RULES).forEach(rule => expect(rule).toMatchObject({ name: expect.any(String), icon: expect.any(String), description: expect.any(String), turns: expect.any(Number) }));
  });

  it('attaches, replaces, and applies character-adjusted durations', () => {
    const { player } = setup();
    player.skillName = '甜心庇佑';
    expect(getGodDuration(player, 'MISFORTUNE')).toBe(3);
    expect(attachGod(player, 'MISFORTUNE')).toMatchObject({ previousGodType: null, duration: 3 });
    expect(attachGod(player, 'ANGEL', 4)).toMatchObject({ previousGodType: 'MISFORTUNE', duration: 4 });
  });

  it('resolves differentiated turn income, points, penalties, and departure', () => {
    const { player } = setup();
    attachGod(player, 'GREAT_FORTUNE', 1);
    expect(tickGodAtTurnStart(null, player)).toEqual([
      expect.objectContaining({ type: 'GOD_TURN_EFFECT', effect: 'CASH_GAIN', amount: 500 }),
      expect.objectContaining({ type: 'GOD_DEPARTED', godType: 'GREAT_FORTUNE' })
    ]);
    expect(player.cash).toBe(20500);
    expect(player.godType).toBeNull();

    attachGod(player, 'LUCK', 2);
    tickGodAtTurnStart(null, player);
    expect(player.cardPoints).toBe(145);
    attachGod(player, 'BAD', 2);
    expect(tickGodAtTurnStart(null, player)[0]).toMatchObject({ effect: 'CARD_POINTS_LOSS', amount: 20 });
  });

  it('amplifies chance income with fortune and waives rent with great fortune', () => {
    const { state, engine, player, other } = setup();
    player.godType = 'FORTUNE';
    state.eventManager.drawChanceCard = () => ({ title: '奖金', amount: 1000, isGain: true });
    state.setMap('city-loop');
    expect(engine.resolveSpecialLanding(player, 4)).toMatchObject({ type: 'CASH_GAINED', amount: 1500, amplifiedByGod: true });

    state.propertyManager.buyProperty(1, other.id);
    player.godType = 'GREAT_FORTUNE';
    expect(engine.settleRent(player, 1)).toMatchObject({ type: 'RENT_WAIVED', amount: 0 });
  });

  it('emits transfers when players brush past each other', () => {
    const { state, player, other } = setup();
    player.currentTile = other.currentTile = 3;
    attachGod(player, 'ANGEL', 4);
    expect(state.checkGodCollision(player)).toEqual([
      expect.objectContaining({ type: 'GOD_TRANSFERRED', fromPlayerId: player.id, toPlayerId: other.id, godType: 'ANGEL', duration: 4 })
    ]);
    expect(player.godType).toBeNull();
    expect(other.godType).toBe('ANGEL');
  });

  it('lets AI distinguish high-value and dangerous roaming gods', () => {
    const { player } = setup();
    expect(AIPlayer.scoreBoardGod(player, 'GREAT_FORTUNE')).toBeGreaterThan(AIPlayer.scoreBoardGod(player, 'ANGEL'));
    expect(AIPlayer.scoreBoardGod(player, 'MISFORTUNE')).toBeLessThan(0);
  });

  it('writes V11 while restoring a V9 roaming-god save', () => {
    const { state, player } = setup();
    attachGod(player, 'DEMON', 3);
    const legacy = state.createSnapshot();
    legacy.version = 9;
    const restored = new GameState({ seed: 1 });
    restored.restoreSnapshot(legacy);
    expect(restored.players[0]).toMatchObject({ godType: 'DEMON', godTurns: 3 });
    expect(restored.createSnapshot().version).toBe(11);
  });
});
