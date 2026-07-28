import { describe, expect, it } from 'vitest';
import { ISLAND_FORK_MAP } from '../src/game/MapData.js';
import { MapRuntime } from '../src/game/MapRuntime.js';

describe('MapRuntime', () => {
  const runtime = new MapRuntime(ISLAND_FORK_MAP);

  it('exposes both island branch choices and rejoins them', () => {
    expect(runtime.getNextOptions(7)).toEqual([8, 10]);
    expect(runtime.projectPath(7, 3, 1, options => options[0])).toEqual([8, 9, 12]);
    expect(runtime.projectPath(7, 3, 1, options => options[1])).toEqual([10, 11, 12]);
  });

  it('derives reverse edges for turnaround movement', () => {
    expect(runtime.getNextOptions(12, -1).sort((a, b) => a - b)).toEqual([9, 11]);
  });

  it('finds reachable nodes across both branches', () => {
    const ids = runtime.getReachable(7, 2, [1]).map(item => item.id);
    expect(ids).toEqual(expect.arrayContaining([8, 9, 10, 11]));
  });
});
