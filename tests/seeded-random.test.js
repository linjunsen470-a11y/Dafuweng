import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/game/SeededRandom.js';

describe('SeededRandom', () => {
  it('replays an identical sequence from the same seed', () => {
    const left = new SeededRandom(20260729);
    const right = new SeededRandom(20260729);
    expect(Array.from({ length: 20 }, () => left.int(1, 6)))
      .toEqual(Array.from({ length: 20 }, () => right.int(1, 6)));
  });

  it('continues from a serialized state', () => {
    const source = new SeededRandom(42);
    source.next();
    source.next();
    const saved = source.exportState();
    const restored = new SeededRandom(1);
    restored.importState(saved);
    expect(restored.next()).toBe(source.next());
  });
});

