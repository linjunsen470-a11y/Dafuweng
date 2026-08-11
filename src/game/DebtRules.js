export function getStockSaleMultiplier(player) {
  if (player?.skillName === '股市高手') return 1.15;
  if (player?.skillName === '剑道大师') return 1.10;
  return 1;
}

export function estimateStockSaleRevenue(player, stock, shares) {
  return Math.round(Number(stock?.price || 0) * Math.max(0, Number(shares || 0)) * getStockSaleMultiplier(player));
}

export function getSuggestedStockShares(player, stock, holding, cashGap) {
  const perShare = estimateStockSaleRevenue(player, stock, 1);
  if (!perShare || cashGap <= 0) return 0;
  return Math.min(Number(holding?.shares || 0), Math.ceil(cashGap / perShare));
}

export function getDebtSourceInfo(state, debt) {
  const creditor = debt?.creditorId === null || debt?.creditorId === undefined
    ? null
    : state.players.find(player => player.id === debt.creditorId);
  if (String(debt?.source || '').startsWith('RENT:')) {
    const tileId = Number(String(debt.source).split(':')[1]);
    return {
      icon: '🏠',
      label: `${state.getTile(tileId)?.name || '地产'}过路费`,
      creditorName: creditor?.name || '城市资产管理局'
    };
  }
  return { icon: '🧾', label: debt?.source || '待结算债务', creditorName: creditor?.name || '城市财政中心' };
}

export function getDebtPortfolio(state, player, debt = state.pendingDebt) {
  const amountDue = Math.max(0, Number(debt?.amountDue || 0));
  const gap = Math.max(0, amountDue - Number(player.cash || 0));
  const stocks = Object.entries(player.stocks || {}).map(([stockId, holding]) => {
    const stock = state.stockMarket.stocks.find(item => item.id === stockId);
    const shares = Number(holding?.shares || 0);
    return {
      id: stockId,
      name: stock?.name || stockId,
      shares,
      price: Number(stock?.price || 0),
      value: estimateStockSaleRevenue(player, stock, shares),
      suggestedShares: getSuggestedStockShares(player, stock, holding, gap)
    };
  }).filter(item => item.shares > 0);

  const properties = [...state.propertyManager.properties.entries()]
    .filter(([, property]) => property.owner === player.id)
    .map(([tileId, property]) => {
      const tile = state.getTile(tileId);
      const buildingValue = Number(property.level || 0) * Math.round(Number(tile?.buildCost || 0) * 0.5);
      const mortgageValue = property.isMortgaged ? 0 : Math.round(Number(tile?.price || 0) * 0.5);
      return {
        tileId,
        name: tile?.name || `地产 ${tileId}`,
        level: Number(property.level || 0),
        isMortgaged: Boolean(property.isMortgaged),
        buildingValue,
        mortgageValue,
        liquidatableValue: buildingValue + mortgageValue
      };
    });

  const stockValue = stocks.reduce((sum, item) => sum + item.value, 0);
  const propertyValue = properties.reduce((sum, item) => sum + item.liquidatableValue, 0);
  const liquidatableTotal = Number(player.cash || 0) + Number(player.deposit || 0) + stockValue + propertyValue;
  return {
    amountDue,
    gap,
    cash: Number(player.cash || 0),
    deposit: Number(player.deposit || 0),
    stocks,
    properties,
    stockValue,
    propertyValue,
    liquidatableTotal,
    solvent: liquidatableTotal >= amountDue,
    source: getDebtSourceInfo(state, debt)
  };
}
