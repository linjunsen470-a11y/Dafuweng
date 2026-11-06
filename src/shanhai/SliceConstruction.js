import {BUILDINGS} from '../game/ContentRegistry.js';
import {PropertyManager} from '../game/PropertyManager.js';

export const CONSTRUCTION_ROUND=8;
export const CONSTRUCTION_FEE=300;

/** Public quotes only: no RNG, turns, money or live property mutations. */
export function constructionOptions(session){
 const {state}=session,p=session.currentPlayer;if(!p)return [];
 const pm=state.propertyManager,preview=new PropertyManager();preview.init(session.tiles);
 preview.properties=new Map([...pm.properties].map(([id,prop])=>[id,{...prop}]));
 const rivalPaths=state.players.filter(other=>other.id!==p.id&&!other.isBankrupt).map(other=>{
  let path=state.mapRuntime.projectPath(other.currentTile,6,other.direction||1);
  const fence=path.findIndex(id=>pm.getProperty(id)?.hasObstacle);if(fence>=0)path=path.slice(0,fence+1);
  return path;
 });
 return session.tiles.filter(tile=>['PROPERTY','BIG_PROPERTY'].includes(tile.type)&&pm.getProperty(tile.id)?.owner===p.id).map(tile=>{
  const prop=pm.getProperty(tile.id),copy=preview.getProperty(tile.id),maxLevel=BUILDINGS.find(b=>b.id===prop.buildingType)?.maxLevel??4;
  const upgradeCost=session.engine.getPropertyActionCost(p,tile.id,'UPGRADE'),cost=upgradeCost+CONSTRUCTION_FEE;
  const currentRent=pm.calculateToll(tile.id,state.newsEffect,state.priceIndex);
  copy.level=Math.min(maxLevel,prop.level+1);const nextRent=preview.calculateToll(tile.id,state.newsEffect,state.priceIndex);copy.level=prop.level;
  let blockedReason='';
  if(state.phase!=='PRE_ROLL_ACTION'||state.pendingMove||p.isBankrupt)blockedReason='仅在自己的掷骰前施工';
  else if(state.round<CONSTRUCTION_ROUND)blockedReason=`第 ${CONSTRUCTION_ROUND} 轮开放`;
  else if(session.cardUsed)blockedReason='本回合策略机会已使用';
  else if(prop.isMortgaged)blockedReason='抵押地产不能施工';
  else if(prop.level>=maxLevel)blockedReason='已达到最高等级';
  else if(p.godType==='BAD')blockedReason='衰运状态禁止升级';
  else if(p.cash<cost)blockedReason='现金不足';
  return {tileId:tile.id,name:tile.name,level:prop.level,nextLevel:Math.min(maxLevel,prop.level+1),upgradeCost,fee:CONSTRUCTION_FEE,cost,cashAfter:p.cash-cost,currentRent,nextRent,
   netWorthDelta:(prop.level<maxLevel?tile.buildCost:0)-cost,nearRival:rivalPaths.some(path=>path.includes(tile.id)),blockedReason};
 });
}
