import { MAX_PROPERTY_LEVEL } from '../game/GameRules.js';
import { COLOR_GROUPS, isPropertyTile } from '../game/BoardData.js';
import { BUILDINGS } from '../game/ContentRegistry.js';
import { MinigameUI } from './MinigameUI.js';

const money = value => `$${Math.max(0, Math.round(Number(value) || 0)).toLocaleString()}`;

export function createLandDecisionModel({ tileData, currentLevel = 0, player, state = null, action = 'BUY', quote = null, buildingType = null }) {
  const property = state?.propertyManager?.getProperty(tileData.id);
  const resolvedBuildingType = buildingType || property?.buildingType || (tileData.large ? 'MALL' : 'RESIDENTIAL');
  const building = BUILDINGS.find(item => item.id === resolvedBuildingType);
  const cost = Math.max(0, Number(quote ?? (action === 'UPGRADE' ? tileData.buildCost : tileData.price)) || 0);
  const targetLevel = action === 'UPGRADE' ? Math.min(currentLevel + 1, MAX_PROPERTY_LEVEL) : currentLevel;
  const rentMultiplier = building?.rentMultiplier ?? 1;
  const economyMultiplier = (state?.priceIndex || 1) * (state?.newsEffect === 'DOUBLE_RENT' || state?.newsEffect?.id === 'DOUBLE_RENT' ? 2 : 1);
  const districtTiles = state?.mapDefinition?.tiles?.filter(tile => tile.group === tileData.group && isPropertyTile(tile)) || [tileData];
  const ownedBefore = districtTiles.filter(tile => state?.propertyManager?.getProperty(tile.id)?.owner === player?.id).length;
  const alreadyOwned = property?.owner === player?.id;
  const projectedOwned = Math.min(districtTiles.length, ownedBefore + (action === 'BUY' && !alreadyOwned ? 1 : 0));
  const monopolyMultiplier = tileData.group && projectedOwned === districtTiles.length ? 2 : 1;
  const chainCount = resolvedBuildingType === 'CHAIN_STORE'
    ? [...(state?.propertyManager?.properties?.values?.() || [])].filter(item => item.owner === player?.id && item.buildingType === 'CHAIN_STORE').length + (action === 'BUY' ? 1 : 0)
    : 0;
  const chainMultiplier = resolvedBuildingType === 'CHAIN_STORE' ? 1 + Math.max(0, chainCount - 1) * 0.25 : 1;
  const projectedRent = level => Math.floor((tileData.tolls?.[level] || 0) * rentMultiplier * economyMultiplier * monopolyMultiplier * chainMultiplier);
  const currentToll = property?.owner !== null && property?.owner !== undefined
    ? state.propertyManager.calculateToll(tileData.id, state.newsEffect, state.priceIndex)
    : projectedRent(currentLevel);
  const nextToll = projectedRent(targetLevel);
  const cash = Math.max(0, Number(player?.cash) || 0);
  const rentGrowth = Array.from({ length: MAX_PROPERTY_LEVEL + 1 }, (_, level) => projectedRent(level));
  const maxRent = Math.max(1, ...rentGrowth);
  return {
    action,
    cost,
    affordable: cash >= cost,
    cash,
    cashAfter: Math.max(0, cash - cost),
    currentLevel,
    targetLevel,
    artLevel: targetLevel,
    currentToll,
    nextToll,
    rentIncrease: Math.max(0, nextToll - currentToll),
    yieldRate: cost > 0 ? nextToll / cost * 100 : 100,
    paybackPasses: nextToll > 0 ? Math.ceil(cost / nextToll) : null,
    districtName: COLOR_GROUPS[tileData.group]?.name || (tileData.large ? '城市商业地标' : '独立地块'),
    districtColor: COLOR_GROUPS[tileData.group]?.color || player?.color || '#67e8f9',
    districtOwned: projectedOwned,
    districtTotal: Math.max(1, districtTiles.length),
    completesDistrict: Boolean(tileData.group && projectedOwned === districtTiles.length),
    buildingType: resolvedBuildingType,
    buildingName: building?.name || (resolvedBuildingType === 'CHAIN_STORE' ? '连锁店' : '精品住宅'),
    buildingIcon: building?.icon || (resolvedBuildingType === 'CHAIN_STORE' ? '🏪' : '🏡'),
    buildingDescription: building?.description || (resolvedBuildingType === 'CHAIN_STORE' ? '同类门店越多，连锁租金加成越高。' : '逐级建设可显著提高到访租金。'),
    rentGrowth: rentGrowth.map((value, level) => ({ level, value, share: Math.max(4, value / maxRent * 100) }))
  };
}

