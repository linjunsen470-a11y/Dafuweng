export const BANK_INTEREST_RATE = 0.05;
export const BANK_SAFE_CASH = 6000;
export const BANK_LOAN_CAP = 10000;

export function getBankCycleInfo(state) {
  const cycle = Math.max(1, Number(state.economicCycle?.roundsPerPeriod) || 5);
  return {
    cycle,
    roundsUntilSettlement: (cycle - (state.round % cycle)) % cycle,
    period: Number(state.economicCycle?.period) || 1
  };
}

export function getBankTransferPreview(state, player, direction, amount) {
  const normalizedDirection = ['WITHDRAW', 'LOAN', 'REPAY_LOAN'].includes(direction) ? direction : 'DEPOSIT';
  const cash = Math.max(0, Math.floor(Number(player.cash) || 0));
  const deposit = Math.max(0, Math.floor(Number(player.deposit) || 0));
  const loan = Math.max(0, Math.floor(Number(player.loan) || 0));
  const loanAvailable = Math.max(0, BANK_LOAN_CAP - loan);

  const sourceBalance = normalizedDirection === 'DEPOSIT' ? cash
    : normalizedDirection === 'WITHDRAW' ? deposit
      : normalizedDirection === 'LOAN' ? loanAvailable
        : Math.min(cash, loan);

  const value = Math.max(0, Math.floor(Number(amount) || 0));
  let reason = '';
  if (!value) reason = '请输入大于零的金额';
  else if (value > sourceBalance) {
    reason = normalizedDirection === 'DEPOSIT' ? '现金不足'
      : normalizedDirection === 'WITHDRAW' ? '存款不足'
        : normalizedDirection === 'LOAN' ? '已达最高贷款额度'
          : loan <= 0 ? '当前没有待还贷款' : '现金不足以偿还';
  }
  const effective = Math.min(value, sourceBalance);
  const cashAfter = normalizedDirection === 'DEPOSIT' ? cash - effective
    : normalizedDirection === 'WITHDRAW' ? cash + effective
      : normalizedDirection === 'LOAN' ? cash + effective
        : cash - effective;
  const depositAfter = normalizedDirection === 'DEPOSIT' ? deposit + effective
    : normalizedDirection === 'WITHDRAW' ? deposit - effective
      : deposit;
  const loanAfter = normalizedDirection === 'LOAN' ? loan + effective
    : normalizedDirection === 'REPAY_LOAN' ? loan - effective
      : loan;

  const projectedInterest = Math.round(depositAfter * BANK_INTEREST_RATE);
  const currentInterest = Math.round(deposit * BANK_INTEREST_RATE);
  const risk = cashAfter < 2000
    ? { id: 'CRITICAL', icon: '⚠️', label: '现金告急', description: '手头现金太少，踩中豪宅容易资金链断裂' }
    : cashAfter < BANK_SAFE_CASH
      ? { id: 'WATCH', icon: '🛡️', label: '谨慎周转', description: '现金安全垫偏低，留点现钱更稳妥' }
      : { id: 'STABLE', icon: '✅', label: '手头宽裕', description: '现金充沛，买地交租两不误' };

  return {
    direction: normalizedDirection,
    amount: value,
    effectiveAmount: effective,
    enabled: !reason,
    reason,
    cash,
    deposit,
    loan,
    loanCap: BANK_LOAN_CAP,
    loanAvailable,
    cashAfter,
    depositAfter,
    loanAfter,
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
