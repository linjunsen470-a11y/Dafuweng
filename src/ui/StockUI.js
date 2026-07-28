export class StockUI {
  constructor(gameState, audioManager, onUpdateHUD) {
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.onUpdateHUD = onUpdateHUD;
    this.selectedStockId = 'TECH';

    this.modal = document.getElementById('modal-stock');
    this.stockListContainer = document.getElementById('stock-list-container');
    this.selectedName = document.getElementById('stock-selected-name');
    this.holdingCount = document.getElementById('stock-holding-count');
    this.holdingAvg = document.getElementById('stock-holding-avg');
    this.tradeAmountInput = document.getElementById('stock-trade-amount');
    this.canvas = document.getElementById('stock-chart');
    this.ctx = this.canvas.getContext('2d');

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('stock-modal-close').addEventListener('click', () => this.hide());
    document.getElementById('btn-stock-buy').addEventListener('click', () => this.handleBuy());
    document.getElementById('btn-stock-sell').addEventListener('click', () => this.handleSell());
  }

  show(onClose = null) {
    this.onClose = onClose;
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
    const res = this.gameState.stockMarket.buyStock(curPlayer, this.selectedStockId, shares);

    if (res.success) {
      this.audioManager.playCoinSound();
      this.gameState.addLog(`📈 ${curPlayer.name} ${res.msg}`, 'success');
      this.render();
      if (this.onUpdateHUD) {
        this.onUpdateHUD();
      }
    } else {
      alert(res.msg);
    }
  }

  handleSell() {
    const curPlayer = this.gameState.getCurrentPlayer();
    const shares = parseInt(this.tradeAmountInput.value, 10) || 10;
    const res = this.gameState.stockMarket.sellStock(curPlayer, this.selectedStockId, shares);

    if (res.success) {
      this.audioManager.playCoinSound();
      this.gameState.addLog(`💰 ${curPlayer.name} ${res.msg}`, 'gold');
      this.render();
      if (this.onUpdateHUD) {
        this.onUpdateHUD();
      }
    } else {
      alert(res.msg);
    }
  }
}