export class DialogUI {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.landModal = document.getElementById('modal-land');
    this.remoteDiceModal = document.getElementById('modal-remote-dice');
    this.victoryModal = document.getElementById('modal-victory');
    this.minigameUI = new MinigameUI(audioManager);

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('land-modal-close').addEventListener('click', () => this.hideLandModal());
  }

  showLandPurchase({ tileData, currentLevel, player, gameState = null, quote = null, buildingType = null, onBuy, onUpgrade, onPass }) {
    this.landModal.classList.remove('hidden');

    const titleEl = document.getElementById('land-modal-title');
    const badgeEl = document.getElementById('land-level-badge');
    const buildingArtEl = document.getElementById('land-building-art');
    const nameEl = document.getElementById('land-name');
    const priceEl = document.getElementById('land-price');
    const tollEl = document.getElementById('land-toll');
    const nextTollEl = document.getElementById('land-next-toll');
    const actionsEl = document.getElementById('land-modal-actions');
    const action = onBuy ? 'BUY' : 'UPGRADE';
    const model = createLandDecisionModel({ tileData, currentLevel, player, state: gameState, action, quote, buildingType });

    titleEl.textContent = action === 'BUY' ? `发现投资机会 · ${tileData.name}` : `地产升级规划 · ${tileData.name}`;
    document.getElementById('land-modal-subtitle').textContent = `${model.districtName} · ${model.buildingIcon} ${model.buildingName}`;
    badgeEl.textContent = action === 'BUY' ? 'LV 0 待开发地块' : `LV ${currentLevel} → LV ${model.targetLevel}`;
    buildingArtEl.style.backgroundPosition = `${Math.min(model.artLevel, MAX_PROPERTY_LEVEL) * 25}% 50%`;
    buildingArtEl.style.setProperty('--district-color', model.districtColor);
    buildingArtEl.setAttribute('aria-label', `${model.buildingName} LV ${model.artLevel} 建筑预览`);
    buildingArtEl.setAttribute('role', 'img');
    nameEl.textContent = tileData.name;
    priceEl.textContent = money(model.cost);
    tollEl.textContent = money(model.currentToll);
    nextTollEl.textContent = money(model.nextToll);
    document.getElementById('land-district-chip').textContent = `${model.districtName} ${model.districtOwned}/${model.districtTotal}`;
    document.getElementById('land-district-chip').style.setProperty('--district-color', model.districtColor);
    document.getElementById('land-building-description').textContent = model.buildingDescription;
    document.getElementById('land-yield-rate').textContent = `${model.yieldRate.toFixed(1)}%`;
    document.getElementById('land-payback').textContent = model.paybackPasses ? `约 ${model.paybackPasses} 次收费回本` : '功能型设施';
    document.getElementById('land-cash-before').textContent = money(model.cash);
    document.getElementById('land-action-cost').textContent = `−${money(model.cost)}`;
    document.getElementById('land-cash-after').textContent = money(model.cashAfter);
    document.getElementById('land-cash-after').classList.toggle('is-low', model.cashAfter < 3000);
    document.getElementById('land-monopoly-callout').classList.toggle('hidden', !model.completesDistrict);
    const chart = document.getElementById('land-rent-chart');
    chart.replaceChildren(...model.rentGrowth.map(item => {
      const bar = document.createElement('div');
      bar.className = `land-rent-bar${item.level === model.targetLevel ? ' is-target' : ''}${item.level < model.targetLevel ? ' is-complete' : ''}`;
      bar.innerHTML = `<span style="--rent-share:${item.share}%"></span><small>LV${item.level}</small><b>${money(item.value)}</b>`;
      return bar;
    }));

    actionsEl.innerHTML = '';

    if (onBuy) {
      const btnBuy = document.createElement('button');
      btnBuy.id = 'btn-land-buy';
      btnBuy.className = 'btn-primary';
      btnBuy.textContent = model.affordable ? `确认投资 ${money(model.cost)}` : `现金不足 · 需要 ${money(model.cost)}`;
      btnBuy.disabled = !model.affordable;
      btnBuy.onclick = () => {
        this.audioManager?.playConfirm?.();
        this.hideLandModal();
        onBuy();
      };
      actionsEl.appendChild(btnBuy);
    } else if (currentLevel < MAX_PROPERTY_LEVEL && onUpgrade) {
      const btnUpgrade = document.createElement('button');
      btnUpgrade.id = 'btn-land-upgrade';
      btnUpgrade.className = 'btn-primary';
      btnUpgrade.textContent = model.affordable ? `升级至 LV ${model.targetLevel} · ${money(model.cost)}` : `现金不足 · 需要 ${money(model.cost)}`;
      btnUpgrade.disabled = !model.affordable;
      btnUpgrade.onclick = () => {
        this.audioManager?.playConfirm?.();
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
      this.audioManager?.playClick?.();
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
    return this.minigameUI.play(gameId);
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

  showVictory(winner, onRestart, gameState = null, onMenu = null) {
    this.victoryModal.classList.remove('hidden');
    document.getElementById('winner-name').textContent = `👑 大富翁诞生: ${winner.name}`;
    const teamText = gameState?.winningTeamId !== null && gameState?.winningTeamId !== undefined
      ? `队伍 ${gameState.winningTeamId} 获胜！`
      : '恭喜获胜！';
    document.getElementById('winner-desc').textContent = `${teamText} 最终现金 $${winner.cash.toLocaleString()}`;
    const stats = document.getElementById('winner-stats');
    if (gameState) {
      const report = gameState.createMatchReport();
      const winningTeam = report.teams.find(team => team.id === report.winningTeamId);
      document.getElementById('winner-desc').textContent = `${winningTeam ? `队伍 ${winningTeam.id} · ` : ''}${report.reasonLabel}`;
      this.renderMatchReport(stats, report);
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
    document.getElementById('btn-victory-menu').onclick = () => {
      this.victoryModal.classList.add('hidden');
      if (onMenu) onMenu();
    };
  }

  renderMatchReport(container, report) {
    container.replaceChildren();
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const money = value => `$${Math.round(Number(value) || 0).toLocaleString()}`;
    const summary = el('div', 'report-hero');
    summary.append(el('strong', '', `${report.mode} · ${report.round}/${report.maxRounds} 轮`));
    summary.append(el('span', '', `领先优势 ${money(report.margin)}`));
    const pulse = el('div', 'report-pulse');
    [['💸', '资金流动', money(report.totals.cashFlow)], ['🏘️', '地产交易', report.totals.properties], ['🃏', '卡片出手', report.totals.cards], ['📈', '投资交易', report.totals.trades]].forEach(([icon, label, value]) => {
      const tile = el('div', 'report-pulse-item');
      tile.append(el('i', '', icon), el('small', '', label), el('b', '', String(value)));
      pulse.append(tile);
    });
    container.append(summary, pulse);

    const rankings = el('div', 'report-rankings');
    const maxAssets = Math.max(1, ...report.rankings.map(row => row.assets.total));
    report.rankings.forEach(row => {
      const card = el('article', `report-row${row.rank === 1 ? ' is-champion' : ''}`);
      const heading = el('div', 'report-row-heading');
      heading.append(el('b', '', `${row.rank === 1 ? '🏆' : `#${row.rank}`} ${row.player.name}${row.player.isBankrupt ? ' · 已破产' : ''}`), el('strong', '', money(row.assets.total)));
      const bar = el('div', 'report-asset-bar');
      const fill = el('span');
      fill.style.setProperty('--asset-share', `${Math.max(3, row.assets.total / maxAssets * 100)}%`);
      bar.append(fill);
      card.append(heading, bar,
        el('small', '', `现金 ${money(row.assets.cash)} · 存款 ${money(row.assets.deposit)} · 地产 ${money(row.assets.landValue + row.assets.buildingValue)} · 股票 ${money(row.assets.stockValue)} · 商业 ${money(row.assets.commercialValue)}`),
        el('small', '', `租金收/支 ${money(row.statistics.rentIncome)}/${money(row.statistics.rentExpense)} · 置业 ${row.statistics.propertiesBought || 0} · 卡片 ${row.statistics.cardsUsed || 0} · 投资 ${row.statistics.investmentTrades || 0}`));
      rankings.append(card);
    });
    container.append(rankings);

    const awardsSection = el('section', 'report-section');
    awardsSection.append(el('h3', '', '🏅 本局荣誉'));
    const awards = el('div', 'report-awards');
    report.awards.forEach(item => {
      const badge = el('div', 'report-award');
      badge.append(el('i', '', item.icon), el('small', '', item.title), el('b', '', item.playerName), el('em', '', `${item.value.toLocaleString()}${item.tieBroken ? ' · 并列按排名决定' : ''}`));
      awards.append(badge);
    });
    awardsSection.append(awards);
    const highlightsSection = el('section', 'report-section');
    highlightsSection.append(el('h3', '', '✨ 比赛时刻'));
    const timeline = el('div', 'report-timeline');
    report.highlights.forEach(item => {
      const entry = el('p');
      entry.append(el('i', '', item.icon), el('span', '', `${item.round ? `第 ${item.round} 轮 · ` : ''}${item.text}`));
      timeline.append(entry);
    });
    highlightsSection.append(timeline);
    container.append(awardsSection, highlightsSection);
  }
}
