import { cardManager } from '../game/CardManager.js';
import { ITEMS } from '../game/ContentRegistry.js';
import { CARD_CAPACITY, ITEM_CAPACITY } from '../game/InventoryManager.js';
import {
  CARD_CATEGORIES,
  createCardPresentation,
  createItemPresentation,
  filterCardPresentations
} from '../game/CardPresentation.js';

export class ShopUI {
  constructor(gameState, audioManager, onUseCardCallback, onUpdateHUD, gameEngine = null) {
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.onUseCardCallback = onUseCardCallback;
    this.onUpdateHUD = onUpdateHUD;
    this.gameEngine = gameEngine;

    this.shopModal = document.getElementById('modal-shop');
    this.shopGrid = document.getElementById('shop-card-grid');
    this.shopDetail = document.getElementById('shop-card-detail');
    this.shopTabs = document.getElementById('shop-filter-tabs');
    this.shopUserPoints = document.getElementById('shop-user-points');
    this.shopTitle = document.getElementById('shop-title');
    this.shopSubtitle = document.getElementById('shop-subtitle');
    this.shopVisitBanner = document.getElementById('shop-visit-banner');
    this.shopOffer = null;
    this.shopCloseResolver = null;
    this.shopFilter = 'ALL';
    this.selectedShopKey = null;

    this.inventoryModal = document.getElementById('modal-inventory');
    this.inventoryGrid = document.getElementById('inventory-card-grid');
    this.inventoryDetail = document.getElementById('inventory-card-detail');
    this.inventoryTabs = document.getElementById('inventory-filter-tabs');
    this.inventorySubtitle = document.getElementById('inventory-subtitle');
    this.inventoryFilter = 'ALL';
    this.selectedInventoryKey = null;

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('shop-modal-close').addEventListener('click', () => this.hideShop());
    document.getElementById('inventory-modal-close').addEventListener('click', () => this.hideInventory());
  }

  showShop({ offer = null, awaitClose = false } = {}) {
    this.shopOffer = offer;
    this.shopFilter = 'ALL';
    this.selectedShopKey = null;
    this.shopTitle.textContent = offer ? `🏬 ${offer.tileName}` : '🏬 策略卡片中心';
    this.shopSubtitle.textContent = offer
      ? `第 ${offer.round} 轮限定货架 · 到店专享 ${Math.round(offer.discountRate * 100)}% 折扣`
      : '30 张策略卡 · 稀有度、目标与战术情报一览';
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
    this.inventoryFilter = 'ALL';
    this.selectedInventoryKey = null;
    this.inventoryModal.classList.remove('hidden');
    this.renderInventory();
  }

  hideInventory() {
    this.inventoryModal.classList.add('hidden');
  }

  renderTabs(container, entries, activeFilter, onChange) {
    const categoryIds = new Set(entries.map(entry => entry.presentation.category.id));
    const tabs = [CARD_CATEGORIES.ALL, ...Object.values(CARD_CATEGORIES).filter(category => category.id !== 'ALL' && categoryIds.has(category.id))];
    container.innerHTML = tabs.map(category => `
      <button type="button" class="${activeFilter === category.id ? 'active' : ''}" data-card-filter="${category.id}">
        <span>${category.icon}</span>${category.label}<b>${category.id === 'ALL' ? entries.length : entries.filter(entry => entry.presentation.category.id === category.id).length}</b>
      </button>
    `).join('');
    container.querySelectorAll('[data-card-filter]').forEach(button => button.addEventListener('click', () => onChange(button.dataset.cardFilter)));
  }

