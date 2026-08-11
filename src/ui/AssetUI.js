import { getBuildingOptions, getDistrictPortfolio, getPropertyPortfolio } from '../game/PropertyRules.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

export class AssetUI {
  constructor(gameState, gameEngine, audioManager, onUpdate = () => {}) {
    this.gameState = gameState;
    this.engine = gameEngine;
    this.audio = audioManager;
    this.onUpdate = onUpdate;
    this.modal = document.getElementById('modal-assets');
    this.body = document.getElementById('asset-ranking-body');
    this.rankingPanel = document.getElementById('asset-ranking-panel');
    this.propertyPanel = document.getElementById('asset-property-panel');
    this.districtPanel = document.getElementById('asset-district-panel');
    this.status = document.getElementById('asset-center-status');
    this.activeTab = 'RANKING';
    document.getElementById('asset-modal-close').onclick = () => this.hide();
    document.getElementById('asset-center-tabs').addEventListener('click', event => {
      const button = event.target.closest('[data-asset-tab]');
      if (!button) return;
      this.activeTab = button.dataset.assetTab;
      this.render();
    });
    this.propertyPanel.addEventListener('click', event => this.handlePropertyAction(event));
  }

  show(tab = 'RANKING') {
    this.activeTab = tab;
    this.status.textContent = '';
    this.render();
    this.modal.classList.remove('hidden');
  }

  hide() { this.modal.classList.add('hidden'); }

  render() {
    document.getElementById('asset-center-subtitle').textContent = ({
      RANKING: '财富排行与资产结构', PROPERTIES: '租金、净值与自主经营', DISTRICTS: '区域收集与垄断进度'
    })[this.activeTab];
    document.querySelectorAll('[data-asset-tab]').forEach(button => button.classList.toggle('active', button.dataset.assetTab === this.activeTab));
    this.rankingPanel.classList.toggle('hidden', this.activeTab !== 'RANKING');
    this.propertyPanel.classList.toggle('hidden', this.activeTab !== 'PROPERTIES');
    this.districtPanel.classList.toggle('hidden', this.activeTab !== 'DISTRICTS');
    if (this.activeTab === 'PROPERTIES') this.renderProperties();
    else if (this.activeTab === 'DISTRICTS') this.renderDistricts();
    else this.renderRanking();
  }

  renderRanking() {
    this.body.innerHTML = '';
    this.gameState.getRankings().forEach(({ player, assets }, index) => {
      const row = document.createElement('tr');
      row.className = player.isBankrupt ? 'bankrupt' : '';
      row.innerHTML = `<td><strong>${index + 1}</strong></td>
        <td><span style="color:${escapeHTML(player.color)}">●</span> ${escapeHTML(player.name)}</td>
        <td>$${assets.cash.toLocaleString()}</td><td>$${assets.deposit.toLocaleString()}</td>
        <td>$${assets.landValue.toLocaleString()}</td><td>$${assets.buildingValue.toLocaleString()}</td>
        <td>$${assets.stockValue.toLocaleString()}</td><td>${assets.propertyCount}</td>
        <td><strong>$${assets.total.toLocaleString()}</strong></td>`;
      this.body.appendChild(row);
    });
  }

  renderProperties() {
    const player = this.gameState.getCurrentPlayer();
    const portfolio = getPropertyPortfolio(this.gameState, player.id);
    const canManage = this.gameState.phase === 'PRE_ROLL_ACTION' && !player.isAI && !player.isBankrupt;
    const totalRent = portfolio.reduce((sum, entry) => sum + entry.rent, 0);
    const totalValue = portfolio.reduce((sum, entry) => sum + entry.value, 0);
    const disabled = canManage ? '' : 'disabled';
    if (!portfolio.length) {
      this.propertyPanel.innerHTML = `<div class="asset-empty"><span>🏗️</span><strong>还没有地产</strong><p>购买土地后，可在这里管理建筑、抵押和赎回。</p></div>`;
      return;
    }
    this.propertyPanel.innerHTML = `<div class="property-summary">
      <div><span>地产数量</span><strong>${portfolio.length}</strong></div><div><span>当前总租金</span><strong>$${totalRent.toLocaleString()}</strong></div>
      <div><span>地产净值</span><strong>$${totalValue.toLocaleString()}</strong></div><div><span>可用现金</span><strong>$${player.cash.toLocaleString()}</strong></div></div>
      ${!canManage ? '<div class="property-management-note">经营操作仅限当前人类玩家掷骰前进行。</div>' : ''}
      <div class="property-portfolio-grid">${portfolio.map(entry => this.renderPropertyCard(entry, disabled)).join('')}</div>`;
  }

