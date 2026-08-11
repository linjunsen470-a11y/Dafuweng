const number = value => Number(value || 0);

export function captureNewsMetrics(state) {
  return {
    players: state.players.map(player => ({
      id: player.id,
      name: player.name,
      cash: number(player.cash),
      deposit: number(player.deposit),
      cardPoints: number(player.cardPoints)
    })),
    stocks: state.stockMarket.stocks.map(stock => ({ id: stock.id, name: stock.name, price: number(stock.price) })),
    propertyLevels: [...state.propertyManager.properties.values()].reduce((sum, property) => sum + number(property.level), 0),
    roadEntities: state.roadEntities.length,
    researchRounds: state.researchTasks.reduce((sum, task) => sum + number(task.roundsRemaining), 0),
    companies: state.companyManager.companies.map(company => ({
      id: company.id,
      name: company.name,
      treasury: number(company.treasury),
      periodRevenue: number(company.periodRevenue)
    })),
    newsEffect: state.newsEffect ? structuredClone(state.newsEffect) : null
  };
}

export function summarizeNewsImpact(before, after) {
  const impacts = [];
  const add = (icon, label, detail, tone = 'neutral') => impacts.push({ icon, label, detail, tone });

  after.players.forEach(player => {
    const previous = before.players.find(item => item.id === player.id);
    if (!previous) return;
    const cashDelta = player.cash - previous.cash;
    const depositDelta = player.deposit - previous.deposit;
    const pointsDelta = player.cardPoints - previous.cardPoints;
    if (cashDelta) add('💵', player.name, `现金 ${cashDelta > 0 ? '+' : '−'}$${Math.abs(cashDelta).toLocaleString()}`, cashDelta > 0 ? 'gain' : 'loss');
    if (depositDelta) add('🏦', player.name, `存款 ${depositDelta > 0 ? '+' : '−'}$${Math.abs(depositDelta).toLocaleString()}`, depositDelta > 0 ? 'gain' : 'loss');
    if (pointsDelta) add('🎟️', player.name, `点券 ${pointsDelta > 0 ? '+' : '−'}${Math.abs(pointsDelta)}`, pointsDelta > 0 ? 'gain' : 'loss');
  });

  after.stocks.forEach(stock => {
    const previous = before.stocks.find(item => item.id === stock.id);
    if (!previous || previous.price === stock.price) return;
    const percentage = previous.price ? Math.round(((stock.price - previous.price) / previous.price) * 100) : 0;
    add(percentage >= 0 ? '📈' : '📉', stock.name, `股价 ${percentage >= 0 ? '+' : ''}${percentage}% · $${stock.price}`, percentage >= 0 ? 'gain' : 'loss');
  });

  const propertyDelta = after.propertyLevels - before.propertyLevels;
  if (propertyDelta) add('🏘️', '城市建筑', `总等级 ${propertyDelta > 0 ? '+' : ''}${propertyDelta}`, propertyDelta > 0 ? 'gain' : 'loss');
  const roadDelta = after.roadEntities - before.roadEntities;
  if (roadDelta) add('🚧', '道路设施', `${roadDelta > 0 ? '新增' : '清除'} ${Math.abs(roadDelta)} 个`, roadDelta > 0 ? 'warning' : 'gain');
  const researchDelta = after.researchRounds - before.researchRounds;
  if (researchDelta) add('🧪', '研发进度', `总剩余轮次 ${researchDelta > 0 ? '+' : ''}${researchDelta}`, researchDelta < 0 ? 'gain' : 'warning');

  after.companies.forEach(company => {
    const previous = before.companies.find(item => item.id === company.id);
    if (!previous) return;
    const delta = (company.treasury + company.periodRevenue) - (previous.treasury + previous.periodRevenue);
    if (delta) add('🏢', company.name, `经营资金 ${delta > 0 ? '+' : '−'}$${Math.abs(delta).toLocaleString()}`, delta > 0 ? 'gain' : 'loss');
  });

  if (after.newsEffect?.id && after.newsEffect?.id !== before.newsEffect?.id) {
    add('⏳', '限时市场效果', `持续 ${after.newsEffect.remainingRounds} 轮`, 'warning');
  }

  return impacts.length ? impacts.slice(0, 8) : [{ icon: '🌆', label: '城市状态', detail: '事件影响已经生效', tone: 'neutral' }];
}

export function getNewsPresentation(event, index) {
  const text = `${event.title}${event.desc}`;
  if (/股票|股价|股市|企业|公司|百货|保险/.test(text)) return { id: `NEWS_${index + 1}`, category: '财经', icon: '📊', tone: 'market' };
  if (/地产|建筑|房屋|城市更新/.test(text)) return { id: `NEWS_${index + 1}`, category: '地产', icon: '🏙️', tone: 'property' };
  if (/道路|交通|汽车|出行/.test(text)) return { id: `NEWS_${index + 1}`, category: '城市', icon: '🚦', tone: 'city' };
  if (/补贴|奖励|扶持|储蓄|消费/.test(text)) return { id: `NEWS_${index + 1}`, category: '民生', icon: '🎁', tone: 'benefit' };
  return { id: `NEWS_${index + 1}`, category: '快讯', icon: '📰', tone: 'breaking' };
}