  getShopEntries(player) {
    const cards = this.shopOffer
      ? this.shopOffer.cardIds.map(cardId => cardManager.getCardById(cardId)).filter(Boolean)
      : cardManager.getAllCards();
    const cardEntries = cards.map(card => {
      const cost = this.gameEngine
        ? this.gameEngine.getCardCost(player, card, this.shopOffer?.tileId)
        : (player.skillName === '商业奇才' ? Math.round(card.cost * 0.85) : card.cost);
      return { key: `CARD:${card.id}`, kind: 'CARD', definition: card, presentation: createCardPresentation(card, { cost, points: player.cardPoints }) };
    });
    const tools = this.shopOffer
      ? this.shopOffer.itemIds.map(itemId => ITEMS.find(item => item.id === itemId)).filter(Boolean)
      : ITEMS.filter(item => item.cost !== null);
    return [...cardEntries, ...tools.map(tool => {
      const cost = this.gameEngine ? this.gameEngine.getItemCost(player, tool, this.shopOffer?.tileId) : tool.cost;
      return { key: `ITEM:${tool.id}`, kind: 'ITEM', definition: tool, presentation: createItemPresentation(tool, { cost, points: player.cardPoints }) };
    })];
  }

  renderShop() {
    const player = this.gameState.getCurrentPlayer();
    this.shopUserPoints.textContent = player.cardPoints;
    const entries = this.getShopEntries(player);
    this.renderTabs(this.shopTabs, entries, this.shopFilter, filter => {
      this.shopFilter = filter;
      this.selectedShopKey = null;
      this.renderShop();
    });
    const visible = filterCardPresentations(entries.map(entry => ({ ...entry, category: entry.presentation.category })), this.shopFilter);
    if (!visible.some(entry => entry.key === this.selectedShopKey)) this.selectedShopKey = visible[0]?.key || null;
    this.shopGrid.innerHTML = '';
    visible.forEach(entry => this.shopGrid.appendChild(this.createEntryCard(entry, {
      selected: entry.key === this.selectedShopKey,
      capacityText: entry.kind === 'CARD' ? `卡片 ${player.cards?.length || 0}/${CARD_CAPACITY}` : `道具 ${player.items?.length || 0}/${ITEM_CAPACITY}`,
      primaryLabel: entry.kind === 'CARD' ? '兑换卡片' : '购买道具',
      primaryDisabled: !entry.presentation.affordable,
      onSelect: () => { this.selectedShopKey = entry.key; this.renderShop(); },
      onPrimary: () => this.buyEntry(entry, player)
    })));
    this.renderDetail(this.shopDetail, visible.find(entry => entry.key === this.selectedShopKey), { mode: 'SHOP', player });
  }

  buyEntry(entry, player) {
    const command = entry.kind === 'CARD'
      ? { type: 'BUY_CARD', playerId: player.id, payload: { cardId: entry.definition.id, tileId: this.shopOffer?.tileId } }
      : { type: 'BUY_ITEM', playerId: player.id, payload: { itemId: entry.definition.id, tileId: this.shopOffer?.tileId } };
    const result = this.gameEngine
      ? this.gameEngine.execute(command)
      : { success: player.cardPoints >= entry.presentation.cost };
    if (result.success) {
      if (!this.gameEngine && entry.kind === 'CARD') {
        player.cardPoints -= entry.presentation.cost;
        player.cards.push(entry.definition.id);
      }
      this.audioManager.playCardSpell();
      this.showAcquisition(entry);
    } else {
      this.gameState.addLog(`⚠️ ${result.reason || '无法兑换该内容'}`, 'danger');
    }
    this.renderShop();
    this.onUpdateHUD?.();
  }

  showAcquisition(entry) {
    if (entry.kind !== 'CARD') return;
    const view = entry.presentation;
    const flash = document.createElement('div');
    flash.className = `card-acquisition rarity-${view.rarity.id.toLowerCase()} ${view.artClass}`;
    flash.setAttribute('aria-live', 'polite');
    flash.innerHTML = `
      <div class="card-acquisition-rays"></div>
      <div class="card-acquisition-art"><span>${view.icon}</span><i>${view.serial}</i></div>
      <div class="card-acquisition-copy"><small>CARD ACQUIRED · ${view.rarityStars}</small><strong>${view.name}</strong><span>${view.category.label}策略已加入卡片栏</span></div>
    `;
    document.body.appendChild(flash);
    requestAnimationFrame(() => flash.classList.add('is-visible'));
    setTimeout(() => {
      flash.classList.remove('is-visible');
      setTimeout(() => flash.remove(), 240);
    }, 1900);
  }

