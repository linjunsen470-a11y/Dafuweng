/** Public route comparisons only: no random draws, purchases or board changes. */
export function counterRoute(session,direction,clearTile=null,fromTileId=session.currentPlayer?.currentTile){
 const s=session.state,p=session.currentPlayer,pm=s.propertyManager;
 const stops=[1,2,3,4,5,6].map(steps=>{
  let path=s.mapRuntime.projectPath(fromTileId,steps,direction);
  const fence=path.findIndex(id=>id!==clearTile&&pm.getProperty(id)?.hasObstacle);if(fence>=0)path=path.slice(0,fence+1);
  const id=path.at(-1),prop=pm.getProperty(id),rent=prop?.owner!=null&&prop.owner!==p.id?pm.calculateToll(id,s.newsEffect,s.priceIndex):0;
  return {steps,tileId:id,name:s.getTile(id).name,obstacleStop:fence>=0,rent};
 });return {stops,meanRent:Math.round(stops.reduce((sum,t)=>sum+t.rent,0)/6),maxRent:Math.max(...stops.map(t=>t.rent))};
}
export function fenceCounterplay(session){
 const p=session.currentPlayer;if(!p||session.state.phase!=='PRE_ROLL_ACTION')return null;
 const path=session.state.mapRuntime.projectPath(p.currentTile,6,p.direction||1),index=path.findIndex(id=>session.state.propertyManager.getProperty(id)?.hasObstacle);if(index<0)return null;
 const tileId=path[index],keep=counterRoute(session,p.direction||1),clear=counterRoute(session,p.direction||1,tileId),reverse=counterRoute(session,-(p.direction||1));
 return {tileId,name:session.state.getTile(tileId).name,distance:index+1,keep,clear,reverse,clearSaving:keep.meanRent-clear.meanRent};
}
