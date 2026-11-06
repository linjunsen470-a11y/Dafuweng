const roundValue = value => Math.round(Number(value) || 0);

export function createEconomicCycleReport({ state, period, round: settlementRound, before = [], lottery, interestPayments = [], settlements = [], modeEvents = [] }) {
  const beforeById = new Map(before.map(entry => [entry.playerId, entry]));
  const interestById = new Map(interestPayments.map(entry => [entry.playerId, entry.amount]));
  const dividendsById = new Map();
  settlements.forEach(settlement => settlement.payments?.forEach(payment => {
    dividendsById.set(payment.playerId, (dividendsById.get(payment.playerId) || 0) + payment.amount);
  }));

  const players = state.players.map(player => {
    const previous = beforeById.get(player.id) || { cash: player.cash, deposit: player.deposit, cardPoints: player.cardPoints };
    const cashDelta = roundValue(player.cash - previous.cash);
    const depositDelta = roundValue(player.deposit - previous.deposit);
    const pointsDelta = roundValue((player.cardPoints || 0) - (previous.cardPoints || 0));
    return {
      playerId: player.id,
      name: player.name,
      color: player.color,
      avatar: player.avatar,
      avatarAtlas: player.avatarAtlas,
      avatarPosition: player.avatarPosition,
      cash: roundValue(player.cash),
      deposit: roundValue(player.deposit),
      cashDelta,
      depositDelta,
      pointsDelta,
      interest: interestById.get(player.id) || 0,
      dividend: dividendsById.get(player.id) || 0,
      cycleGain: cashDelta + depositDelta,
      isBankrupt: Boolean(player.isBankrupt)
    };
  }).sort((a, b) => b.cycleGain - a.cycleGain);

  const companies = settlements.map(settlement => {
    const company = state.companyManager.get(settlement.companyId);
    return {
      companyId: settlement.companyId,
      name: company?.name || settlement.companyId,
      icon: company?.icon || '🏢',
      operation: roundValue(settlement.operation),
      dividendPool: roundValue(settlement.dividendPool),
      treasury: roundValue(settlement.treasury),
      policyId: settlement.policyId,
      payments: structuredClone(settlement.payments || [])
    };
  }).sort((a, b) => b.dividendPool - a.dividendPool);

  const stocks = state.stockMarket.stocks.map(stock => ({
    id: stock.id,
    name: stock.name,
    code: stock.code,
    price: roundValue(stock.price),
    change: roundValue(stock.change),
    history: stock.history.slice(-8).map(roundValue)
  })).sort((a, b) => b.change - a.change);

  return {
    id: `cycle-${period}-round-${settlementRound}`,
    period,
    round: settlementRound,
    priceIndex: state.priceIndex,
    generatedAt: Date.now(),
    lottery: structuredClone(lottery),
    players,
    companies,
    stocks,
    modeEvents: structuredClone(modeEvents),
    totals: {
      interest: interestPayments.reduce((sum, entry) => sum + entry.amount, 0),
      dividends: settlements.reduce((sum, entry) => sum + entry.dividendPool, 0),
      playerGain: players.reduce((sum, player) => sum + player.cycleGain, 0)
    },
    topGainerId: players[0]?.playerId ?? null
  };
}

export function getEconomicReportHeadline(report) {
  const leader = report?.players?.find(player => player.playerId === report.topGainerId);
  if (!leader) return { icon: '🧾', title: '周期财报已发布', detail: '本期暂无玩家收益数据' };
  if (leader.cycleGain > 0) return { icon: '🏆', title: `${leader.name} 领跑本期收益`, detail: `周期净流入 $${leader.cycleGain.toLocaleString()}` };
  return { icon: '📉', title: '本期资金面承压', detail: `${leader.name} 以 $${leader.cycleGain.toLocaleString()} 位居首位` };
}