  getInventoryEntries(player) {
    const group = (ids = []) => [...new Set(ids)].map(id => ({ id, count: ids.filter(value => value === id).length, index: ids.indexOf(id) }));
    const cards = group(player.cards).map(({ id, count, index }) => {
      const card = cardManager.getCardById(id);
      if (!card) return null;
      const action = this.gameEngine?.getCardAction(player, id);
      return { key: `CARD:${id}`, kind: 'CARD', definition: card, index, presentation: createCardPresentation(card, { action, ownedCount: count }) };
    }).filter(Boolean);
    const tools = group(player.items).map(({ id, count, index }) => {
      const tool = ITEMS.find(item => item.id === id);
      if (!tool) return null;
      const action = this.gameEngine?.getItemAction(player, id);
      return { key: `ITEM:${id}`, kind: 'ITEM', definition: tool, index, presentation: createItemPresentation(tool, { action, ownedCount: count }) };
    }).filter(Boolean);
    return [...cards, ...tools];
  }

  renderInventory() {
    const player = this.gameState.getCurrentPlayer();
    const entries = this.getInventoryEntries(player);
    this.inventorySubtitle.textContent = `策略卡 ${player.cards?.length || 0}/${CARD_CAPACITY} · 科技道具 ${player.items?.length || 0}/${ITEM_CAPACITY} · 掷骰前使用`;
    this.renderTabs(this.inventoryTabs, entries, this.inventoryFilter, filter => {
      this.inventoryFilter = filter;
      this.selectedInventoryKey = null;
      this.renderInventory();
    });
    const visible = filterCardPresentations(entries.map(entry => ({ ...entry, category: entry.presentation.category })), this.inventoryFilter);
    if (!visible.some(entry => entry.key === this.selectedInventoryKey)) this.selectedInventoryKey = visible[0]?.key || null;
    this.inventoryGrid.innerHTML = '';
    if (!visible.length) {
      this.inventoryGrid.innerHTML = '<div class="card-center-empty"><span>🃏</span><strong>背包空空如也</strong><p>前往卡片商店补充下一回合的战术选择。</p></div>';
      this.renderDetail(this.inventoryDetail, null);
      return;
    }
    visible.forEach(entry => this.inventoryGrid.appendChild(this.createEntryCard(entry, {
      selected: entry.key === this.selectedInventoryKey,
      capacityText: entry.presentation.enabled ? (entry.presentation.targetCount ? `${entry.presentation.targetCount} 个合法目标` : '现在可使用') : entry.presentation.disabledReason,
      primaryLabel: '使用',
      primaryDisabled: !entry.presentation.enabled,
      secondaryLabel: `出售 ${entry.kind === 'CARD' ? entry.presentation.sellPrice : entry.definition.sellPrice} PTS`,
      onSelect: () => { this.selectedInventoryKey = entry.key; this.renderInventory(); },
      onPrimary: () => {
        this.hideInventory();
        this.onUseCardCallback?.(entry.definition.id, entry.index, entry.kind);
      },
      onSecondary: () => {
        this.gameEngine.execute({ type: 'SELL_INVENTORY', playerId: player.id, payload: { kind: entry.kind, contentId: entry.definition.id } });
        this.renderInventory();
        this.onUpdateHUD?.();
      }
    })));
    this.renderDetail(this.inventoryDetail, visible.find(entry => entry.key === this.selectedInventoryKey), { mode: 'INVENTORY', player });
  }

