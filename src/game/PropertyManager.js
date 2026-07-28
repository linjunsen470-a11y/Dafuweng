import { BOARD_TILES, COLOR_GROUPS, TileType } from './BoardData.js';

export class PropertyManager {
  constructor() {
    this.properties = new Map(); // tileIndex -> { owner: null/int, level: 0..3, hasObstacle: false }
    this.init();
  }

  init() {
    BOARD_TILES.forEach((tile, index) => {
      if (tile.type === TileType.PROPERTY) {
        this.properties.set(index, {
          owner: null,
          level: 0,
          hasObstacle: false
        });
      } else {
        this.properties.set(index, {
          owner: null,
          level: 0,
          hasObstacle: false
        });
      }
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
    return true;
  }

  upgradeProperty(tileIndex) {
    const prop = this.properties.get(tileIndex);
    if (!prop || prop.level >= 3) return false;
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
    const groupTiles = BOARD_TILES.filter(t => t.group === groupName);
    return groupTiles.every(t => {
      const prop = this.properties.get(t.id);
      return prop && prop.owner === playerIndex;
    });
  }

  // 计算当前格子的最终过路费
  calculateToll(tileIndex, newsEffect = null) {
    const tileData = BOARD_TILES[tileIndex];
    const prop = this.properties.get(tileIndex);

    if (!tileData || tileData.type !== TileType.PROPERTY || !prop || prop.owner === null) {
      return 0;
    }

    let baseToll = tileData.tolls[prop.level] || tileData.tolls[0];

    // 同色系垄断翻倍加成
    if (this.checkGroupMonopoly(prop.owner, tileData.group)) {
      baseToll *= 2;
    }

    // 新闻翻倍大事件
    if (newsEffect === 'DOUBLE_RENT' || newsEffect?.id === 'DOUBLE_RENT') {
      baseToll *= 2;
    }

    return baseToll;
  }
}
