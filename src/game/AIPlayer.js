import { cardManager } from './CardManager.js';
import { MAX_PROPERTY_LEVEL } from './GameRules.js';

export class AIPlayer {
  static evaluateLandPurchase(aiPlayer, landData, gameState = null) {
    const reserveByDifficulty = { EASY: 2500, NORMAL: 1200, HARD: 500 };
    const safetyReserve = reserveByDifficulty[aiPlayer.aiDifficulty] ?? 1200;
    const strategyReserve = aiPlayer.aiStrategy === 'PROPERTY' ? Math.round(safetyReserve * 0.5) : safetyReserve;
    if (aiPlayer.cash - landData.price < strategyReserve) return false;
    if (!gameState) return true;
    const groupTiles = gameState.mapDefinition.tiles.filter(tile => tile.group && tile.group === landData.group);
    const ownedInGroup = groupTiles.filter(tile => gameState.propertyManager.getProperty(tile.id)?.owner === aiPlayer.id).length;
    const groupPressure = groupTiles.length ? ownedInGroup / groupTiles.length : 0;
    const baseRent = landData.tolls?.[0] || 0;
    const valueScore = baseRent / Math.max(1, landData.price);
    return landData.large || groupPressure >= 0.34 || valueScore >= 0.13 || aiPlayer.cash > landData.price * 2.2;
  }

  static evaluateLandUpgrade(aiPlayer, landData, currentLevel, gameState = null) {
    if (currentLevel >= MAX_PROPERTY_LEVEL) return false;
    const upgradeCost = landData.buildCost || 600;
    const reserveByDifficulty = { EASY: 3000, NORMAL: 1800, HARD: 800 };
    const safetyReserve = reserveByDifficulty[aiPlayer.aiDifficulty] ?? 1800;
    if (aiPlayer.cash - upgradeCost < safetyReserve) return false;
    const currentRent = landData.tolls?.[currentLevel] || 0;
    const nextRent = landData.tolls?.[currentLevel + 1] || currentRent;
    const roi = (nextRent - currentRent) / Math.max(1, upgradeCost);
    const opponents = gameState?.players?.filter(player => !player.isBankrupt && player.id !== aiPlayer.id).length || 1;
    return landData.large || (aiPlayer.aiStrategy === 'PROPERTY' && roi * opponents >= 0.22) || roi * opponents >= 0.45 || aiPlayer.cash > upgradeCost * 3;
  }

  static decideCardPurchase(aiPlayer, gameEngine) {
    const heat = gameEngine?.state?.gameMode === 'HEAT';
    const preferred = heat || aiPlayer.aiStrategy === 'ATTACK'
      ? ['NUKES', 'MISSILE', 'MINE', 'HIBERNATE', 'TURTLE', 'OBSTACLE', 'REMOTE_DICE']
      : aiPlayer.aiStrategy === 'CARD'
        ? ['SUMMON_GOD', 'REMOTE_DICE', 'RENT_SHIELD', 'CASH_TAX', 'DEMOLISH', 'IMMUNITY_CARD', 'CAR_CARD']
        : ['REMOTE_DICE', 'SUMMON_GOD', 'RENT_SHIELD', 'LAND_BUY', 'CASH_TAX', 'DEMOLISH', 'MISSILE', 'NUKES', 'TURTLE', 'OBSTACLE', 'IMMUNITY_CARD', 'CAR_CARD'];
    if (aiPlayer.cards.length >= 8) return null;
    for (const cardId of preferred) {
      const card = cardManager.getCardById(cardId);
      const cost = gameEngine.getCardCost(aiPlayer, card);
      if (aiPlayer.cardPoints >= cost) return { cardId };
    }
    return null;
  }

  static chooseCommercialBuilding(aiPlayer, gameState) {
    if ((aiPlayer.items?.length || 0) < 4 && gameState.researchTasks.filter(task => task.playerId === aiPlayer.id).length === 0) return 'LAB';
    if (aiPlayer.cash < 7000) return 'PARK';
    if (aiPlayer.vehicle !== 'WALK') return 'GAS_STATION';
    return gameState.rng.next() < 0.55 ? 'MALL' : 'HOTEL';
  }

  static chooseMagic(aiPlayer, gameState) {
    if (aiPlayer.cash < 6000) return { conditionId: 'SELF', effectId: 'CASH_RAIN' };
    const ownProperties = [...gameState.propertyManager.properties.values()].filter(property => property.owner === aiPlayer.id).length;
    if (ownProperties >= 2) return { conditionId: 'SELF', effectId: 'PROPERTY_BOOM' };
    return { conditionId: 'ALL_OPPONENTS', effectId: gameState.rng.next() < 0.5 ? 'STOP_ONE' : 'DEPOSIT_ALL' };
  }

