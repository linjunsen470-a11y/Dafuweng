const PRE_ROLL_COMMANDS = new Set([
  'BUY_STOCK', 'BUY_CARD', 'USE_CARD', 'ROLL_DICE', 'SELECT_DICE_COUNT',
  'BUY_ITEM', 'SELL_INVENTORY', 'USE_ITEM', 'PLACE_ROAD_ENTITY',
  'CREATE_MARKET_OFFER', 'ACCEPT_MARKET_OFFER', 'CANCEL_MARKET_OFFER', 'START_AUCTION'
]);
const PROPERTY_MANAGEMENT_COMMANDS = new Set([
  'SELL_BUILDING', 'MORTGAGE_PROPERTY', 'REDEEM_PROPERTY', 'CHOOSE_BUILDING_TYPE'
]);
const LANDING_COMMANDS = new Set([
  'PURCHASE_PROPERTY',
  'UPGRADE_PROPERTY',
  'SETTLE_RENT',
  'RESOLVE_LANDING',
  'BANK_TRANSFER',
  'BUY_LOTTERY',
  'CAST_MAGIC',
  'RESOLVE_MAGIC',
  'START_RESEARCH',
  'SUBMIT_MINIGAME_RESULT'
]);
const DEBT_COMMANDS = new Set([
  'LIQUIDATE_DEPOSIT',
  'PAY_DEBT',
  'AUTO_SETTLE_DEBT',
  'DECLARE_BANKRUPTCY'
]);

export function validateCommand(state, player, command) {
  const type = command.type;
  if (player.isBankrupt && type !== 'END_TURN') return { success: false, reason: '破产玩家不能执行操作' };
  if (type === 'PAUSE_GAME' || type === 'RESUME_GAME') return null;
  if (type === 'PLACE_BID' && state.phase === 'AUCTION') {
    return state.auction?.bidderOrder?.[state.auction.bidderIndex] === player.id
      ? null
      : { success: false, reason: '尚未轮到该玩家出价' };
  }
  if (player.id !== state.currentPlayerIndex) return { success: false, reason: '只能由当前玩家执行操作' };

  if (PROPERTY_MANAGEMENT_COMMANDS.has(type)) {
    const debtAction = ['SELL_BUILDING', 'MORTGAGE_PROPERTY'].includes(type)
      && state.phase === 'DEBT_SETTLEMENT' && state.pendingDebt?.debtorId === player.id;
    const preRollAction = state.phase === 'PRE_ROLL_ACTION';
    const landingChange = type === 'CHOOSE_BUILDING_TYPE' && state.phase === 'LANDING_ACTION'
      && Number(command.payload?.tileId) === player.currentTile;
    if (!debtAction && !preRollAction && !landingChange) return { success: false, reason: '只能在掷骰前经营地产' };
    return null;
  }

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
