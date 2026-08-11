import { getMarketAsset, getMarketOfferView } from '../game/MarketRules.js';

const kindLabel = { PROPERTY: '地产', ITEM: '道具', CARD: '卡片' };
const historyLabel = { LISTED: '挂牌', SOLD: '成交', CANCELLED: '撤单', EXPIRED: '到期' };
const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

export class MarketUI {
  constructor(gameState, gameEngine, audioManager, onUpdate = () => {}) {
    this.state = gameState;
    this.engine = gameEngine;
    this.audio = audioManager;
    this.onUpdate = onUpdate;
    this.modal = document.getElementById('modal-market');
    this.content = document.getElementById('market-content');
    this.balance = document.getElementById('market-balance');
    this.activeTab = 'OFFERS';
    document.getElementById('market-modal-close').addEventListener('click', () => this.hide());
    this.modal.addEventListener('click', event => { if (event.target === this.modal) this.hide(); });
    document.getElementById('market-tabs').addEventListener('click', event => {
      const button = event.target.closest('[data-market-tab]');
      if (!button) return;
      this.activeTab = button.dataset.marketTab;
      this.render();
    });
    this.content.addEventListener('click', event => this.handleAction(event));
  }

  show() {
    this.activeTab = 'OFFERS';
    this.modal.classList.remove('hidden');
    this.render();
  }

  hide() { this.modal.classList.add('hidden'); }

  render() {
    const player = this.state.getCurrentPlayer();
    this.balance.textContent = `$${player.cash.toLocaleString()}`;
    document.querySelectorAll('[data-market-tab]').forEach(button => button.classList.toggle('active', button.dataset.marketTab === this.activeTab));
    if (this.activeTab === 'ASSETS') this.renderAssets(player);
    else if (this.activeTab === 'HISTORY') this.renderHistory();
    else this.renderOffers(player);
  }

  renderOffers(player) {
    const offers = this.state.marketOffers.map(offer => getMarketOfferView(this.state, offer));
    if (!offers.length) {
      this.content.innerHTML = '<div class="market-empty"><span>🏙️</span><strong>交易大厅暂时没有挂牌</strong><p>前往“我的资产”发布第一笔报价。</p></div>';
      return;
    }
    this.content.innerHTML = `<div class="market-offer-grid">${offers.map(view => {
      const own = view.sellerId === player.id;
      const discount = Math.round((view.rate - 1) * 100);
      const rateClass = discount <= -10 ? 'deal' : discount >= 15 ? 'premium' : '';
      return `<article class="market-offer-card" data-offer-id="${escapeHTML(view.id)}">
        <div class="market-asset-icon">${escapeHTML(view.asset?.icon || '📦')}</div>
        <div class="market-offer-main"><div class="market-card-kicker">${kindLabel[view.kind]} · ${escapeHTML(view.seller?.name || '未知卖家')}</div>
          <h3>${escapeHTML(view.asset?.name || view.contentId)}</h3>
          <p>${escapeHTML(view.asset?.description || '')}</p>
          <div class="market-price-row"><strong>$${view.price.toLocaleString()}</strong><span>参考 $${view.referenceValue.toLocaleString()}</span>
            <em class="${rateClass}">${discount > 0 ? '+' : ''}${discount}%</em></div>
          <small>第 ${view.expiresRound} 回合到期 · 剩余 ${view.roundsLeft} 回合</small></div>
        <button class="${own ? 'btn-secondary' : 'btn-primary'} btn-sm" data-market-action="${own ? 'CANCEL' : 'BUY'}" data-offer-id="${escapeHTML(view.id)}">${own ? '撤销' : '购买'}</button>
      </article>`;
    }).join('')}</div>`;
  }

  getAssets(player) {
    const properties = [...this.state.propertyManager.properties.entries()]
      .filter(([, property]) => property.owner === player.id)
      .map(([id]) => getMarketAsset(this.state, 'PROPERTY', id));
    const cards = [...new Set(player.cards || [])].map(id => getMarketAsset(this.state, 'CARD', id));
    const items = [...new Set(player.items || [])].map(id => getMarketAsset(this.state, 'ITEM', id));
    return [...properties, ...cards, ...items].filter(Boolean);
  }