  static decideItemPurchase(aiPlayer, gameEngine) {
    if ((aiPlayer.items?.length || 0) >= 8) return null;
    const preferred = aiPlayer.aiStrategy === 'ATTACK'
      ? ['MISSILE_ITEM', 'MINE_ITEM', 'BARRIER', 'CAR']
      : aiPlayer.vehicle === 'WALK' ? ['CAR', 'MOTOR', 'REMOTE_DICE_ITEM', 'BARRIER'] : ['REMOTE_DICE_ITEM', 'MINE_ITEM', 'MISSILE_ITEM'];
    return preferred.find(itemId => {
      const item = gameEngine.state.inventoryManager.getDefinition(itemId);
      return item?.cost !== null && aiPlayer.cardPoints >= item.cost;
    }) || null;
  }

  static decideItemUsage(aiPlayer, gameState, gameEngine) {
    const has = itemId => aiPlayer.items?.includes(itemId) && gameEngine.getItemAction(aiPlayer, itemId).enabled;
    if (has('CAR') && aiPlayer.vehicle !== 'CAR') return { itemId: 'CAR' };
    if (has('MOTOR') && aiPlayer.vehicle === 'WALK') return { itemId: 'MOTOR' };
    if (has('ENGINEERING_CAR')) return { itemId: 'ENGINEERING_CAR' };
    for (const itemId of ['NUCLEAR_MISSILE', 'MISSILE_ITEM', 'MINE_ITEM', 'BARRIER']) {
      if (!has(itemId)) continue;
      const targets = gameEngine.getItemAction(aiPlayer, itemId).targets || [];
      if (!targets.length) continue;
      if (['NUCLEAR_MISSILE', 'MISSILE_ITEM'].includes(itemId)) {
        const target = [...targets].sort((a, b) => {
          const score = tileId => gameState.players.filter(player => player.id !== aiPlayer.id && player.currentTile === Number(tileId)).length * 100
            + (gameState.propertyManager.getProperty(Number(tileId))?.level || 0) * 20;
          return score(b.id) - score(a.id);
        })[0];
        return { itemId, targetId: target.id };
      }
      return { itemId, targetId: targets.at(-1).id };
    }
    return null;
  }

