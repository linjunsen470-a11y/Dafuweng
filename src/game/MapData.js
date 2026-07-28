import { BOARD_TILES } from './BoardData.js';

export const CITY_LOOP_MAP = {
  id: 'city-loop',
  name: '霓虹财富城',
  spawnTile: 0,
  theme: 'CITY',
  musicId: 'city-day',
  tiles: BOARD_TILES.map((tile, index) => ({
    ...tile,
    next: [(index + 1) % BOARD_TILES.length],
    previous: [(index - 1 + BOARD_TILES.length) % BOARD_TILES.length]
  }))
};

// Data-ready second map. Rendering support can reuse the city board until its
// dedicated island geometry is shipped; rules and route choices are independent.
export const ISLAND_FORK_MAP = {
  id: 'island-fork',
  name: '潮汐宝藏岛',
  spawnTile: 0,
  theme: 'ISLAND',
  musicId: 'island-breeze',
  tiles: BOARD_TILES.map((tile, index) => {
    let next = [(index + 1) % BOARD_TILES.length];
    if (index === 7) next = [8, 10];
    if (index === 9 || index === 11) next = [12];
    return {
      ...tile,
      name: index === 0 ? '海港起点' : tile.name.replace('帝国', '海岛'),
      next
    };
  })
};

export const MAP_DEFINITIONS = [CITY_LOOP_MAP, ISLAND_FORK_MAP];

export function getMapDefinition(mapId = CITY_LOOP_MAP.id) {
  return MAP_DEFINITIONS.find(map => map.id === mapId) || CITY_LOOP_MAP;
}
