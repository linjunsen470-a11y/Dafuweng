import { describe, expect, it } from 'vitest';
import { GameSimulator } from '../src/game/GameSimulator.js';

describe('100-game deterministic stability simulation', () => {
  it('finishes every game with valid assets and a winner', () => {
    const summaries = Array.from({ length: 100 }, (_, index) => {
      const simulator = new GameSimulator({
        seed: 10000 + index,
        mapId: index % 2 ? 'island-fork' : 'city-loop',
        maxRounds: 40
      });
      return simulator.run();
    });

    summaries.forEach(summary => {
      expect(summary.winnerId).toBeTypeOf('number');
      expect(summary.round).toBeLessThanOrEqual(41);
      expect(summary.turns).toBeLessThanOrEqual(320);
      summary.rankings.forEach(({ player, assets }) => {
        expect(Number.isFinite(player.cash)).toBe(true);
        expect(Number.isFinite(assets.total)).toBe(true);
        expect(player.cards.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  it('replays the same final snapshot from the same seed', () => {
    const first = new GameSimulator({ seed: 7788, mapId: 'island-fork' }).run();
    const second = new GameSimulator({ seed: 7788, mapId: 'island-fork' }).run();
    expect(first.winnerId).toBe(second.winnerId);
    expect(first.rankings.map(item => item.assets.total))
      .toEqual(second.rankings.map(item => item.assets.total));
  });
});
