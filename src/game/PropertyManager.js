import { BOARD_TILES, COLOR_GROUPS, TileType, isPropertyTile } from './BoardData.js';
import { residentialRent, propertyLimit } from './GameRules.js';
import { BUILDINGS } from './ContentRegistry.js';

export class PropertyManager {
  constructor() {
    this.properties = new Map(); // tileIndex -> { owner: null/int, level: 0..5, hasObstacle: false }
    this.tiles = new Map();
    this.init();
  }

  init(tiles = BOARD_TILES, mapId = null) {
    this.mapId = mapId;
    this.properties.clear();
    this.tiles = new Map();
    tiles.forEach((tile, index) => {
      const tileId = tile.id !== undefined ? tile.id : index;
      this.tiles.set(tileId, tile);
      this.properties.set(tileId, {
        owner: null,
        level: 0,
        hasObstacle: false,
        hasMine: false,
        isMortgaged: false,
        mortgageValue: 0,
        buildingType: tile.type === TileType.BIG_PROPERTY ? null : 'RESIDENTIAL'
      });
    });
    this.streetLinks = this.buildStreetLinks();
  }

  buildStreetLinks() {
    const links = new Map();
    const tiles = [...this.tiles.values()];
    const next = tile => tile.next || [tiles[(tiles.indexOf(tile)+1)%tiles.length]?.id];
    for (const tile of tiles) {
      if (tile.type !== TileType.PROPERTY || !tile.group) continue;
      const seen = new Set([tile.id]), queue = [...next(tile)];
      while (queue.length) {
        const id = queue.pop(), other = this.tiles.get(id);
        if (!other || seen.has(id)) continue;
        seen.add(id);
        if (isPropertyTile(other)) {
          if (other.group === tile.group && other.type === TileType.PROPERTY) {
            for (const [a,b] of [[tile.id,id],[id,tile.id]]) {
              if (!links.has(a)) links.set(a,new Set());
              links.get(a).add(b);
            }
          }
        } else if (next(other).length===1) queue.push(...next(other));
      }
    }
    return links;
  }

  streetChain(tileId, owner = this.getProperty(tileId)?.owner) {
    const found = new Set([tileId]), pending = [tileId];
    if (owner == null || !this.mapId || this.getProperty(tileId)?.isMortgaged) return found;
    while (pending.length) for (const id of this.streetLinks.get(pending.pop()) || []) {
      const lot = this.getProperty(id);
      if (!found.has(id) && lot?.owner === owner && !lot.isMortgaged) { found.add(id);pending.push(id); }
    }
    return found;
  }

  getProperty(tileIndex) {
    return this.properties.get(tileIndex);
  }

  buyProperty(tileIndex, playerIndex, buildingType = null) {
    const prop = this.properties.get(tileIndex);
    if (!prop) return false;
    prop.owner = playerIndex;
    prop.level = 0;
    prop.isMortgaged = false;
    prop.mortgageValue = 0;
    const tile = this.tiles.get(tileIndex);
    prop.buildingType = tile?.type === TileType.BIG_PROPERTY
      ? (buildingType || 'MALL')
      : (buildingType || prop.buildingType || 'RESIDENTIAL');
    return true;
  }

  setBuildingType(tileIndex, buildingType) {
    const prop = this.properties.get(tileIndex);
    const tile = this.tiles.get(tileIndex);
    if (!prop || prop.owner === null || !tile) return false;
    const allowed = tile.type === TileType.BIG_PROPERTY
      ? BUILDINGS.map(building => building.id)
      : ['RESIDENTIAL', 'CHAIN_STORE'];
    if (!allowed.includes(buildingType)) return false;
    prop.buildingType = buildingType;
    const definition = BUILDINGS.find(building => building.id === buildingType);
    if (definition) prop.level = Math.min(prop.level, definition.maxLevel);
    return true;
  }

  upgradeProperty(tileIndex) {
    const prop = this.properties.get(tileIndex);
    const maxLevel = propertyLimit(prop?.buildingType, this.mapId);
    if (!prop || prop.level >= maxLevel) return false;
    prop.level += 1;
    return true;
  }

  demolishProperty(tileIndex) {
    const prop = this.properties.get(tileIndex);
    if (!prop || prop.level <= 0) return false;
    prop.level -= 1;
    return true;
  }

  // 检查玩家是否垄断了同一颜色组的所有地产
  checkGroupMonopoly(playerIndex, groupName) {
    if (!groupName) return false;
    const groupTiles = [...this.tiles.values()].filter(t => t.type === TileType.PROPERTY && t.group === groupName);
    if (!groupTiles.length) return false;
    return groupTiles.every(t => {
      const prop = this.properties.get(t.id);
      return prop && prop.owner === playerIndex;
    });
  }

  // 计算当前格子的最终过路费 (带物价指数)
  calculateToll(tileIndex, newsEffect = null, priceIndex = 1.0, visitor = null) {
    const tileData = this.tiles.get(tileIndex);
    const prop = this.properties.get(tileIndex);

    if (!tileData || !isPropertyTile(tileData) || !prop || prop.owner === null || prop.isMortgaged) {
      return 0;
    }

    let baseToll = residentialRent(tileData, prop.level);

    const building = BUILDINGS.find(definition => definition.id === prop.buildingType);
    if (building) {
      if (prop.buildingType === 'GAS_STATION' && (!visitor || visitor.vehicle === 'WALK')) return 0;
      baseToll *= building.rentMultiplier;
    }

    // 同色系垄断翻倍加成
    baseToll *= Math.max(this.streetChain(tileIndex).size, this.checkGroupMonopoly(prop.owner, tileData.group) ? 2 : 1);
    if (prop.buildingType === 'CHAIN_STORE') {
      const chainCount = [...this.properties.values()].filter(property => property.buildingType === 'CHAIN_STORE'
        && property.owner === prop.owner).length;
      baseToll *= 1 + Math.max(0, chainCount - 1) * 0.25;
    }

    const nearbyPark = [...this.properties.entries()].some(([otherTileId, other]) => other.owner === prop.owner
      && !other.isMortgaged && other.buildingType === 'PARK' && Math.abs(Number(otherTileId) - Number(tileIndex)) <= 2);
    if (nearbyPark && prop.buildingType !== 'PARK') baseToll *= 1.2;

    // 新闻翻倍大事件
    if (newsEffect === 'DOUBLE_RENT' || newsEffect?.id === 'DOUBLE_RENT') {
      baseToll *= 2;
    }

    // 物价指数乘数加成
    return Math.floor(baseToll * (priceIndex || 1.0));
  }
}
