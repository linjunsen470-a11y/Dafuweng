import { COMPANY_PERKS, COMPANY_POLICIES, getCompanyPolicy } from '../game/CompanyRules.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

export class StockUI {
  constructor(gameState, audioManager, onUpdateHUD, gameEngine = null) {
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.onUpdateHUD = onUpdateHUD;
    this.gameEngine = gameEngine;
    this.selectedStockId = 'TECH';
    this.activeTab = 'MARKET';

    this.modal = document.getElementById('modal-stock');
    this.stockListContainer = document.getElementById('stock-list-container');
    this.selectedName = document.getElementById('stock-selected-name');
    this.holdingCount = document.getElementById('stock-holding-count');
    this.holdingAvg = document.getElementById('stock-holding-avg');
    this.tradeAmountInput = document.getElementById('stock-trade-amount');
    this.canvas = document.getElementById('stock-chart');
    this.ctx = this.canvas.getContext('2d');
    this.marketPanel = document.getElementById('stock-market-panel');
    this.companyPanel = document.getElementById('company-management-panel');

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('stock-modal-close').addEventListener('click', () => this.hide());
    document.getElementById('btn-stock-buy').addEventListener('click', () => this.handleBuy());
    document.getElementById('btn-stock-sell').addEventListener('click', () => this.handleSell());
    document.getElementById('stock-center-tabs').addEventListener('click', event => {
      const button = event.target.closest('[data-stock-tab]');
      if (!button) return;
      this.activeTab = button.dataset.stockTab;
      this.render();
    });
    this.companyPanel.addEventListener('click', event => this.handleCompanyAction(event));
  }

  show(onClose = null, tab = 'MARKET') {
    this.onClose = onClose;
    this.activeTab = tab;
    this.modal.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.modal.classList.add('hidden');
    const callback = this.onClose;
    this.onClose = null;
    if (callback) callback();
  }

