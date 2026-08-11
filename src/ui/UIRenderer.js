export class UIRenderer {
  constructor(gameState) {
    this.gameState = gameState;
    this.initDOMReferences();
  }

  initDOMReferences() {
    this.hudLayer = document.getElementById('hud-layer');
    this.setupScreen = document.getElementById('setup-screen');
    this.roundCount = document.getElementById('round-count');
    this.mapNameLabel = document.getElementById('map-name-label');
    this.newsTickerText = document.getElementById('news-ticker-text');
    this.playersList = document.getElementById('players-list');
    this.turnIndicator = document.getElementById('turn-indicator');
    this.logMessages = document.getElementById('log-messages');
    this.cardCountBadge = document.getElementById('card-count-badge');
    this.btnRoll = document.getElementById('btn-roll');
    this.diceCountSelect = document.getElementById('dice-count-select');
  }

  renderHUD() {
    if (this.gameState.phase === 'SETUP') {
      this.setupScreen.classList.add('active');
      this.hudLayer.classList.add('hidden');
      return;
    }

    this.setupScreen.classList.remove('active');
    this.hudLayer.classList.remove('hidden');

    this.roundCount.textContent = this.gameState.round;
    if (this.mapNameLabel) this.mapNameLabel.textContent = this.gameState.mapDefinition?.name || '财富地图';
    if (this.newsTickerText) {
      const latestNews = this.gameState.newsHistory?.[0];
      this.newsTickerText.textContent = latestNews
        ? `第 ${latestNews.round} 轮 · 【${latestNews.category}】${latestNews.title} — ${latestNews.desc}`
        : '新闻中心在线：城市经济、地产与股市动态将在这里实时播报';
    }

    this.renderPlayersList();

    const curPlayer = this.gameState.getCurrentPlayer();
    if (curPlayer) {
      if (curPlayer.isAI) {
        this.turnIndicator.innerHTML = `
          <span style="color:${curPlayer.color}">●</span> 🤖 <strong>${curPlayer.name}</strong> 正在思考与行动中...
        `;
        this.btnRoll.style.opacity = '0.5';
        this.btnRoll.style.pointerEvents = 'none';
      } else {
        this.turnIndicator.innerHTML = `
          <span style="color:${curPlayer.color}">●</span> 👤 <strong>你的回合</strong>：请点击【掷骰子】或按 [空格键]！
        `;
        const canRoll = this.gameState.phase === 'PRE_ROLL_ACTION';
        this.btnRoll.style.opacity = canRoll ? '1' : '0.5';
        this.btnRoll.style.pointerEvents = canRoll ? 'all' : 'none';
      }
      this.cardCountBadge.textContent = (curPlayer.cards?.length || 0) + (curPlayer.items?.length || 0);
      if (this.diceCountSelect) {
        const limit = curPlayer.vehicle === 'MOTOR' ? 2 : ['CAR', 'ENGINEER'].includes(curPlayer.vehicle) ? 3 : 1;
        [...this.diceCountSelect.options].forEach(option => { option.disabled = Number(option.value) > limit; });
        this.diceCountSelect.value = String(Math.min(limit, curPlayer.selectedDiceCount || 1));
        this.diceCountSelect.disabled = curPlayer.isAI || this.gameState.phase !== 'PRE_ROLL_ACTION';
      }
    }

    this.renderLogs();
  }

  renderPlayersList() {
    this.playersList.innerHTML = '';
    this.gameState.players.forEach((player) => {
      const isCur = player.id === this.gameState.currentPlayerIndex;
      const card = document.createElement('div');
      card.className = `player-card ${isCur ? 'active-turn' : ''} ${player.isBankrupt ? 'bankrupt' : ''}`;
      card.dataset.playerId = String(player.id);

      const netWorth = this.gameState.calculateNetWorth(player);

      let buffHtml = '';
      if (player.godType === 'FORTUNE') {
        buffHtml += `<span class="buff-tag buff-god-gold">🧙‍♂️ 免租精灵(${Math.max(1, player.godTurns)}T)</span>`;
      } else if (player.godType === 'LUCK') {
        buffHtml += `<span class="buff-tag" style="background:#00d2d3;color:#fff;">🌟 建造精灵(${Math.max(1, player.godTurns)}T)</span>`;
      } else if (player.godType === 'EARTH') {
        buffHtml += `<span class="buff-tag" style="background:#2ed573;color:#fff;">⛰️ 土地公(${player.godTurns}T)</span>`;
      } else if (player.godType === 'MISFORTUNE') {
        buffHtml += `<span class="buff-tag buff-god-poor">👻 穷神(${player.godTurns}T)</span>`;
      } else if (player.godType === 'BAD') {
        buffHtml += `<span class="buff-tag" style="background:#ff4757;color:#fff;">📉 衰神(${player.godTurns}T)</span>`;
      }

      if (player.turtleTurns > 0) {
        buffHtml += `<span class="buff-tag" style="background:#10ac84;color:#fff;">🐢 乌龟(${player.turtleTurns}T)</span>`;
      }
      if (player.hibernateTurns > 0) {
        buffHtml += `<span class="buff-tag" style="background:#74b9ff;color:#fff;">❄️ 冬眠(${player.hibernateTurns}T)</span>`;
      }
      if (player.sleepwalkTurns > 0) {
        buffHtml += `<span class="buff-tag" style="background:#6c5ce7;color:#fff;">🌙 梦游(${player.sleepwalkTurns}T)</span>`;
      }
      if (player.vehicle === 'CAR') {
        buffHtml += `<span class="buff-tag" style="background:#ff9f43;color:#fff;">🏎️ 汽车</span>`;
      } else if (player.vehicle === 'MOTOR') {
        buffHtml += `<span class="buff-tag" style="background:#f39c12;color:#fff;">🏍️ 机车</span>`;
      } else if (player.vehicle === 'ENGINEER') {
        buffHtml += `<span class="buff-tag" style="background:#636e72;color:#fff;">🚜 工程车(${player.engineeringTurns}T)</span>`;
      }
      if (player.jailTurns > 0) {
        buffHtml += `<span class="buff-tag" style="background:#ff4757;color:#fff;">🚔 监狱(${player.jailTurns}T)</span>`;
      }
      if (player.rentShieldTurns > 0) {
        buffHtml += `<span class="buff-tag" style="background:#0984e3;color:#fff;">🛡️ 免租(${player.rentShieldTurns}T)</span>`;
      }
      if (player.negativeImmuneTurns > 0) {
        buffHtml += `<span class="buff-tag" style="background:#00b894;color:#fff;">🍀 免疫(${player.negativeImmuneTurns}T)</span>`;
      }

      const avatarMarkup = player.avatarAtlas
        ? `<span class="player-avatar-atlas" role="img" aria-label="${player.name}" style="background-image:url('${player.avatarAtlas}');background-position:${player.avatarPosition}"></span>`
        : player.avatarImg
        ? `<img src="${player.avatarImg}" class="player-avatar-img" alt="${player.name}">`
        : `<span class="player-avatar">${player.avatar}</span>`;

      card.innerHTML = `
        <div class="card-top">
          <div class="player-name-group">
            ${avatarMarkup}
            <div>
              <div class="player-name" style="color:${player.color}">${player.name}</div>
              <div class="player-skill-badge" title="${player.skillDesc || ''}">⚡ ${player.skillName || '技能特长'}</div>
            </div>
          </div>
          <span class="player-tag">${player.isLord ? '👹 领主' : player.isAI ? '🤖 AI' : '👤 玩家'}${['TEAM', 'CHALLENGE'].includes(this.gameState.gameMode) ? ` · 队伍 ${player.teamId}` : ''}</span>
        </div>
        <div class="cash-display">$${player.cash.toLocaleString()}</div>
        <div class="player-details">
          <span>存款: $${(player.deposit || 0).toLocaleString()} · 总资产: $${netWorth.toLocaleString()}</span>
          <span>卡片积分: ${player.cardPoints}</span>
        </div>
        <div class="buff-icons">${buffHtml}</div>
      `;

      this.playersList.appendChild(card);
    });
  }

  renderLogs() {
    this.logMessages.innerHTML = '';
    this.gameState.logHistory.forEach(item => {
      const el = document.createElement('div');
      el.className = `log-item ${item.type}`;
      el.textContent = `[${item.time}] ${item.msg}`;
      this.logMessages.appendChild(el);
    });
    this.logMessages.scrollTop = this.logMessages.scrollHeight;
  }
}
