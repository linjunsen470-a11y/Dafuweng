import { TileType, isPropertyTile } from './BoardData.js';
import { cardManager } from './CardManager.js';

export class CardRules {
  constructor(gameState) {
    this.gameState = gameState;
  }

  getLegalAction(player, cardId) {
    const card = cardManager.getCardById(cardId);
    if (!card) return { type: 'USE_CARD', enabled: false, reason: '未知卡片', targets: [] };
    if (player.id !== this.gameState.currentPlayerIndex) {
      return { type: 'USE_CARD', enabled: false, reason: '只能由当前玩家使用卡片', targets: [] };
    }
    if (this.gameState.phase !== 'PRE_ROLL_ACTION') {
      return { type: 'USE_CARD', enabled: false, reason: '只能在掷骰前使用卡片', targets: [] };
    }
    if (!player.cards.includes(cardId)) {
      return { type: 'USE_CARD', enabled: false, reason: '背包中没有这张卡片', targets: [] };
    }
    const targets = this.getTargets(player, card);
    if (card.targetType !== 'NONE' && targets.length === 0) {
      return { type: 'USE_CARD', enabled: false, reason: '当前没有合法目标', targets };
    }
    return { type: 'USE_CARD', enabled: true, targets };
  }

  getTargets(player, card) {
    const activeOpponents = this.gameState.players
      .filter(p => !p.isBankrupt && p.id !== player.id)
      .map(p => ({ id: p.id, label: p.name, description: `现金 $${p.cash.toLocaleString()}` }));

    if (card.targetType === 'PLAYER') {
      if (card.id === 'TURN_AROUND') {
        return [player, ...this.gameState.players.filter(p => !p.isBankrupt && p.id !== player.id)]
          .map(p => ({ id: p.id, label: p.name, description: `现金 $${p.cash.toLocaleString()}` }));
      }
      return activeOpponents;
    }
    if (card.targetType === 'STOCK') {
      return this.gameState.stockMarket.stocks.map(s => ({
        id: s.id,
        label: `${s.name} (${s.code})`,
        description: `$${s.price} / ${s.change >= 0 ? '+' : ''}${s.change}%`
      }));
    }
    if (card.id === 'OBSTACLE' || card.id === 'MINE') {
      const reachable = this.gameState.mapRuntime.getReachable(player.currentTile, 10, [1, -1]);
      const unique = new Map();
      reachable.forEach(({ id, distance, direction }) => {
        const prop = this.gameState.propertyManager.getProperty(id);
        if (!prop?.hasObstacle && !prop?.hasMine && !unique.has(id)) {
          unique.set(id, {
            id,
            label: this.gameState.getTile(id).name,
            description: `${direction > 0 ? '前方' : '后方'} ${distance} 格`
          });
        }
      });
      return [...unique.values()];
    }
    if (card.id === 'MISSILE' || card.id === 'NUKES') {
      return this.gameState.mapDefinition.tiles.map(tile => ({
        id: tile.id,
        label: tile.name,
        description: isPropertyTile(tile) ? '包含建筑物' : '地图位置'
      }));
    }
    if (card.id === 'LAND_BUY') {
      return this.gameState.mapDefinition.tiles.filter(tile => {
        const prop = this.gameState.propertyManager.getProperty(tile.id);
        return isPropertyTile(tile) && prop?.owner === null;
      }).map(tile => ({ id: tile.id, label: tile.name, description: `基础售价 $${tile.price || 1000}` }));
    }
    if (card.id === 'SWAP_LAND') {
      return this.gameState.mapDefinition.tiles.filter(tile => {
        const prop = this.gameState.propertyManager.getProperty(tile.id);
        return isPropertyTile(tile) && prop?.owner !== null && prop.owner !== player.id;
      }).map(tile => ({ id: tile.id, label: tile.name, description: `所有者：${this.gameState.players[this.gameState.propertyManager.getProperty(tile.id).owner]?.name}` }));
    }
    if (card.id === 'CLEAR_ROAD') {
      return this.gameState.mapDefinition.tiles.filter(tile => this.gameState.propertyManager.getProperty(tile.id)?.hasObstacle)
        .map(tile => ({ id: tile.id, label: tile.name }));
    }
    if (card.id === 'TELEPORT') {
      const path = this.gameState.mapRuntime.projectPath(player.currentTile, 10, player.direction || 1);
      return path.slice(1).map((id, index) => ({
        id,
        label: this.gameState.getTile(id).name,
        description: `沿默认路线前进 ${index + 2} 格`
      }));
    }
    if (card.id === 'DEMOLISH') {
      return this.gameState.mapDefinition.tiles.filter(tile => {
        const prop = this.gameState.propertyManager.getProperty(tile.id);
        return isPropertyTile(tile) && prop && prop.owner !== null && prop.owner !== undefined && prop.owner !== player.id && prop.level > 0;
      }).map(tile => {
        const prop = this.gameState.propertyManager.getProperty(tile.id);
        return { id: tile.id, label: tile.name, description: `LV ${prop.level}` };
      });
    }
    if (card.id === 'STEAL_LAND') {
      return this.gameState.mapDefinition.tiles.filter(tile => {
        const prop = this.gameState.propertyManager.getProperty(tile.id);
        return isPropertyTile(tile) && prop && prop.owner !== null && prop.owner !== undefined && prop.owner !== player.id;
      }).map(tile => {
        const prop = this.gameState.propertyManager.getProperty(tile.id);
        const ownerName = this.gameState.players[prop.owner]?.name || '未知';
        return { id: tile.id, label: tile.name, description: `所有者：${ownerName}` };
      });
    }
    return [];
  }
}
