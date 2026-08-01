const PRE_ROLL_COMMANDS = new Set(['BUY_STOCK', 'BUY_CARD', 'USE_CARD', 'ROLL_DICE']);
const LANDING_COMMANDS = new Set([
  'PURCHASE_PROPERTY',
  'UPGRADE_PROPERTY',
  'SETTLE_RENT',
  'RESOLVE_LANDING',
  'BANK_TRANSFER',
  'BUY_LOTTERY',
  'CAST_MAGIC'
]);
const DEBT_COMMANDS = new Set([
  'SELL_BUILDING',
  'MORTGAGE_PROPERTY',
  'REDEEM_PROPERTY',
  'PAY_DEBT',
  'AUTO_SETTLE_DEBT',
  'DECLARE_BANKRUPTCY'
]);

export function validateCommand(state, player, command) {
  const type = command.type;
  if (player.isBankrupt && type !== 'END_TURN') return { success: false, reason: '破产玩家不能执行操作' };
  if (type === 'PAUSE_GAME' || type === 'RESUME_GAME') return null;
  if (player.id !== state.currentPlayerIndex) return { success: false, reason: '只能由当前玩家执行操作' };

  if (PRE_ROLL_COMMANDS.has(type) && state.phase !== 'PRE_ROLL_ACTION') {
    return { success: false, reason: '该操作只能在掷骰前执行' };
  }
  if (type === 'SELL_STOCK'
    && state.phase !== 'PRE_ROLL_ACTION'
    && !(state.phase === 'DEBT_SETTLEMENT' && state.pendingDebt?.debtorId === player.id)) {
    return { success: false, reason: '当前不能卖出股票' };
  }
  if (type === 'BEGIN_MOVE' && state.phase !== 'ROLLING') {
    return { success: false, reason: '只有掷骰完成后才能开始移动' };
  }
  if (type === 'ADVANCE_MOVE' && !['MOVING', 'ROUTE_CHOICE'].includes(state.phase)) {
    return { success: false, reason: '当前没有可继续的移动' };
  }
  if (type === 'TELEPORT_PLAYER' && state.phase !== 'PRE_ROLL_ACTION') {
    return { success: false, reason: '当前不能传送' };
  }
  if (LANDING_COMMANDS.has(type)) {
    if (state.phase !== 'LANDING_ACTION') return { success: false, reason: '当前不在落地结算阶段' };
    if (Number(command.payload?.tileId) !== player.currentTile) {
      return { success: false, reason: '只能结算玩家当前所在位置' };
    }
  }
  if (DEBT_COMMANDS.has(type)
    && (state.phase !== 'DEBT_SETTLEMENT' || state.pendingDebt?.debtorId !== player.id)) {
    return { success: false, reason: '当前不在债务清算阶段' };
  }
  if (type === 'END_TURN' && state.phase !== 'LANDING_ACTION') {
    return { success: false, reason: '当前不能结束回合' };
  }
  return null;
}
