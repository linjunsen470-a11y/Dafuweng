import { beforeEach, describe, expect, it } from 'vitest';
import { GamePhase, GameState } from '../src/game/GameState.js';

const configs = [
  { profileIndex: 0, name: '甲', isAI: false },
  { profileIndex: 1, name: '乙', isAI: true }
];

describe('GameState rules', () => {
  let state;

  beforeEach(() => {
    state = new GameState({ seed: 1234, maxRounds: 2 });
    state.setupGame(configs, 10000);
  });

  it('purchases an owned empty lot at level zero', () => {
    expect(state.propertyManager.buyProperty(1, 0)).toBe(true);
    expect(state.propertyManager.getProperty(1)).toMatchObject({ owner: 0, level: 0 });
    expect(state.propertyManager.upgradeProperty(1)).toBe(true);
    expect(state.propertyManager.getProperty(1).level).toBe(1);
  });

  it('skips jailed players synchronously without leaving the controller stalled', () => {
    state.players[1].jailTurns = 1;
    const transition = state.nextTurn();
    expect(transition.gameOver).toBe(false);
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.phase).toBe(GamePhase.PRE_ROLL_ACTION);
    expect(state.players[1].jailTurns).toBe(0);
  });

  it('expires a one-round news effect', () => {
    state.newsEffect = { id: 'DOUBLE_RENT', remainingRounds: 1 };
    state.onRoundEnd();
    expect(state.newsEffect?.id).not.toBe('DOUBLE_RENT');
  });

  it('round-trips a versioned snapshot including RNG state', () => {
    state.players[0].cash = 7777;
    state.propertyManager.buyProperty(3, 0);
    state.rng.next();
    const snapshot = state.createSnapshot();
    const restored = new GameState({ seed: 99 });
    restored.restoreSnapshot(snapshot);
    expect(restored.players[0].cash).toBe(7777);
    expect(restored.propertyManager.getProperty(3).owner).toBe(0);
    expect(restored.rng.next()).toBe(state.rng.next());
  });

  it('settles by net worth after the round cap', () => {
    state.round = 3;
    state.players[0].cash = 5000;
    state.players[1].cash = 9000;
    expect(state.checkWinCondition()).toBe(true);
    expect(state.winner.id).toBe(1);
    expect(state.winReason).toBe('NET_WORTH');
  });
});

