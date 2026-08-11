import { MAX_PROPERTY_LEVEL } from '../game/GameRules.js';

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
    const buildingArtEl = document.getElementById('land-building-art');
    const nameEl = document.getElementById('land-name');
    const priceEl = document.getElementById('land-price');
    const tollEl = document.getElementById('land-toll');
    const nextTollEl = document.getElementById('land-next-toll');
    const actionsEl = document.getElementById('land-modal-actions');

    titleEl.textContent = `到达: ${tileData.name}`;
    badgeEl.textContent = currentLevel === 0 ? 'LV 0 待开发空地' : `LV ${currentLevel} 建筑`;
    buildingArtEl.style.backgroundPosition = `${Math.min(currentLevel, MAX_PROPERTY_LEVEL) * 25}% 0%`;
    nameEl.textContent = tileData.name;
    priceEl.textContent = `$${tileData.price.toLocaleString()}`;

    const currentToll = tileData.tolls[currentLevel] || tileData.tolls[0];
    const nextToll = tileData.tolls[Math.min(currentLevel + 1, MAX_PROPERTY_LEVEL)];

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
    } else if (currentLevel < MAX_PROPERTY_LEVEL && onUpgrade) {
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

  chooseDiceValue() {
    return new Promise(resolve => this.showRemoteDice(resolve));
  }

  playMinigame(gameId) {
    const names = {
      HARBOR_SORT: '港湾分拣',
      SKY_COINS: '云端金币',
      ROUTE_MEMORY: '航线记忆'
    };
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal minigame-modal';
      overlay.innerHTML = `
        <div class="glass-card modal-box minigame-box">
          <div class="modal-header"><h2>🎮 ${names[gameId] || '财富挑战'}</h2></div>
          <p>在 6 秒内尽可能多地点击移动目标。</p>
          <div class="minigame-stage"><button class="minigame-target" aria-label="小游戏目标">✨</button></div>
          <strong class="minigame-score">得分：0</strong>
        </div>
      `;
      const stage = overlay.querySelector('.minigame-stage');
      const target = overlay.querySelector('.minigame-target');
      const scoreLabel = overlay.querySelector('.minigame-score');
      let score = 0;
      let moveIndex = 1;
      const move = () => {
        moveIndex = (moveIndex * 17 + 23) % 97;
        target.style.left = `${(moveIndex * 37) % 82}%`;
        target.style.top = `${(moveIndex * 53) % 72}%`;
      };
      target.onclick = () => {
        score = Math.min(100, score + 10);
        scoreLabel.textContent = `得分：${score}`;
        move();
      };
      document.body.appendChild(overlay);
      move();
      const mover = setInterval(move, 650);
      setTimeout(() => {
        clearInterval(mover);
        overlay.remove();
        resolve(score);
      }, 6000);
    });
  }

  showHotseatPass(player) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal hotseat-pass-modal';
      overlay.innerHTML = `
        <div class="glass-card modal-box hotseat-pass-box">
          <div class="crown-icon">🤝</div>
          <h2>请交给 ${player.name}</h2>
          <p>确认周围没有其他玩家查看手牌后再继续。</p>
          <button class="btn-primary btn-large hotseat-ready">我准备好了</button>
        </div>
      `;
      overlay.querySelector('.hotseat-ready').onclick = () => {
        overlay.remove();
        resolve();
      };
      document.body.appendChild(overlay);
    });
  }

  showHelp(firstRun = false) {
    const overlay = document.createElement('div');
    overlay.className = 'modal rules-help-modal';
    overlay.innerHTML = `
      <div class="glass-card modal-box large-modal rules-help-box">
        <div class="modal-header"><h2>${firstRun ? '欢迎来到富翁帝国 3D' : '规则百科与快捷键'}</h2><button class="close-modal" aria-label="关闭">&times;</button></div>
        <div class="rules-help-grid">
          <section><h3>🎲 回合</h3><p>掷骰前可交易股票、购买或使用卡片道具。机车最多 2 颗骰子，汽车和工程车最多 3 颗。</p></section>
          <section><h3>🏙️ 地产</h3><p>普通地产可发展住宅或连锁店；大型地产可建设公园、商场、旅馆、能源驿站或研究所。</p></section>
          <section><h3>📈 公司</h3><p>六家公司与股票联动。最大股东成为董事长，公司营收、利息、分红和乐透每 5 轮结算。</p></section>
          <section><h3>🧰 道具</h3><p>卡片与道具各有 8 格容量。道路实体会在移动经过时触发，爆炸会摧毁载具。</p></section>
          <section><h3>⌨️ 快捷键</h3><p><kbd>Space</kbd> 掷骰；鼠标拖动旋转地图；滚轮缩放；右上角按钮切换视角、天气和时间。</p></section>
          <section><h3>🏆 获胜</h3><p>令对手破产，或在轮次上限时拥有最高总资产。组队和领主模式使用各自团队目标。</p></section>
        </div>
        <button class="btn-primary rules-help-ready">${firstRun ? '开始探索' : '知道了'}</button>
      </div>
    `;
    const close = () => {
      overlay.remove();
      try { localStorage.setItem('fortune-empire:tutorial-seen', '1'); } catch {}
    };
    overlay.querySelector('.close-modal').onclick = close;
    overlay.querySelector('.rules-help-ready').onclick = close;
    document.body.appendChild(overlay);
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
    const teamText = gameState?.winningTeamId !== null && gameState?.winningTeamId !== undefined
      ? `队伍 ${gameState.winningTeamId} 获胜！`
      : '恭喜获胜！';
    document.getElementById('winner-desc').textContent = `${teamText} 最终现金 $${winner.cash.toLocaleString()}`;
    const stats = document.getElementById('winner-stats');
    if (gameState) {
      const assets = gameState.calculateAssetBreakdown(winner);
      stats.innerHTML = `
        <span>现金：$${assets.cash.toLocaleString()}</span>
        <span>存款：$${assets.deposit.toLocaleString()}</span>
        <span>土地：$${assets.landValue.toLocaleString()} · 建筑：$${assets.buildingValue.toLocaleString()}</span>
        <span>股票：$${assets.stockValue.toLocaleString()} · 地产 ${assets.propertyCount} 处</span>
        <strong>最终总资产：$${assets.total.toLocaleString()}</strong>
        <span>${['NET_WORTH', 'TEAM_NET_WORTH'].includes(gameState.winReason) ? `达到 ${gameState.maxRounds} 轮上限，按总资产结算` : gameState.winReason === 'LORD_DEFEATED' ? '领主已经破产，挑战者获胜' : '其他玩家或队伍均已破产'}</span>
      `;
    }

    this.audioManager.playVictory();

    // 庆祝烟花
    void import('canvas-confetti').then(({ default: confetti }) => confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    })).catch(() => {});

    document.getElementById('btn-restart').onclick = () => {
      this.victoryModal.classList.add('hidden');
      if (onRestart) onRestart();
    };
  }
}
