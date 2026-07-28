import { BOARD_TILES, TileType } from './BoardData.js';
import { cardManager } from './CardManager.js';

export class CardRules {
  constructor(gameState) {
    this.gameState = gameState;
  }

  getLegalAction(player, cardId) {
    const card = cardManager.getCardById(cardId);
    if (!card) return { type: 'USE_CARD', enabled: false, reason: '未知卡片', targets: [] };
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

    if (card.targetType === 'PLAYER') return activeOpponents;
    if (card.targetType === 'STOCK') {
      return this.gameState.stockMarket.stocks.map(s => ({
        id: s.id,
        label: `${s.name} (${s.code})`,
        description: `$${s.price} / ${s.change >= 0 ? '+' : ''}${s.change}%`
      }));
    }
    if (card.id === 'OBSTACLE') {
      const targets = [];
      for (let step = -10; step <= 10; step++) {
        if (step === 0) continue;
        const id = (player.currentTile + step + BOARD_TILES.length) % BOARD_TILES.length;
        const prop = this.gameState.propertyManager.getProperty(id);
        if (!prop?.hasObstacle) targets.push({ id, label: BOARD_TILES[id].name, description: `${step > 0 ? '前方' : '后方'} ${Math.abs(step)} 格` });
      }
      return targets;
    }
    if (card.id === 'CLEAR_ROAD') {
      return BOARD_TILES.filter(tile => this.gameState.propertyManager.getProperty(tile.id)?.hasObstacle)
        .map(tile => ({ id: tile.id, label: tile.name }));
    }
    if (card.id === 'TELEPORT') {
      return Array.from({ length: 9 }, (_, i) => {
        const step = i + 2;
        const id = (player.currentTile + step) % BOARD_TILES.length;
        return { id, label: BOARD_TILES[id].name, description: `前方 ${step} 格` };
      });
    }
    if (card.id === 'DEMOLISH') {
      return BOARD_TILES.filter(tile => {
        const prop = this.gameState.propertyManager.getProperty(tile.id);
        return tile.type === TileType.PROPERTY && prop?.owner !== null && prop.owner !== player.id && prop.level > 0;
      }).map(tile => ({ id: tile.id, label: tile.name, description: `LV ${this.gameState.propertyManager.getProperty(tile.id).level}` }));
    }
    if (card.id === 'STEAL_LAND') {
      return BOARD_TILES.filter(tile => {
        const prop = this.gameState.propertyManager.getProperty(tile.id);
        return tile.type === TileType.PROPERTY && prop?.owner !== null && prop.owner !== player.id;
      }).map(tile => ({ id: tile.id, label: tile.name, description: `所有者：${this.gameState.players[this.gameState.propertyManager.getProperty(tile.id).owner]?.name}` }));
    }
    return [];
  }
}

