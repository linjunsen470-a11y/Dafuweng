/** Presentation-only recap from public state; no new save ledger or AI choices. */
export function captureAITurn(session, p=session.currentPlayer) {
  return {id:p.id,name:p.name,round:session.state.round,partial:p.id===session.currentPlayer.id&&session.state.phase!=='PRE_ROLL_ACTION',cash:p.cash,points:p.cardPoints,
    completed:session.careers[p.id]?.completed||0,properties:new Map([...session.state.propertyManager.properties].map(([id,v])=>[id,{...v}])),lastLog:session.state.logHistory.at(-1)};
}
export function summarizeAITurn(session,before) {
  const p=session.state.players.find(p=>p.id===before.id),changes=[];
  for(const [id,now] of session.state.propertyManager.properties){
    const old=before.properties.get(id),name=`${id}号 ${session.state.getTile(id).name}`;
    if(now.owner===p.id&&old?.owner!==p.id)changes.push(`新增产权 ${name} · L${now.level}`);
    else if(old?.owner===p.id&&now.owner!==p.id)changes.push(`失去 ${name}`);
    else if(now.owner===p.id&&old?.level!==now.level)changes.push(`${name} · L${old.level} → L${now.level}`);
  }
  const start=session.state.logHistory.indexOf(before.lastLog);
  return {name:p.name,round:before.round,partial:before.partial,tileId:p.currentTile,tileName:session.state.getTile(p.currentTile).name,
    movementStop:before.movementStop||'',cashDelta:p.cash-before.cash,pointDelta:p.cardPoints-before.points,completed:(session.careers[p.id]?.completed||0)-before.completed,
    changes,logs:session.state.logHistory.slice(start+1).map(log=>log.msg)};
}

// A presentation checkpoint only. Never pause movement, debt or an auction,
// and never replace a living human's normal decision flow.
export function canPauseSpectating(session){
 return Boolean(session.state.players[0]?.isBankrupt&&session.currentPlayer?.isAI&&
  !session.currentPlayer.isBankrupt&&session.state.phase==='PRE_ROLL_ACTION'&&
  !session.state.pendingMove&&!session.state.pendingDebt&&!session.state.auction&&
  !session.awaitingAuctionContinue&&!session.aiRunning);
}
