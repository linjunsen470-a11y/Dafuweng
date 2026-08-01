/**
 * Dynamic Stock Market System
 */

export class StockMarket {
  constructor() {
    this.random = Math.random;
    this.stocks = [
      { id: 'TECH', name: '星河智造', code: '600001', price: 100, prevPrice: 100, change: 0, history: [100] },
      { id: 'REALTY', name: '云庭置业', code: '600002', price: 250, prevPrice: 250, change: 0, history: [250] },
      { id: 'BEVERAGE', name: '青柠气泡', code: '600003', price: 50, prevPrice: 50, change: 0, history: [50] },
      { id: 'ENERGY', name: '曙光能源', code: '600004', price: 180, prevPrice: 180, change: 0, history: [180] },
      { id: 'MINING', name: '远山材料', code: '600005', price: 320, prevPrice: 320, change: 0, history: [320] }
    ];

    // 初始化 10 轮历史波动数据
    for (let i = 0; i < 9; i++) {
      this.updateMarket(true);
    }
  }

  setRandomSource(random) {
    this.random = random || Math.random;
  }

  reset() {
    const base = [
      ['TECH', '星河智造', '600001', 100],
      ['REALTY', '云庭置业', '600002', 250],
      ['BEVERAGE', '青柠气泡', '600003', 50],
      ['ENERGY', '曙光能源', '600004', 180],
      ['MINING', '远山材料', '600005', 320]
    ];
    this.stocks = base.map(([id, name, code, price]) => ({
      id, name, code, price, prevPrice: price, change: 0, history: [price]
    }));
    for (let i = 0; i < 9; i++) this.updateMarket(true);
  }

  // 结算回合市场波动
  updateMarket(silent = false) {
    this.stocks.forEach(stock => {
      stock.prevPrice = stock.price;

      // 波动幅度 -9% ~ +10%
      const pct = (this.random() * 0.19) - 0.09;
      let newPrice = Math.round(stock.price * (1 + pct));
      if (newPrice < 10) newPrice = 10;

      stock.price = newPrice;
      stock.change = Math.round(((stock.price - stock.prevPrice) / stock.prevPrice) * 100);

      stock.history.push(stock.price);
      if (stock.history.length > 20) stock.history.shift();
    });
  }

  // 强行暴涨或跌停 (卡片/新闻触发)
  forceStockSurge(stockId, isUp = true) {
    const stock = this.stocks.find(s => s.id === stockId);
    if (!stock) return;

    stock.prevPrice = stock.price;
    const factor = isUp ? 1.10 : 0.90;
    stock.price = Math.round(stock.price * factor);
    stock.change = isUp ? 10 : -10;
    stock.history.push(stock.price);
  }

  buyStock(player, stockId, shares) {
    const stock = this.stocks.find(s => s.id === stockId);
    if (!stock || shares <= 0) return { success: false, msg: '参数无效' };

    const totalCost = stock.price * shares;
    if (player.cash < totalCost) {
      return { success: false, msg: `现金不足，需要 $${totalCost.toLocaleString()}` };
    }

    player.cash -= totalCost;

    if (!player.stocks[stockId]) {
      player.stocks[stockId] = { shares: 0, avgPrice: 0 };
    }

    const holding = player.stocks[stockId];
    const prevTotal = holding.shares * holding.avgPrice;
    holding.shares += shares;
    holding.avgPrice = Math.round((prevTotal + totalCost) / holding.shares);

    return { success: true, cost: totalCost, msg: `成功买入 ${stock.name} ${shares} 股！` };
  }

  sellStock(player, stockId, shares) {
    const stock = this.stocks.find(s => s.id === stockId);
    if (!stock || shares <= 0) return { success: false, msg: '参数无效' };

    const holding = player.stocks[stockId];
    if (!holding || holding.shares < shares) {
      return { success: false, msg: '持仓股票数量不足' };
    }

    let revenue = stock.price * shares;
    if (player.skillName === '股市高手') revenue = Math.round(revenue * 1.15);
    if (player.skillName === '剑道大师') revenue = Math.round(revenue * 1.10);
    player.cash += revenue;
    holding.shares -= shares;

    if (holding.shares === 0) {
      delete player.stocks[stockId];
    }

    return { success: true, revenue, msg: `成功抛售 ${stock.name} ${shares} 股，回笼资金 $${revenue.toLocaleString()}！` };
  }
}
