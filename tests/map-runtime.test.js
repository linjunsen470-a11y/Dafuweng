import { describe, expect, it } from 'vitest';
import { CITY_LOOP_MAP, FORTUNE_CROSSROADS_MAP, GRAND_BAY_MAP, ISLAND_FORK_MAP } from '../src/game/MapData.js';
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

describe('Classic map geometry compatibility', () => {
  it('keeps every city-loop corner on a unique coordinate', () => {
    const coordinates = CITY_LOOP_MAP.tiles.map(tile => `${tile.position.x}:${tile.position.z}`);
    expect(new Set(coordinates).size).toBe(CITY_LOOP_MAP.tiles.length);
  });
});

describe('Grand Bay flagship map', () => {
  const runtime = new MapRuntime(GRAND_BAY_MAP);

  it('contains the planned 120-node content mix', () => {
    expect(GRAND_BAY_MAP.tiles).toHaveLength(120);
    expect(GRAND_BAY_MAP.tiles.filter(tile => tile.type === 'PROPERTY')).toHaveLength(48);
    expect(GRAND_BAY_MAP.tiles.filter(tile => tile.type === 'BIG_PROPERTY')).toHaveLength(4);
    expect(GRAND_BAY_MAP.tiles.filter(tile => tile.type === 'ROAD')).toHaveLength(31);
    expect(GRAND_BAY_MAP.tiles.filter(tile => !['PROPERTY', 'BIG_PROPERTY', 'ROAD', 'START'].includes(tile.type))).toHaveLength(36);
    expect(new Set(GRAND_BAY_MAP.tiles.filter(tile => tile.group).map(tile => tile.group)).size).toBe(12);
  });

  it('has unique coordinates, valid lots, and three rejoining branches', () => {
    const ids = new Set(GRAND_BAY_MAP.tiles.map(tile => tile.id));
    const positions = new Set(GRAND_BAY_MAP.tiles.map(tile => `${tile.position.x}:${tile.position.z}`));
    expect(ids.size).toBe(120);
    expect(positions.size).toBe(120);
    GRAND_BAY_MAP.tiles.forEach(tile => (tile.next || []).forEach(nextId => expect(ids.has(nextId)).toBe(true)));
    expect(GRAND_BAY_MAP.tiles.filter(tile => tile.next.length > 1).map(tile => tile.id)).toEqual([12, 36, 60]);
    expect(runtime.projectPath(12, 13, 1, options => options.at(-1)).at(-1)).toBe(24);
    expect(runtime.projectPath(36, 13, 1, options => options.at(-1)).at(-1)).toBe(48);
    expect(runtime.projectPath(60, 13, 1, options => options.at(-1)).at(-1)).toBe(72);
    GRAND_BAY_MAP.tiles.filter(tile => ['PROPERTY', 'BIG_PROPERTY'].includes(tile.type)).forEach(tile => expect(tile.lot?.position).toBeTruthy());
  });

  it('can reach every node and derive reverse edges', () => {
    const reachable = runtime.getReachable(0, 160, [1]);
    expect(new Set(reachable.map(item => item.id)).size).toBe(120);
    expect(runtime.getNextOptions(24, -1).sort((a, b) => a - b)).toEqual([23, 95]);
  });
});

describe('Fortune crossroads map', () => {
  const runtime = new MapRuntime(FORTUNE_CROSSROADS_MAP);

  it('contains three real route choices that rejoin the main road', () => {
    expect(runtime.getNextOptions(3)).toEqual([4, 6]);
    expect(runtime.projectPath(3, 3, 1, options => options[0])).toEqual([4, 5, 8]);
    expect(runtime.projectPath(3, 3, 1, options => options[1])).toEqual([6, 7, 8]);
    expect(runtime.getNextOptions(11)).toEqual([12, 14]);
    expect(runtime.getNextOptions(19)).toEqual([20, 22]);
  });

  it('includes buildable empty lots and new landmark categories', () => {
    const types = FORTUNE_CROSSROADS_MAP.tiles.map(tile => tile.type);
    expect(types).toEqual(expect.arrayContaining(['PROPERTY', 'COUPON', 'MONSTER', 'TREASURE', 'GOD_FORTUNE']));
    expect(FORTUNE_CROSSROADS_MAP.tiles.filter(tile => tile.type === 'PROPERTY').length).toBeGreaterThanOrEqual(10);
  });
});