  renderPropertyCard(entry, disabled) {
    const { tile, property } = entry;
    const sellValue = Math.round(entry.buildCost * 0.5);
    const mortgageValue = Math.round((tile.price || 0) * 0.5);
    const redeemCost = Math.round((property.mortgageValue || mortgageValue) * 1.1);
    const locked = entry.listed || entry.researchTask;
    const actionDisabled = disabled || locked ? 'disabled' : '';
    const buildingOptions = getBuildingOptions(tile).filter(option => option.id !== property.buildingType);
    return `<article class="property-portfolio-card" data-property-id="${entry.tileId}">
      <div class="property-card-head"><div><span class="property-group-label">${escapeHTML(tile.group || '商业地产')}</span><h3>${escapeHTML(tile.name)}</h3></div>
        <span class="property-level ${property.isMortgaged ? 'mortgaged' : ''}">${property.isMortgaged ? '已抵押' : `LV ${property.level}`}</span></div>
      <div class="property-card-metrics"><div><span>建筑</span><strong>${escapeHTML(entry.buildingLabel)}</strong></div><div><span>租金</span><strong>$${entry.rent.toLocaleString()}</strong></div>
        <div><span>净值</span><strong>$${entry.value.toLocaleString()}</strong></div><div><span>区域</span><strong>${entry.monopoly ? '垄断 ×2' : '经营中'}</strong></div></div>
      ${entry.listed ? '<div class="property-lock-note">📣 正在交易大厅挂牌，需先撤单</div>' : ''}
      ${entry.researchTask ? `<div class="property-lock-note">🧪 正在研发 ${escapeHTML(entry.researchTask.itemId)}</div>` : ''}
      <div class="property-card-actions">
        ${property.isMortgaged
          ? `<button class="btn-primary btn-sm" data-property-action="REDEEM_PROPERTY" ${disabled}>赎回 $${redeemCost.toLocaleString()}</button>`
          : `${property.level > 0 ? `<button class="btn-secondary btn-sm" data-property-action="SELL_BUILDING" ${actionDisabled}>拆售一层 +$${sellValue.toLocaleString()}</button>` : `<button class="btn-secondary btn-sm" data-property-action="MORTGAGE_PROPERTY" ${actionDisabled}>抵押 +$${mortgageValue.toLocaleString()}</button>`}
            ${buildingOptions.length ? `<select aria-label="选择改建类型" data-building-select ${actionDisabled}>${buildingOptions.map(option => `<option value="${escapeHTML(option.id)}">${escapeHTML(option.label)}</option>`).join('')}</select><button class="btn-secondary btn-sm" data-property-action="CHOOSE_BUILDING_TYPE" ${actionDisabled}>改建</button>` : ''}`}
      </div></article>`;
  }

  renderDistricts() {
    const player = this.gameState.getCurrentPlayer();
    const districts = getDistrictPortfolio(this.gameState, player.id);
    this.districtPanel.innerHTML = `<div class="district-intro"><strong>${escapeHTML(player.name)} 的区域版图</strong><span>集齐同区域全部普通地产，过路费自动翻倍。</span></div>
      <div class="district-grid">${districts.map(district => `<article class="district-card ${district.complete ? 'complete' : ''}">
        <div class="district-color" style="background:${escapeHTML(district.color)}"></div><div><h3>${escapeHTML(district.name)}</h3>
          <span>${district.owned}/${district.total} 块${district.complete ? ' · 已垄断' : district.contested ? ' · 多方争夺' : ''}</span></div>
        <div class="district-progress"><i style="width:${Math.round(district.owned / district.total * 100)}%;background:${escapeHTML(district.color)}"></i></div>
      </article>`).join('')}</div>`;
  }

  handlePropertyAction(event) {
    const button = event.target.closest('[data-property-action]');
    if (!button) return;
    const card = button.closest('[data-property-id]');
    const tileId = Number(card.dataset.propertyId);
    const type = button.dataset.propertyAction;
    const player = this.gameState.getCurrentPlayer();
    if (['SELL_BUILDING', 'MORTGAGE_PROPERTY'].includes(type)
      && !globalThis.confirm(type === 'SELL_BUILDING' ? '确认拆售一层建筑？' : '确认抵押该地产？抵押期间不收取租金。')) return;
    const buildingType = type === 'CHOOSE_BUILDING_TYPE' ? card.querySelector('[data-building-select]')?.value : undefined;
    if (type === 'CHOOSE_BUILDING_TYPE' && !globalThis.confirm('确认改建该地产？若新建筑等级上限较低，现有等级会相应降低。')) return;
    const result = this.engine.execute({ type, playerId: player.id, payload: { tileId, buildingType } });
    this.status.textContent = result.success ? '地产经营操作成功' : `操作失败：${result.reason}`;
    this.status.classList.toggle('error', !result.success);
    if (result.success) this.audio?.playSFX?.('coin');
    this.onUpdate();
    this.renderProperties();
  }
}
