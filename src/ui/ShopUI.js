import { cardManager } from '../game/CardManager.js';
import { ITEMS } from '../game/ContentRegistry.js';
import { CARD_CAPACITY, ITEM_CAPACITY } from '../game/InventoryManager.js';

export class ShopUI {
  constructor(gameState, audioManager, onUseCardCallback, onUpdateHUD, gameEngine = null) {
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.onUseCardCallback = onUseCardCallback;
    this.onUpdateHUD = onUpdateHUD;
    this.gameEngine = gameEngine;

    this.shopModal = document.getElementById('modal-shop');
    this.shopGrid = document.getElementById('shop-card-grid');
    this.shopUserPoints = document.getElementById('shop-user-points');
    this.shopTitle = document.getElementById('shop-title');
    this.shopSubtitle = document.getElementById('shop-subtitle');
    this.shopVisitBanner = document.getElementById('shop-visit-banner');
    this.shopOffer = null;
    this.shopCloseResolver = null;

    this.inventoryModal = document.getElementById('modal-inventory');
    this.inventoryGrid = document.getElementById('inventory-card-grid');

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('shop-modal-close').addEventListener('click', () => this.hideShop());
    document.getElementById('inventory-modal-close').addEventListener('click', () => this.hideInventory());
  }

  showShop({ offer = null, awaitClose = false } = {}) {
    this.shopOffer = offer;
    this.shopTitle.textContent = offer ? `🏬 ${offer.tileName}` : '🏬 道具卡片商店';
    this.shopSubtitle.textContent = offer
      ? `第 ${offer.round} 轮限定货架 · 到店专享 ${Math.round(offer.discountRate * 100)}% 折扣`
      : '完整目录 · 掷骰前自由兑换';
    this.shopVisitBanner.classList.toggle('hidden', !offer);
    this.shopVisitBanner.innerHTML = offer ? `
      <strong>✨ 到店会员价已生效</strong>
      <span>到店获赠 ${offer.bonusPoints || 0} PTS；本轮供应 ${offer.cardIds.length} 张卡片与 ${offer.itemIds.length} 件道具，下一轮自动更新。</span>
      <em>${offer.premium ? 'PREMIUM STORE' : 'ROUND SPECIAL'}</em>
    ` : '';
    this.shopModal.classList.remove('hidden');
    this.renderShop();
    if (!awaitClose) return Promise.resolve();
    return new Promise(resolve => { this.shopCloseResolver = resolve; });
  }

  hideShop() {
    this.shopModal.classList.add('hidden');
    this.shopOffer = null;
    const resolve = this.shopCloseResolver;
    this.shopCloseResolver = null;
    resolve?.();
  }

  showInventory() {
    this.inventoryModal.classList.remove('hidden');
    this.renderInventory();
  }

  hideInventory() {
    this.inventoryModal.classList.add('hidden');
  }

  renderShop() {
    const curPlayer = this.gameState.getCurrentPlayer();
    this.shopUserPoints.textContent = curPlayer.cardPoints;
    this.shopGrid.innerHTML = '';

    const cards = this.shopOffer
      ? this.shopOffer.cardIds.map(cardId => cardManager.getCardById(cardId)).filter(Boolean)
      : cardManager.getAllCards();
    cards.forEach(card => {
      const finalCost = this.gameEngine
        ? this.gameEngine.getCardCost(curPlayer, card, this.shopOffer?.tileId)
        : (curPlayer.skillName === '商业奇才' ? Math.round(card.cost * 0.85) : card.cost);

      const item = document.createElement('div');
      item.className = 'shop-card-item';

      const iconContent = card.cardImg
        ? `<img src="${card.cardImg}" class="card-thumb-img" alt="${card.name}">`
        : `<div class="card-icon">${card.icon}</div>`;

      item.innerHTML = `
        ${iconContent}
        <div class="card-title">${card.name}</div>
        <div class="card-desc">${card.desc}</div>
        <div class="card-cost">${finalCost} PTS ${card.cost !== finalCost ? `<del style="font-size:0.75rem;color:#888;">${card.cost}</del>` : ''}</div>
        <button class="btn-primary btn-sm btn-buy-card">兑换卡片</button>
      `;

      item.querySelector('.btn-buy-card').addEventListener('click', () => {
        const result = this.gameEngine
          ? this.gameEngine.execute({ type: 'BUY_CARD', playerId: curPlayer.id, payload: { cardId: card.id, tileId: this.shopOffer?.tileId } })
          : { success: curPlayer.cardPoints >= finalCost };
        if (result.success) {
          if (!this.gameEngine) {
            curPlayer.cardPoints -= finalCost;
            curPlayer.cards.push(card.id);
          }
          this.audioManager.playCardSpell();
          this.renderShop();
          if (this.onUpdateHUD) {
            this.onUpdateHUD();
          }
        } else {
          this.gameState.addLog(`⚠️ ${result.reason || '无法兑换该卡片'}`, 'danger');
          if (this.onUpdateHUD) this.onUpdateHUD();
        }
      });

      this.shopGrid.appendChild(item);
    });

    const tools = this.shopOffer
      ? this.shopOffer.itemIds.map(itemId => ITEMS.find(item => item.id === itemId)).filter(Boolean)
      : ITEMS.filter(item => item.cost !== null);
    tools.forEach(tool => {
      const finalCost = this.gameEngine ? this.gameEngine.getItemCost(curPlayer, tool, this.shopOffer?.tileId) : tool.cost;
      const item = document.createElement('div');
      item.className = 'shop-card-item shop-tool-item';
      item.innerHTML = `
        <div class="card-icon">${tool.icon}</div>
        <div class="card-title">${tool.name}</div>
        <div class="card-desc">${tool.description}</div>
        <div class="card-cost">${finalCost} PTS · 道具 ${tool.cost !== finalCost ? `<del style="font-size:0.75rem;color:#888;">${tool.cost}</del>` : ''}</div>
        <button class="btn-primary btn-sm btn-buy-tool">购买道具</button>
      `;
      item.querySelector('.btn-buy-tool').addEventListener('click', () => {
        const result = this.gameEngine.execute({ type: 'BUY_ITEM', playerId: curPlayer.id, payload: { itemId: tool.id, tileId: this.shopOffer?.tileId } });
        if (result.success) this.audioManager.playCardSpell();
        else this.gameState.addLog(`⚠️ ${result.reason}`, 'danger');
        this.renderShop();
        this.onUpdateHUD?.();
      });
      this.shopGrid.appendChild(item);
    });
  }