  render() {
    document.querySelectorAll('[data-stock-tab]').forEach(button => button.classList.toggle('active', button.dataset.stockTab === this.activeTab));
    this.marketPanel.classList.toggle('hidden', this.activeTab !== 'MARKET');
    this.companyPanel.classList.toggle('hidden', this.activeTab !== 'COMPANIES');
    if (this.activeTab === 'COMPANIES') return this.renderCompanies();
    const curPlayer = this.gameState.getCurrentPlayer();
    const stocks = this.gameState.stockMarket.stocks;

    // 1. 渲染股票列表
    this.stockListContainer.innerHTML = '';
    stocks.forEach(s => {
      const isSelected = s.id === this.selectedStockId;
      const item = document.createElement('div');
      item.className = `stock-item ${isSelected ? 'active' : ''}`;

      const changeClass = s.change >= 0 ? 'price-up' : 'price-down';
      const changeText = s.change >= 0 ? `+${s.change}%` : `${s.change}%`;

      item.innerHTML = `
        <div class="stock-item-top">
          <span>${s.name} (${s.code})</span>
          <span class="${changeClass}">$${s.price}</span>
        </div>
        <div class="stock-item-bot">
          <span>昨收: $${s.prevPrice}</span>
          <span class="${changeClass}">${changeText}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        this.selectedStockId = s.id;
        this.render();
      });

      this.stockListContainer.appendChild(item);
    });

    // 2. 渲染选中股票信息与持仓
    const stock = stocks.find(s => s.id === this.selectedStockId) || stocks[0];
    this.selectedName.textContent = `${stock.name} (${stock.code}) 实时价格: $${stock.price}`;

    const holding = curPlayer.stocks[stock.id];
    if (holding) {
      this.holdingCount.textContent = holding.shares;
      this.holdingAvg.textContent = `$${holding.avgPrice}`;
    } else {
      this.holdingCount.textContent = 0;
      this.holdingAvg.textContent = '$0';
    }

    // 3. 绘制 K 线/趋势折线图
    this.drawChart(stock);
  }

  renderCompanies() {
    const player = this.gameState.getCurrentPlayer();
    const canAct = this.gameState.phase === 'PRE_ROLL_ACTION' && !player.isAI && !player.isBankrupt;
    this.companyPanel.innerHTML = `<div class="company-board-intro"><div><strong>城市公司董事会</strong><span>最大股东自动担任董事长；政策使用公司金库，不消耗个人现金。</span></div>
      <span class="company-board-cycle">第 ${this.gameState.economicCycle.period} 经营周期</span></div>
      <div class="company-board-grid">${this.gameState.companyManager.companies.map(company => {
        const chairman = this.gameState.players[company.chairmanId];
        const stock = this.gameState.stockMarket.stocks.find(item => item.id === company.stockId);
        const shares = player.stocks?.[company.stockId]?.shares || 0;
        const perk = COMPANY_PERKS[company.perk];
        const policy = getCompanyPolicy(company);
        const isChairman = company.chairmanId === player.id;
        const canSetPolicy = canAct && isChairman && !policy;
        const last = company.policyHistory?.at(-1);
        return `<article class="company-board-card ${isChairman ? 'is-chairman' : ''}" data-company-id="${escapeHTML(company.id)}">
          <div class="company-board-head"><span class="company-board-icon">${escapeHTML(company.icon)}</span><div><span class="company-stock-code">${escapeHTML(stock?.code || company.stockId)}</span><h3>${escapeHTML(company.name)}</h3></div>
            <span class="company-chairman-badge">${isChairman ? '你的公司' : escapeHTML(chairman ? `董事长 ${chairman.name}` : '暂无董事长')}</span></div>
          <div class="company-finance-grid"><div><span>公司金库</span><strong>$${company.treasury.toLocaleString()}</strong></div><div><span>周期营收</span><strong>$${company.periodRevenue.toLocaleString()}</strong></div>
            <div><span>上期分红</span><strong>$${company.lastDividend.toLocaleString()}</strong></div><div><span>你的持股</span><strong>${shares} 股</strong></div></div>
          <div class="company-perk"><span>${escapeHTML(perk?.icon || '🏢')}</span><div><strong>${escapeHTML(perk?.name || company.perk)}</strong><small>${escapeHTML(perk?.description || '')}</small></div></div>
          ${policy ? `<div class="company-active-policy"><span>${policy.icon}</span><div><strong>执行中 · ${policy.name}</strong><small>${escapeHTML(policy.description)}</small></div></div>`
            : `<div class="company-policy-options">${COMPANY_POLICIES.map(option => `<button class="btn-secondary btn-sm" data-company-policy="${option.id}" ${canSetPolicy && company.treasury >= option.cost ? '' : 'disabled'} title="${escapeHTML(option.description)}">${option.icon} ${option.name} · $${option.cost}</button>`).join('')}</div>`}
          ${last ? `<div class="company-last-result">上次政策：${escapeHTML(COMPANY_POLICIES.find(entry => entry.id === last.policyId)?.name || last.policyId)} · 分红 $${Number(last.dividendPool || 0).toLocaleString()}</div>` : ''}
        </article>`;
      }).join('')}</div>`;
  }

  handleCompanyAction(event) {
    const button = event.target.closest('[data-company-policy]');
    if (!button) return;
    const companyId = button.closest('[data-company-id]').dataset.companyId;
    const player = this.gameState.getCurrentPlayer();
    const result = this.gameEngine.execute({ type: 'SET_COMPANY_POLICY', playerId: player.id,
      payload: { companyId, policyId: button.dataset.companyPolicy } });
    if (result.success) this.audioManager.playCoinSound();
    else this.gameState.addLog(`⚠️ ${result.reason}`, 'danger');
    this.onUpdateHUD?.();
    this.renderCompanies();
  }

  drawChart(stock) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const history = stock.history || [stock.price];
    if (history.length < 2) return;

    const min = Math.min(...history) * 0.9;
    const max = Math.max(...history) * 1.1;

    // 背景网格
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 绘制趋势折线
    const isUp = history[history.length - 1] >= history[0];
    const lineColor = isUp ? '#ff4757' : '#2ed573';

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.beginPath();

    const stepX = w / (history.length - 1);
    history.forEach((val, idx) => {
      const x = idx * stepX;
      const y = h - ((val - min) / (max - min)) * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 渐变填充
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isUp ? 'rgba(255, 71, 87, 0.25)' : 'rgba(46, 213, 115, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  handleBuy() {
    const curPlayer = this.gameState.getCurrentPlayer();
    const shares = parseInt(this.tradeAmountInput.value, 10) || 10;
    const res = this.gameEngine
      ? this.gameEngine.execute({ type: 'BUY_STOCK', playerId: curPlayer.id, payload: { stockId: this.selectedStockId, shares } })
      : this.gameState.stockMarket.buyStock(curPlayer, this.selectedStockId, shares);

    if (res.success) {
      this.audioManager.playCoinSound();
      this.gameState.addLog(`📈 ${curPlayer.name} ${res.msg}`, 'success');
      this.render();
      if (this.onUpdateHUD) {
        this.onUpdateHUD();
      }
    } else {
      this.gameState.addLog(`⚠️ ${res.msg}`, 'danger');
      if (this.onUpdateHUD) this.onUpdateHUD();
    }
  }

  handleSell() {
    const curPlayer = this.gameState.getCurrentPlayer();
    const shares = parseInt(this.tradeAmountInput.value, 10) || 10;
    const res = this.gameEngine
      ? this.gameEngine.execute({ type: 'SELL_STOCK', playerId: curPlayer.id, payload: { stockId: this.selectedStockId, shares } })
      : this.gameState.stockMarket.sellStock(curPlayer, this.selectedStockId, shares);

    if (res.success) {
      this.audioManager.playCoinSound();
      this.gameState.addLog(`💰 ${curPlayer.name} ${res.msg}`, 'gold');
      this.render();
      if (this.onUpdateHUD) {
        this.onUpdateHUD();
      }
    } else {
      this.gameState.addLog(`⚠️ ${res.msg}`, 'danger');
      if (this.onUpdateHUD) this.onUpdateHUD();
    }
  }
}
