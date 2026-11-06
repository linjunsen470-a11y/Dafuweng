import { cityPortrait } from './CityPortrait.js';
import { getGodRule } from '../game/GodRules.js';

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
    this.questPanel = document.getElementById('quest-panel');
    this.questList = document.getElementById('quest-list');
    this.questCount = document.getElementById('quest-count');
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
    this.renderQuests();

    const curPlayer = this.gameState.getCurrentPlayer();
    if (curPlayer) {
      if (curPlayer.isAI) {
        this.turnIndicator.innerHTML = `
          <span style="color:${curPlayer.color}">●</span> 🤖 <strong>${curPlayer.name}${curPlayer.direction === -1 ? ' · 逆向' : ''}</strong> 正在思考与行动中...
        `;
        this.btnRoll.style.opacity = '0.5';
        this.btnRoll.style.pointerEvents = 'none';
      } else {
        this.turnIndicator.innerHTML = `
          <span style="color:${curPlayer.color}">●</span> 👤 <strong>你的回合${curPlayer.direction === -1 ? ' · 逆向' : ''}</strong>：请点击【掷骰子】或按 [空格键]！
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

  renderQuests() {
    if (!this.questList) return;
    const quests = [...(this.gameState.activeQuests || [])].sort((a, b) => {
      const aCurrent = a.playerId === this.gameState.currentPlayerIndex ? 0 : 1;
      const bCurrent = b.playerId === this.gameState.currentPlayerIndex ? 0 : 1;
      return aCurrent - bCurrent || a.expiresRound - b.expiresRound;
    });
    if (this.questCount) this.questCount.textContent = String(quests.length);
    this.questPanel?.classList.toggle('has-quests', quests.length > 0);
    if (!quests.length) {
      this.questList.innerHTML = '<div class="quest-empty">命运格将签发跨回合委托</div>';
      return;
    }
    this.questList.innerHTML = quests.slice(0, 3).map(quest => {
      const player = this.gameState.players.find(item => item.id === quest.playerId);
      const percent = Math.round((quest.progress / Math.max(1, quest.target)) * 100);
      const rounds = Math.max(0, quest.expiresRound - this.gameState.round + 1);
      return `
        <article class="quest-card" data-quest-id="${quest.id}">
          <div class="quest-card-title"><span>${quest.icon} ${quest.title}</span><b>${quest.progress}/${quest.target}</b></div>
          <div class="quest-card-meta"><span style="color:${player?.color || '#dff8ff'}">${player?.name || '玩家'}</span><span>剩 ${rounds} 轮</span></div>
          <div class="quest-progress"><i style="width:${percent}%"></i></div>
          <div class="quest-description">${quest.description}</div>
        </article>`;
    }).join('');
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
      const godRule = getGodRule(player.godType);
      if (godRule) {
        const godClass = godRule.tone === 'danger' ? 'buff-god-poor' : 'buff-god-gold';
        buffHtml += `<span class="buff-tag ${godClass}" title="${godRule.description}">${godRule.icon} ${godRule.name}(${Math.max(1, player.godTurns)}T)</span>`;
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
      if (player.hospitalTurns > 0) {
        buffHtml += `<span class="buff-tag" style="background:#e84393;color:#fff;">🏥 住院(${player.hospitalTurns}T)</span>`;
      }
      if (player.hotelTurns > 0) {
        buffHtml += `<span class="buff-tag" style="background:#9b59b6;color:#fff;">🏨 入住(${player.hotelTurns}T)</span>`;
      }
      if (player.fuelBoostTurns > 0) {
        buffHtml += `<span class="buff-tag" style="background:#d35400;color:#fff;">⛽ 调校(${player.fuelBoostTurns}次)</span>`;
      }
      if (player.rentShieldTurns > 0) {
        buffHtml += `<span class="buff-tag" style="background:#0984e3;color:#fff;">🛡️ 免租(${player.rentShieldTurns}T)</span>`;
      }
      if (player.negativeImmuneTurns > 0) {
        buffHtml += `<span class="buff-tag" style="background:#00b894;color:#fff;">🍀 免疫(${player.negativeImmuneTurns}T)</span>`;
      }

      const portrait = cityPortrait(player, this.gameState.mapId);
      const avatarMarkup = portrait
        ? `<img src="${portrait}" class="player-avatar-img" alt="${player.name}">`
        : player.avatarAtlas
        ? `<span class="player-avatar-atlas" role="img" aria-label="${player.name}" style="background-image:url('${player.avatarAtlas}');background-position:${player.avatarPosition}"></span>`
        : player.avatarImg
        ? `<img src="${player.avatarImg}" class="player-avatar-img" alt="${player.name}">`
        : `<span class="player-avatar">${player.avatar}</span>`;

      card.innerHTML = `
        <div class="card-top">
          <div class="player-name-group">
            ${this.gameState.mapId === 'grand-bay' ? `<span class="city-player-identity" style="--identity-color:${player.color}">${avatarMarkup}<span class="city-player-number" aria-label="棋盘编号 ${player.id + 1}">${player.id + 1}</span></span>` : avatarMarkup}
            <div>
              <div class="player-name" style="color:${player.profileId === 10 ? '#c6d0d8' : player.color}">${player.name}</div>
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