  renderInventory() {
    const curPlayer = this.gameState.getCurrentPlayer();
    this.inventoryGrid.innerHTML = '';

    if ((!curPlayer.cards || curPlayer.cards.length === 0) && (!curPlayer.items || curPlayer.items.length === 0)) {
      this.inventoryGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#aaa;padding:20px;">背包空空如也，快去卡片商店兑换吧！</div>';
      return;
    }

    curPlayer.cards.forEach((cardId, index) => {
      const card = cardManager.getCardById(cardId);
      if (!card) return;

      const item = document.createElement('div');
      item.className = 'shop-card-item';

      const iconContent = card.cardImg
        ? `<img src="${card.cardImg}" class="card-thumb-img" alt="${card.name}">`
        : `<div class="card-icon">${card.icon}</div>`;

      item.innerHTML = `
        ${iconContent}
        <div class="card-title">${card.name}</div>
        <div class="card-desc">${card.desc}</div>
        <div class="card-cost">卡片 ${curPlayer.cards.length}/${CARD_CAPACITY}</div>
        <button class="btn-primary btn-sm btn-use-card-action">使用卡片</button>
        <button class="btn-secondary btn-sm btn-sell-card-action">出售</button>
      `;

      item.querySelector('.btn-use-card-action').addEventListener('click', () => {
        this.hideInventory();
        if (this.onUseCardCallback) {
          this.onUseCardCallback(cardId, index, 'CARD');
        }
      });
      item.querySelector('.btn-sell-card-action').addEventListener('click', () => {
        this.gameEngine.execute({ type: 'SELL_INVENTORY', playerId: curPlayer.id, payload: { kind: 'CARD', contentId: cardId } });
        this.renderInventory();
        this.onUpdateHUD?.();
      });

      this.inventoryGrid.appendChild(item);
    });

    curPlayer.items?.forEach((itemId, index) => {
      const tool = ITEMS.find(item => item.id === itemId);
      if (!tool) return;
      const item = document.createElement('div');
      item.className = 'shop-card-item shop-tool-item';
      item.innerHTML = `
        <div class="card-icon">${tool.icon}</div>
        <div class="card-title">${tool.name}</div>
        <div class="card-desc">${tool.description}</div>
        <div class="card-cost">道具 ${curPlayer.items.length}/${ITEM_CAPACITY}</div>
        <button class="btn-primary btn-sm btn-use-tool-action">使用道具</button>
        <button class="btn-secondary btn-sm btn-sell-tool-action">出售 ${tool.sellPrice} PTS</button>
      `;
      item.querySelector('.btn-use-tool-action').onclick = () => {
        this.hideInventory();
        this.onUseCardCallback?.(itemId, index, 'ITEM');
      };
      item.querySelector('.btn-sell-tool-action').onclick = () => {
        this.gameEngine.execute({ type: 'SELL_INVENTORY', playerId: curPlayer.id, payload: { kind: 'ITEM', contentId: itemId } });
        this.renderInventory();
        this.onUpdateHUD?.();
      };
      this.inventoryGrid.appendChild(item);
    });
  }
}
