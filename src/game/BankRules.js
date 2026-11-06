export const BANK_INTEREST_RATE = 0.05;
export const BANK_SAFE_CASH = 6000;

export function getBankCycleInfo(state) {
  const cycle = Math.max(1, Number(state.economicCycle?.roundsPerPeriod) || 5);
  return {
    cycle,
    roundsUntilSettlement: (cycle - (state.round % cycle)) % cycle,
    period: Number(state.economicCycle?.period) || 1
  };
}

export function getBankTransferPreview(state, player, direction, amount) {
  const normalizedDirection = direction === 'WITHDRAW' ? 'WITHDRAW' : 'DEPOSIT';
  const cash = Math.max(0, Math.floor(Number(player.cash) || 0));
  const deposit = Math.max(0, Math.floor(Number(player.deposit) || 0));
  const sourceBalance = normalizedDirection === 'DEPOSIT' ? cash : deposit;
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  let reason = '';
  if (!value) reason = '请输入大于零的金额';
  else if (value > sourceBalance) reason = normalizedDirection === 'DEPOSIT' ? '现金不足' : '存款不足';
  const effective = Math.min(value, sourceBalance);
  const cashAfter = normalizedDirection === 'DEPOSIT' ? cash - effective : cash + effective;
  const depositAfter = normalizedDirection === 'DEPOSIT' ? deposit + effective : deposit - effective;
  const projectedInterest = Math.round(depositAfter * BANK_INTEREST_RATE);
  const currentInterest = Math.round(deposit * BANK_INTEREST_RATE);
  const risk = cashAfter < 2000
    ? { id: 'CRITICAL', icon: '⚠️', label: '现金告急', description: '可用现金不足以应对高额租金与突发事件' }
    : cashAfter < BANK_SAFE_CASH
      ? { id: 'WATCH', icon: '🛡️', label: '谨慎配置', description: '现金安全垫偏低，建议保留部分流动资金' }
      : { id: 'STABLE', icon: '✅', label: '流动性稳健', description: '现金储备足以覆盖常见经营支出' };
  return {
    direction: normalizedDirection,
    amount: value,
    effectiveAmount: effective,
    enabled: !reason,
    reason,
    cash,
    deposit,
    cashAfter,
    depositAfter,
    liquidTotal: cashAfter + depositAfter,
    sourceBalance,
    projectedInterest,
    currentInterest,
    interestDelta: projectedInterest - currentInterest,
    risk,
    ...getBankCycleInfo(state)
  };
}

export function chooseAIBankTransfer(state, player) {
  const reserve = player.aiStrategy === 'ECONOMY' ? 5000 : player.aiStrategy === 'AGGRESSIVE' ? 8500 : BANK_SAFE_CASH;
  const cash = Math.max(0, Number(player.cash) || 0);
  const deposit = Math.max(0, Number(player.deposit) || 0);
  if (cash < 3500 && deposit > 0) return { direction: 'WITHDRAW', amount: Math.min(deposit, Math.ceil(5500 - cash)) };
  const excess = Math.floor(cash - reserve);
  if (excess > 1000) return { direction: 'DEPOSIT', amount: excess };
  return null;
}