  createEntryCard(entry, options) {
    const view = entry.presentation;
    const article = document.createElement('article');
    article.className = `strategy-card rarity-${view.rarity.id.toLowerCase()} ${options.selected ? 'selected' : ''} ${!view.enabled ? 'is-disabled' : ''}`;
    article.dataset.entryKey = entry.key;
    const art = entry.kind === 'CARD'
      ? `<div class="strategy-card-illustration ${view.artClass}" role="img" aria-label="${view.name}插画"><span>${view.icon}</span><i>${view.serial}</i></div>`
      : `<div class="strategy-item-icon">${view.icon}</div>`;
    article.innerHTML = `
      <div class="strategy-card-art">${art}<span class="strategy-rarity">${view.rarityStars} ${view.rarity.label}</span>${view.ownedCount > 1 ? `<b class="strategy-count">×${view.ownedCount}</b>` : ''}</div>
      <div class="strategy-card-copy">
        <div class="strategy-card-kicker"><span>${view.category.icon} ${view.category.label}</span><span>${view.targetLabel}</span></div>
        <h3>${view.name}</h3>
        <p>${view.desc}</p>
        <small class="${view.enabled ? 'ready' : 'blocked'}">${options.capacityText}</small>
      </div>
      <div class="strategy-card-actions">
        ${view.cost !== null && view.cost !== undefined ? `<strong>${view.cost} <small>PTS</small>${view.cost !== view.cost ? '' : ''}</strong>` : '<strong>科技限定</strong>'}
        <button type="button" class="btn-primary btn-sm strategy-primary" ${options.primaryDisabled ? 'disabled' : ''}>${options.primaryLabel}</button>
        ${options.secondaryLabel ? `<button type="button" class="btn-secondary btn-sm strategy-secondary">${options.secondaryLabel}</button>` : ''}
      </div>
    `;
    article.addEventListener('click', options.onSelect);
    article.querySelector('.strategy-primary')?.addEventListener('click', event => { event.stopPropagation(); options.onPrimary(); });
    article.querySelector('.strategy-secondary')?.addEventListener('click', event => { event.stopPropagation(); options.onSecondary(); });
    return article;
  }

  renderDetail(container, entry, { mode = 'SHOP' } = {}) {
    if (!entry) {
      container.innerHTML = '<div class="card-detail-empty"><span>✦</span><p>选择一张卡片查看战术情报</p></div>';
      return;
    }
    const view = entry.presentation;
    const art = entry.kind === 'CARD'
      ? `<div class="card-detail-illustration ${view.artClass}" role="img" aria-label="${view.name}大图预览"><span>${view.icon}</span><i>${view.serial}</i></div>`
      : `<div class="card-detail-item-icon">${view.icon}</div>`;
    const status = mode === 'SHOP'
      ? (view.affordable ? '点数充足，可以兑换' : `还差 ${Math.max(0, view.cost - Number(this.gameState.getCurrentPlayer().cardPoints || 0))} PTS`)
      : (view.enabled ? (view.targetCount ? `当前检测到 ${view.targetCount} 个合法目标` : '当前回合可以立即使用') : view.disabledReason);
    container.className = `card-detail-panel rarity-${view.rarity.id.toLowerCase()}`;
    container.innerHTML = `
      <div class="card-detail-art">${art}<span>${view.rarity.label} · ${view.category.label}</span></div>
      <div class="card-detail-heading"><small>TACTICAL DOSSIER</small><h3>${view.name}</h3><p>${view.desc}</p></div>
      <div class="card-detail-meta"><span><b>目标</b>${view.targetLabel}</span><span><b>时机</b>${view.timing}</span><span><b>类型</b>${view.category.icon} ${view.category.label}</span></div>
      <div class="card-tactical-note"><b>战术参谋</b><p>${view.tacticalNote}</p></div>
      <div class="card-detail-status ${mode === 'INVENTORY' && !view.enabled || mode === 'SHOP' && !view.affordable ? 'blocked' : 'ready'}"><i></i>${status}</div>
    `;
  }
}