  renderAssets(player) {
    const listed = new Set(this.state.marketOffers.filter(offer => offer.sellerId === player.id).map(offer => `${offer.kind}:${offer.contentId}`));
    const assets = this.getAssets(player);
    if (!assets.length) {
      this.content.innerHTML = '<div class="market-empty"><span>🧳</span><strong>没有可挂牌资产</strong><p>购买地产、卡片或道具后再来看看。</p></div>';
      return;
    }
    this.content.innerHTML = `<div class="market-assets-list">${assets.map(asset => {
      const isListed = listed.has(`${asset.kind}:${asset.contentId}`);
      const disabled = isListed || !asset.transferable;
      return `<article class="market-asset-row"><div class="market-asset-icon">${escapeHTML(asset.icon)}</div>
        <div><div class="market-card-kicker">${kindLabel[asset.kind]}</div><h3>${escapeHTML(asset.name)}</h3><p>${escapeHTML(asset.description || '')}</p></div>
        <div class="market-listing-controls"><span>参考价 <strong>$${asset.referenceValue.toLocaleString()}</strong></span>
          ${disabled ? `<button class="btn-secondary btn-sm" disabled>${isListed ? '已挂牌' : '不可交易'}</button>`
            : [0.75, 1, 1.25].map(rate => `<button class="btn-secondary btn-sm" data-market-action="LIST" data-kind="${asset.kind}" data-content-id="${escapeHTML(asset.contentId)}" data-price="${Math.round(asset.referenceValue * rate)}">${Math.round(rate * 100)}% · $${Math.round(asset.referenceValue * rate).toLocaleString()}</button>`).join('')}</div>
      </article>`;
    }).join('')}</div>`;
  }

  renderHistory() {
    const history = [...(this.state.marketHistory || [])].reverse();
    if (!history.length) {
      this.content.innerHTML = '<div class="market-empty"><span>🧾</span><strong>还没有交易流水</strong><p>挂牌、成交、撤销与到期记录都会保留在这里。</p></div>';
      return;
    }
    this.content.innerHTML = `<div class="market-history-list">${history.map(entry => {
      const asset = getMarketAsset(this.state, entry.kind, entry.contentId);
      const seller = this.state.players[entry.sellerId];
      const buyer = this.state.players[entry.buyerId];
      return `<div class="market-history-row"><span>${escapeHTML(asset?.icon || '📦')}</span><div><strong>${historyLabel[entry.type] || entry.type} · ${escapeHTML(asset?.name || entry.contentId)}</strong>
        <small>第 ${entry.round} 回合 · ${escapeHTML(seller?.name || '未知卖家')}${buyer ? ` → ${escapeHTML(buyer.name)}` : ''}</small></div><b>$${Number(entry.price || 0).toLocaleString()}</b></div>`;
    }).join('')}</div>`;
  }

  handleAction(event) {
    const button = event.target.closest('[data-market-action]');
    if (!button) return;
    const player = this.state.getCurrentPlayer();
    const action = button.dataset.marketAction;
    let result;
    if (action === 'LIST') result = this.engine.execute({ type: 'CREATE_MARKET_OFFER', playerId: player.id, payload: {
      kind: button.dataset.kind, contentId: button.dataset.contentId, price: Number(button.dataset.price) } });
    if (action === 'CANCEL') result = this.engine.execute({ type: 'CANCEL_MARKET_OFFER', playerId: player.id, payload: { offerId: button.dataset.offerId } });
    if (action === 'BUY') {
      const view = getMarketOfferView(this.state, this.state.marketOffers.find(offer => offer.id === button.dataset.offerId));
      if (!globalThis.confirm(`确认以 $${view.price.toLocaleString()} 购买「${view.asset?.name || view.contentId}」？`)) return;
      result = this.engine.execute({ type: 'ACCEPT_MARKET_OFFER', playerId: player.id, payload: { offerId: button.dataset.offerId } });
    }
    if (!result?.success) this.state.addLog(`⚠️ ${result?.reason || '交易失败'}`, 'danger');
    else this.audio?.playSFX?.(action === 'BUY' ? 'coin' : 'click');
    this.onUpdate();
    this.render();
  }
}
