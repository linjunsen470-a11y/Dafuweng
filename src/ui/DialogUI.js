import confetti from 'canvas-confetti';

export class DialogUI {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.landModal = document.getElementById('modal-land');
    this.remoteDiceModal = document.getElementById('modal-remote-dice');
    this.victoryModal = document.getElementById('modal-victory');

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('land-modal-close').addEventListener('click', () => this.hideLandModal());
  }

  showLandPurchase({ tileData, currentLevel, player, onBuy, onUpgrade, onPass }) {
    this.landModal.classList.remove('hidden');

    const titleEl = document.getElementById('land-modal-title');
    const badgeEl = document.getElementById('land-level-badge');
    const nameEl = document.getElementById('land-name');
    const priceEl = document.getElementById('land-price');
    const tollEl = document.getElementById('land-toll');
    const nextTollEl = document.getElementById('land-next-toll');
    const actionsEl = document.getElementById('land-modal-actions');

    titleEl.textContent = `到达: ${tileData.name}`;
    badgeEl.textContent = currentLevel === 0 ? 'LV 0 已拥有空地' : `LV ${currentLevel} 建筑`;
    nameEl.textContent = tileData.name;
    priceEl.textContent = `$${tileData.price.toLocaleString()}`;

    const currentToll = tileData.tolls[currentLevel] || tileData.tolls[0];
    const nextToll = tileData.tolls[Math.min(currentLevel + 1, 3)];

    tollEl.textContent = `$${currentToll.toLocaleString()}`;
    nextTollEl.textContent = `$${nextToll.toLocaleString()}`;

    actionsEl.innerHTML = '';

    if (onBuy) {
      let finalPrice = tileData.price;
      if (player && player.skillName === '商业奇才') {
        finalPrice = Math.round(tileData.price * 0.85);
      }
      const priceText = finalPrice !== tileData.price
        ? `购买土地 ($${finalPrice.toLocaleString()}) <span style="font-size:0.8em;opacity:0.8;margin-left:4px;">(折前原价:$${tileData.price.toLocaleString()})</span>`
        : `购买土地 ($${finalPrice.toLocaleString()})`;

      const btnBuy = document.createElement('button');
      btnBuy.id = 'btn-land-buy';
      btnBuy.className = 'btn-primary';
      btnBuy.innerHTML = priceText;
      btnBuy.onclick = () => {
        this.hideLandModal();
        onBuy();
      };
      actionsEl.appendChild(btnBuy);
    } else if (currentLevel < 3 && onUpgrade) {
      let finalCost = tileData.buildCost;
      if (player && player.skillName === '商业奇才') {
        finalCost = Math.round(tileData.buildCost * 0.85);
      }
      const costText = finalCost !== tileData.buildCost
        ? `升级建筑 ($${finalCost.toLocaleString()}) <span style="font-size:0.8em;opacity:0.8;margin-left:4px;">(折前原价:$${tileData.buildCost.toLocaleString()})</span>`
        : `升级建筑 ($${finalCost.toLocaleString()})`;

      const btnUpgrade = document.createElement('button');
      btnUpgrade.id = 'btn-land-upgrade';
      btnUpgrade.className = 'btn-primary';
      btnUpgrade.innerHTML = costText;
      btnUpgrade.onclick = () => {
        this.hideLandModal();
        onUpgrade();
      };
      actionsEl.appendChild(btnUpgrade);
    }

    const btnPass = document.createElement('button');
    btnPass.id = 'btn-land-pass';
    btnPass.className = 'btn-secondary';
    btnPass.textContent = '放弃操作';
    btnPass.onclick = () => {
      this.hideLandModal();
      if (onPass) onPass();
    };
    actionsEl.appendChild(btnPass);
  }

  hideLandModal() {
    this.landModal.classList.add('hidden');
  }

  showRemoteDice(onSelect) {
    this.remoteDiceModal.classList.remove('hidden');
    const btns = this.remoteDiceModal.querySelectorAll('.dice-choice-btn');
    btns.forEach(btn => {
      btn.onclick = () => {
        const val = parseInt(btn.dataset.val, 10);
        this.remoteDiceModal.classList.add('hidden');
        onSelect(val);
      };
    });
  }

  chooseTarget({ title, options }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal';
      overlay.innerHTML = `
        <div class="glass-card modal-box">
          <div class="modal-header"><h2>${title}</h2></div>
          <div class="shop-card-grid target-choice-grid"></div>
          <div class="modal-actions"><button class="btn-secondary target-cancel">取消</button></div>
        </div>
      `;
      const finish = (value) => {
        overlay.remove();
        resolve(value);
      };
      const grid = overlay.querySelector('.target-choice-grid');
      options.forEach((option) => {
        const button = document.createElement('button');
        button.className = 'shop-card-item target-choice';
        button.innerHTML = `<strong>${option.label}</strong>${option.description ? `<small>${option.description}</small>` : ''}`;
        button.onclick = () => finish(option.id);
        grid.appendChild(button);
      });
      overlay.querySelector('.target-cancel').onclick = () => finish(null);
      document.body.appendChild(overlay);
    });
  }

  showVictory(winner, onRestart, gameState = null) {
    this.victoryModal.classList.remove('hidden');
    document.getElementById('winner-name').textContent = `👑 大富翁诞生: ${winner.name}`;
    document.getElementById('winner-desc').textContent = `恭喜获胜！最终现金 $${winner.cash.toLocaleString()}`;
    const stats = document.getElementById('winner-stats');
    if (gameState) {
      const assets = gameState.calculateAssetBreakdown(winner);
      stats.innerHTML = `
        <span>现金：$${assets.cash.toLocaleString()}</span>
        <span>土地：$${assets.landValue.toLocaleString()} · 建筑：$${assets.buildingValue.toLocaleString()}</span>
        <span>股票：$${assets.stockValue.toLocaleString()} · 地产 ${assets.propertyCount} 处</span>
        <strong>最终总资产：$${assets.total.toLocaleString()}</strong>
        <span>${gameState.winReason === 'NET_WORTH' ? `达到 ${gameState.maxRounds} 轮上限，按总资产结算` : '其他玩家均已破产'}</span>
      `;
    }

    this.audioManager.playVictory();

    // 庆祝烟花
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });

    document.getElementById('btn-restart').onclick = () => {
      this.victoryModal.classList.add('hidden');
      if (onRestart) onRestart();
    };
  }
}
