import { cardManager } from '../game/CardManager.js';

export class ShopUI {
  constructor(gameState, audioManager, onUseCardCallback, onUpdateHUD) {
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.onUseCardCallback = onUseCardCallback;
    this.onUpdateHUD = onUpdateHUD;

    this.shopModal = document.getElementById('modal-shop');
    this.shopGrid = document.getElementById('shop-card-grid');
    this.shopUserPoints = document.getElementById('shop-user-points');

    this.inventoryModal = document.getElementById('modal-inventory');
    this.inventoryGrid = document.getElementById('inventory-card-grid');

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('shop-modal-close').addEventListener('click', () => this.hideShop());
    document.getElementById('inventory-modal-close').addEventListener('click', () => this.hideInventory());
  }

  showShop() {
    this.shopModal.classList.remove('hidden');
    this.renderShop();
  }

  hideShop() {
    this.shopModal.classList.add('hidden');
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

    cardManager.getAllCards().forEach(card => {
      let finalCost = card.cost;
      if (curPlayer.skillName === '商业奇才') {
        finalCost = Math.round(card.cost * 0.85);
      }

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
        if (curPlayer.cardPoints >= finalCost) {
          curPlayer.cardPoints -= finalCost;
          curPlayer.cards.push(card.id);
          this.audioManager.playCardSpell();
          this.gameState.addLog(`🛒 ${curPlayer.name} 消费 ${finalCost} 积分兑换了【${card.name}】！`, 'accent');
          this.renderShop();
          if (this.onUpdateHUD) {
            this.onUpdateHUD();
          }
        } else {
          alert('卡片积分不足！踩中卡片屋可免费补充积分。');
        }
      });

      this.shopGrid.appendChild(item);
    });
  }

  renderInventory() {
    const curPlayer = this.gameState.getCurrentPlayer();
    this.inventoryGrid.innerHTML = '';

    if (!curPlayer.cards || curPlayer.cards.length === 0) {
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
        <button class="btn-primary btn-sm btn-use-card-action">使用卡片</button>
      `;

      item.querySelector('.btn-use-card-action').addEventListener('click', () => {
        this.hideInventory();
        if (this.onUseCardCallback) {
          this.onUseCardCallback(cardId, index);
        }
      });

      this.inventoryGrid.appendChild(item);
    });
  }
}
