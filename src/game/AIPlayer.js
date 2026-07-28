import { BOARD_TILES } from './BoardData.js';

export class AIPlayer {
  static evaluateLandPurchase(aiPlayer, landData) {
    const reserveByDifficulty = { EASY: 2500, NORMAL: 1200, HARD: 500 };
    const safetyReserve = reserveByDifficulty[aiPlayer.aiDifficulty] ?? 1200;
    if (aiPlayer.cash - landData.price >= safetyReserve) {
      return true;
    }
    return false;
  }

  static evaluateLandUpgrade(aiPlayer, landData, currentLevel) {
    if (currentLevel >= 3) return false;
    const upgradeCost = landData.buildCost || 600;
    const reserveByDifficulty = { EASY: 3000, NORMAL: 1800, HARD: 800 };
    const safetyReserve = reserveByDifficulty[aiPlayer.aiDifficulty] ?? 1800;
    if (aiPlayer.cash - upgradeCost >= safetyReserve) {
      return true;
    }
    return false;
  }

  static decideCardUsage(aiPlayer, gameState) {
    if (!aiPlayer.cards || aiPlayer.cards.length === 0) return null;

    for (const cardId of aiPlayer.cards) {
      if (cardId === 'FORTUNE_GOD' && !aiPlayer.godType) {
        return { cardId };
      }
      if (cardId === 'REMOTE_DICE') {
        // 在首回合，不盲目无脑使用遥控骰子，除非能踩中高价值金地或神仙格子
        const allowGeneralUse = gameState.round > 1 && gameState.rng.next() < 0.4;
        
        for (let step = 1; step <= 6; step++) {
          const targetTileIdx = (aiPlayer.currentTile + step) % BOARD_TILES.length;
          const tile = BOARD_TILES[targetTileIdx];
          if (tile && tile.type === 'PROPERTY') {
            const prop = gameState.propertyManager.getProperty(targetTileIdx);
            if (!prop || prop.owner === null) {
              const isHighValue = tile.price >= 2500 || tile.group === 'GOLD' || tile.group === 'PURPLE';
              if (isHighValue || allowGeneralUse) {
                return { cardId, diceVal: step };
              }
            }
          } else if (tile && (tile.type === 'GOD_FORTUNE' || tile.type === 'GOD_EARTH')) {
            return { cardId, diceVal: step };
          }
        }
      }
    }
    return null;
  }

  static decideStockAction(aiPlayer, stockMarket) {
    if (aiPlayer.cash > 15000) {
      const cheapStock = stockMarket.stocks.find(s => s.price < 80);
      if (cheapStock) {
        return { action: 'BUY', stockId: cheapStock.id, shares: 20 };
      }
    }

    if (aiPlayer.cash < 2000) {
      for (const stockId in aiPlayer.stocks) {
        const holding = aiPlayer.stocks[stockId];
        if (holding && holding.shares > 0) {
          return { action: 'SELL', stockId, shares: holding.shares };
        }
      }
    }
    return null;
  }
}
