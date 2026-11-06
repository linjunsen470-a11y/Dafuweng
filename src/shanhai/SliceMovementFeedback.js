/** Optional presentation receipt from a consumed obstacle event, never inferred from a missing fence. */
export function movementStopText(session,stop=session.lastMovementStop){
 if(!stop||stop.kind!=='OBSTACLE'||stop.playerId!==session.currentPlayer?.id||!session.state.getTile(stop.tileId)||![stop.steps,stop.unused].every(n=>Number.isInteger(n)&&n>=0)||stop.steps<1)return '';
 return `围栏截停：原定${stop.steps+stop.unused}步，实际走${stop.steps}步，在${stop.tileId}号停下；${stop.unused?`剩余${stop.unused}步取消，`:'已走完本次步数，'}围栏已移除。本站仍照常处理。`;
}
