import { CardRules } from './CardRules.js';
import { SaveManager } from './SaveManager.js';
import { TileType } from './BoardData.js';
import { eventManager } from './EventManager.js';

/**
 * Rules-facing facade. Presentation code asks this object for legal actions and
 * persistence; UI modules never need to understand serialized state.
 */
export class GameEngine {
  constructor(gameState, { saveManager = new SaveManager() } = {}) {
    this.state = gameState;
    this.cards = new CardRules(gameState);
    this.saves = saveManager;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event) {
    this.listeners.forEach(listener => listener(event, this.state));
  }

  getCardAction(player, cardId) {
    return this.cards.getLegalAction(player, cardId);
  }

  inspectLanding(player, tileId) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    if (tile.type !== TileType.PROPERTY) return { kind: 'SPECIAL', tile, property };
    if (property.owner === null) return { kind: 'PURCHASE', tile, property };
    if (property.owner === player.id) {
      return { kind: property.level < 3 ? 'UPGRADE' : 'OWN_MAX', tile, property };
    }
    return { kind: 'RENT', tile, property, owner: this.state.players[property.owner] };
  }

  purchaseProperty(player, tileId) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    if (!tile || tile.type !== TileType.PROPERTY || property.owner !== null) {
      return { success: false, reason: '该地产当前不可购买' };
    }
    if (player.godType === 'BAD') {
      this.state.addLog(`📉 ${player.name} 受到衰运影响，买地失败！`, 'danger');
      return { success: false, reason: '衰运状态禁止买地' };
    }
    let cost = tile.price;
    if (player.godType === 'LUCK') cost = 0;
    else if (player.skillName === '商业奇才') cost = Math.round(cost * 0.85);
    if (player.cash < cost) {
      this.state.addLog(`⚠️ ${player.name} 现金不足，无法购买【${tile.name}】。`, 'danger');
      return { success: false, reason: '现金不足', cost };
    }
    player.cash -= cost;
    this.state.propertyManager.buyProperty(tileId, player.id);
    this.state.addLog(`🏗️ ${player.name} 成功购买【${tile.name}】(花费 $${cost.toLocaleString()})！`, 'success');
    return { success: true, type: 'PROPERTY_PURCHASED', tileId, level: 0, cost };
  }

  upgradeProperty(player, tileId) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    if (!tile || property.owner !== player.id || property.level >= 3) {
      return { success: false, reason: '该地产当前不可升级' };
    }
    if (player.godType === 'BAD') {
      this.state.addLog(`📉 ${player.name} 受到衰运影响，升级失败！`, 'danger');
      return { success: false, reason: '衰运状态禁止升级' };
    }
    let cost = tile.buildCost;
    if (player.godType === 'LUCK') cost = 0;
    else if (player.skillName === '商业奇才') cost = Math.round(cost * 0.85);
    if (player.cash < cost) {
      this.state.addLog(`⚠️ ${player.name} 现金不足，无法升级【${tile.name}】。`, 'danger');
      return { success: false, reason: '现金不足', cost };
    }
    player.cash -= cost;
    this.state.propertyManager.upgradeProperty(tileId);
    this.state.addLog(`✨ ${player.name} 将【${tile.name}】升级至 LV ${property.level}(花费 $${cost.toLocaleString()})！`, 'gold');
    return { success: true, type: 'PROPERTY_UPGRADED', tileId, level: property.level, cost };
  }

  settleRent(player, tileId) {
    const tile = this.state.getTile(tileId);
    const property = this.state.propertyManager.getProperty(tileId);
    const owner = this.state.players[property.owner];
    if (!owner || owner.id === player.id) return { success: false, reason: '没有应付租金' };
    if (player.godType === 'FORTUNE' || player.rentShieldActiveThisTurn) {
      this.state.addLog(`🛡️ ${player.name} 的免租效果抵消了【${tile.name}】过路费！`, 'gold');
      return { success: true, type: 'RENT_WAIVED', amount: 0 };
    }
    if (player.skillName === '股市高手' && this.state.rng.next() < 0.25) {
      this.state.addLog(`💎 ${player.name} 触发商业人脉，免除【${tile.name}】过路费！`, 'gold');
      return { success: true, type: 'RENT_WAIVED', amount: 0 };
    }
    let amount = this.state.propertyManager.calculateToll(tileId, this.state.newsEffect);
    if (player.godType === 'MISFORTUNE') amount *= 2;
    if (owner.skillName === '土地公庇护') amount = Math.round(amount * 1.2);
    player.cash -= amount;
    owner.cash += amount;
    this.state.addLog(`💸 ${player.name} 向 ${owner.name} 支付【${tile.name}】过路费 $${amount.toLocaleString()}！`, 'danger');
    this.state.checkBankrupt(player);
    return { success: true, type: 'RENT_PAID', amount, ownerId: owner.id };
  }

  resolveSpecialLanding(player, tileId) {
    const tile = this.state.getTile(tileId);
    const duration = player.skillName === '石油大亨' ? 4 : 3;
    if (tile.type === TileType.CARD_SHOP) {
      const amount = player.skillName === '疾风忍术' ? 120 : 60;
      player.cardPoints += amount;
      this.state.addLog(`🃏 ${player.name} 获得 ${amount} 卡片积分！`, 'accent');
      return { type: 'CARD_POINTS', amount };
    }
    if (tile.type === TileType.BANK) {
      const amount = Math.max(0, Math.round(player.cash * 0.1));
      player.cash += amount;
      this.state.addLog(`🏦 ${player.name} 获得存款利息 $${amount.toLocaleString()}！`, 'gold');
      return { type: 'CASH_GAINED', amount };
    }
    if (tile.type === TileType.PRISON) {
      player.jailTurns = 2;
      this.state.addLog(`🚔 ${player.name} 入狱，暂停行动 2 回合！`, 'danger');
      return { type: 'JAILED' };
    }
    if (tile.type === TileType.HOSPITAL) {
      player.hospitalTurns = 1;
      this.state.addLog(`🏥 ${player.name} 入院疗养，暂停行动 1 回合！`, 'danger');
      return { type: 'HOSPITALIZED' };
    }
    if (tile.type === TileType.CHANCE) {
      const chance = eventManager.drawChanceCard();
      if (chance.isGain || player.skillName === '自然之福') {
        player.cash += Math.abs(chance.amount);
        this.state.addLog(`❓ 【${chance.title}】获得 $${Math.abs(chance.amount).toLocaleString()}！`, 'gold');
        return { type: 'CASH_GAINED', amount: Math.abs(chance.amount), chance };
      }
      if (player.negativeImmuneActiveThisTurn) {
        this.state.addLog(`🍀 ${player.name} 抵消了【${chance.title}】。`, 'gold');
        return { type: 'NEGATIVE_BLOCKED', chance };
      }
      player.cash -= chance.amount;
      this.state.addLog(`❓ 【${chance.title}】损失 $${chance.amount.toLocaleString()}！`, 'danger');
      this.state.checkBankrupt(player);
      return { type: 'CASH_LOST', amount: chance.amount, chance };
    }
    const spiritByType = {
      [TileType.GOD_MISFORTUNE]: 'MISFORTUNE',
      [TileType.GOD_EARTH]: 'EARTH',
      [TileType.GOD_BAD]: 'BAD'
    };
    if (tile.type === TileType.GOD_FORTUNE || spiritByType[tile.type]) {
      player.godType = tile.type === TileType.GOD_FORTUNE
        ? (tileId === 28 ? 'LUCK' : 'FORTUNE')
        : spiritByType[tile.type];
      player.godTurns = player.godType === 'BAD' ? 3 : duration;
      this.state.addLog(`✨ ${player.name} 获得运势精灵【${player.godType}】${player.godTurns} 回合。`, player.godType === 'BAD' || player.godType === 'MISFORTUNE' ? 'danger' : 'gold');
      return { type: 'STATUS_APPLIED', status: player.godType, duration: player.godTurns };
    }
    if (tile.type === TileType.STOCK) {
      this.state.addLog(`📈 ${player.name} 到达【${tile.name}】。`, 'accent');
      return { type: 'OPEN_STOCK' };
    }
    return { type: 'NO_ACTION' };
  }

  autoSave() {
    return this.saves.saveAuto(this.state.createSnapshot());
  }

  saveManual(name) {
    return this.saves.saveManual(this.state.createSnapshot(), name);
  }

  restore(snapshot) {
    this.state.restoreSnapshot(snapshot);
    this.emit({ type: 'GAME_RESTORED' });
  }
}
