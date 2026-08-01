import { BOARD_TILES, COLOR_GROUPS, TileType, isPropertyTile } from './BoardData.js';
import { MAX_PROPERTY_LEVEL } from './GameRules.js';

export class PropertyManager {
  constructor() {
    this.properties = new Map(); // tileIndex -> { owner: null/int, level: 0..4, hasObstacle: false }
    this.tiles = new Map();
    this.init();
  }

  init(tiles = BOARD_TILES) {
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
        mortgageValue: 0
      });
    });
  }

  getProperty(tileIndex) {
    return this.properties.get(tileIndex);
  }

  buyProperty(tileIndex, playerIndex) {
    const prop = this.properties.get(tileIndex);
    if (!prop) return false;
    prop.owner = playerIndex;
    prop.level = 0;
    prop.isMortgaged = false;
    prop.mortgageValue = 0;
    return true;
  }

  upgradeProperty(tileIndex) {
    const prop = this.properties.get(tileIndex);
    if (!prop || prop.level >= MAX_PROPERTY_LEVEL) return false;
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
  calculateToll(tileIndex, newsEffect = null, priceIndex = 1.0) {
    const tileData = this.tiles.get(tileIndex);
    const prop = this.properties.get(tileIndex);

    if (!tileData || !isPropertyTile(tileData) || !prop || prop.owner === null || prop.isMortgaged) {
      return 0;
    }

    let baseToll = tileData.tolls[prop.level] || tileData.tolls[0];

    // 同色系垄断翻倍加成
    if (this.checkGroupMonopoly(prop.owner, tileData.group)) {
      baseToll *= 2;
    }
    if (tileData.type === TileType.BIG_PROPERTY) {
      const chainCount = [...this.tiles.values()].filter(tile => tile.type === TileType.BIG_PROPERTY
        && this.properties.get(tile.id)?.owner === prop.owner).length;
      baseToll *= 1 + Math.max(0, chainCount - 1) * 0.25;
    }

    // 新闻翻倍大事件
    if (newsEffect === 'DOUBLE_RENT' || newsEffect?.id === 'DOUBLE_RENT') {
      baseToll *= 2;
    }

    // 物价指数乘数加成
    return Math.floor(baseToll * (priceIndex || 1.0));
  }
}
