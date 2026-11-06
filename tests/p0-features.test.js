import { describe, expect, it } from 'vitest';
import { GameState } from '../src/game/GameState.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { CARDS, cardManager } from '../src/game/CardManager.js';
import { PLAYER_PROFILES, TileType } from '../src/game/BoardData.js';
import { MAP_DEFINITIONS, TAIWAN_MAP } from '../src/game/MapData.js';
import { GameSimulator } from '../src/game/GameSimulator.js';

describe('P0 Features Validation', () => {
  it('has 30 card definitions and 16 player profiles', () => {
    expect(CARDS).toHaveLength(30);
    expect(PLAYER_PROFILES).toHaveLength(16);
    expect(MAP_DEFINITIONS).toHaveLength(5);
    expect(TAIWAN_MAP.tiles).toHaveLength(40);
  });

  it('calculates dynamic price index based on round progression', () => {
    const state = new GameState({ seed: 42 });
    state.round = 1;
    expect(state.priceIndex).toBe(1.0);
    state.round = 6;
    expect(state.priceIndex).toBe(1.2);
    state.round = 11;
    expect(state.priceIndex).toBe(1.4);
    state.round = 21;
    expect(state.priceIndex).toBe(1.8);
  });

  it('supports 5-level property upgrades (level 0 to 4)', () => {
    const state = new GameState({ seed: 42 });
    state.setupGame([
      { profileIndex: 0, name: '林小满', isAI: false },
      { profileIndex: 1, name: '顾田野', isAI: true }
    ]);
    const engine = new GameEngine(state);
    state.propertyManager.buyProperty(1, 0);

    for (let level = 1; level <= 4; level++) {
      const result = state.propertyManager.upgradeProperty(1);
      expect(result).toBe(true);
    }
    const prop = state.propertyManager.getProperty(1);
    expect(prop.level).toBe(4);
    // Upgrade past level 4 should fail
    expect(state.propertyManager.upgradeProperty(1)).toBe(false);
  });

  it('runs 20 games on Taiwan map with 4 players and 30 cards without error', () => {
    for (let i = 0; i < 20; i++) {
      const sim = new GameSimulator({
        seed: 5000 + i,
        mapId: 'taiwan-loop',
        maxRounds: 30
      });
      const summary = sim.run();
      expect(summary.winnerId).toBeTypeOf('number');
      expect(summary.rankings.length).toBeGreaterThanOrEqual(1);
    }
  });
});