  static decideCardUsage(aiPlayer, gameState, gameEngine = null) {
    if (!aiPlayer.cards || aiPlayer.cards.length === 0) return null;
    const legal = cardId => !gameEngine || gameEngine.getCardAction(aiPlayer, cardId).enabled;
    const has = cardId => aiPlayer.cards.includes(cardId) && legal(cardId);

    if (has('BANISH_GOD') && ['MISFORTUNE', 'BAD', 'DEMON', 'GREAT_POOR', 'SMALL_POOR'].includes(aiPlayer.godType)) {
      return { cardId: 'BANISH_GOD' };
    }
    if (has('IMMUNITY_CARD') && (aiPlayer.jailTurns > 0 || aiPlayer.hospitalTurns > 0)) {
      return { cardId: 'IMMUNITY_CARD' };
    }
    if (has('SUMMON_GOD') && !aiPlayer.godType) return { cardId: 'SUMMON_GOD' };
    if (has('HIBERNATE')) return { cardId: 'HIBERNATE' };
    if (has('CLEANSE') && (aiPlayer.turtleTurns > 0 || ['MISFORTUNE', 'BAD'].includes(aiPlayer.godType))) {
      return { cardId: 'CLEANSE' };
    }
    if (has('FORTUNE_GOD') && !aiPlayer.godType) return { cardId: 'FORTUNE_GOD' };
    if (has('CAR_CARD') && aiPlayer.vehicle !== 'CAR') return { cardId: 'CAR_CARD' };
    if (has('RENT_SHIELD') && aiPlayer.rentShieldTurns <= 0) return { cardId: 'RENT_SHIELD' };
    if (has('IMMUNITY') && aiPlayer.negativeImmuneTurns <= 0) return { cardId: 'IMMUNITY' };

    const averageCash = gameState.players.filter(player => !player.isBankrupt)
      .reduce((sum, player, _, players) => sum + player.cash / players.length, 0);
    if (has('EQUAL_WEALTH') && aiPlayer.cash < averageCash * 0.65) return { cardId: 'EQUAL_WEALTH' };

    const targetedPriority = ['MISSILE', 'NUKES', 'LAND_BUY', 'SWAP_LAND', 'SLEEPWALK', 'STEAL_LAND', 'DEMOLISH', 'CASH_TAX', 'TURTLE', 'OBSTACLE', 'MINE', 'BEAR_CARD', 'TURN_AROUND', 'GIFT_CARD'];
    for (const cardId of targetedPriority) {
      if (!has(cardId)) continue;
      const action = gameEngine?.getCardAction(aiPlayer, cardId);
      const targets = action?.targets || [];
      if (!targets.length) continue;
      let target = targets[0];
      if (['CASH_TAX', 'TURTLE', 'TURN_AROUND'].includes(cardId)) {
        target = [...targets].sort((a, b) =>
          (gameState.players[Number(b.id)]?.cash || 0) - (gameState.players[Number(a.id)]?.cash || 0))[0];
      }
      if (['STEAL_LAND', 'DEMOLISH'].includes(cardId)) {
        target = [...targets].sort((a, b) =>
          gameState.propertyManager.calculateToll(Number(b.id), gameState.newsEffect)
          - gameState.propertyManager.calculateToll(Number(a.id), gameState.newsEffect))[0];
      }
      return { cardId, targetId: target.id };
    }

    for (const cardId of aiPlayer.cards) {
      if (cardId === 'REMOTE_DICE') {
        // 在首回合，不盲目无脑使用遥控骰子，除非能踩中高价值金地或神仙格子
        const allowGeneralUse = gameState.round > 1 && gameState.rng.next() < 0.4;
        
        const path = gameState.mapRuntime.projectPath(
          aiPlayer.currentTile,
          6,
          aiPlayer.direction || 1,
          options => this.chooseRoute(aiPlayer, options, gameState)
        );
        for (let step = 1; step <= path.length; step++) {
          const targetTileIdx = path[step - 1];
          const tile = gameState.getTile(targetTileIdx);
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
    for (const [stockId, holding] of Object.entries(aiPlayer.stocks || {})) {
      const stock = stockMarket.stocks.find(item => item.id === stockId);
      if (!stock || !holding?.shares) continue;
      const returnRate = (stock.price - holding.avgPrice) / Math.max(1, holding.avgPrice);
      if (returnRate >= 0.18 || returnRate <= -0.16 || aiPlayer.cash < 3000) {
        return { action: 'SELL', stockId, shares: holding.shares };
      }
    }
    if (aiPlayer.cash > (aiPlayer.aiStrategy === 'ECONOMY' ? 9000 : 12000)) {
      const candidates = stockMarket.stocks
        .filter(stock => stock.change >= -2)
        .sort((a, b) => (b.change - a.change) || (a.price - b.price));
      const stock = candidates[0];
      if (stock) {
        const reserve = aiPlayer.aiStrategy === 'ECONOMY' ? 5500 : 8000;
        return { action: 'BUY', stockId: stock.id, shares: Math.max(5, Math.min(30, Math.floor((aiPlayer.cash - reserve) / stock.price))) };
      }
    }
    return null;
  }

  static chooseRoute(aiPlayer, options, gameState) {
    const score = (tileId) => {
      const tile = gameState.getTile(tileId);
      const property = gameState.propertyManager.getProperty(tileId);
      if (!tile) return -100;
      if (tile.type === 'GOD_FORTUNE' || tile.type === 'GOD_EARTH') return 80;
      if (tile.type === 'GOD_MISFORTUNE' || tile.type === 'GOD_BAD') return -80;
      if ((tile.type === 'PROPERTY' || tile.type === 'BIG_PROPERTY') && property?.owner === null && aiPlayer.cash > (tile.price || 0) + 1200) {
        const groupOwned = gameState.mapDefinition.tiles.filter(item => item.group === tile.group
          && gameState.propertyManager.getProperty(item.id)?.owner === aiPlayer.id).length;
        return (tile.large ? 90 : 50) + groupOwned * 22;
      }
      if ((tile.type === 'PROPERTY' || tile.type === 'BIG_PROPERTY') && property?.owner !== null && property.owner !== aiPlayer.id) {
        const owner = gameState.players[property.owner];
        if (gameState.gameMode === 'TEAM' && owner?.teamId === aiPlayer.teamId) return 30;
        return -gameState.propertyManager.calculateToll(tileId, gameState.newsEffect);
      }
      if (tile.type === 'CARD_SHOP') return 25;
      if (tile.type === 'BANK' && aiPlayer.cash > 10000) return 28;
      if (tile.type === 'LOTTERY' && gameState.lottery.pot > 5000) return 20;
      if (tile.type === 'MAGIC_HOUSE') return 35;
      return 0;
    };
    return [...options].sort((a, b) => score(b) - score(a))[0];
  }
}
