import {PropertyManager} from '../game/PropertyManager.js';
import {validateCommand} from '../game/CommandPolicy.js';

/** Read-only cash/rent comparison for existing engine mortgage rules. */
export function propertyFinance(session,tileId){
 const {state}=session,player=session.currentPlayer,pm=state.propertyManager;
 const tile=state.getTile(tileId),prop=pm.getProperty(tileId);
 if(!player||!prop||prop.owner!==player.id||!['PROPERTY','BIG_PROPERTY'].includes(tile?.type))return null;
 const action=prop.isMortgaged?'REDEEM_PROPERTY':'MORTGAGE_PROPERTY';
 const principal=prop.isMortgaged?prop.mortgageValue:Math.round((tile.price||0)*.5);
 const redeemCost=Math.round(principal*1.1),cashDelta=prop.isMortgaged?-redeemCost:principal;
 let blockedReason=validateCommand(state,player,{type:action,payload:{tileId}})?.reason||'';
 if(state.phase!=='PRE_ROLL_ACTION'||state.pendingMove)blockedReason='仅在自己的掷骰前周转';
 else if(!prop.isMortgaged&&prop.level>0)blockedReason='有建筑不能直接抵押；本窗口不自动拆楼';
 else if(!prop.isMortgaged&&session.engine.isPropertyListed(tileId))blockedReason='地产挂牌中，请先撤销挂牌';
 else if(!prop.isMortgaged&&state.researchTasks.some(t=>t.tileId===tileId))blockedReason='研究所仍有研发任务';
 else if(prop.isMortgaged&&player.cash<redeemCost)blockedReason='现金不足以赎回';
 const preview=new PropertyManager();preview.init(state.mapDefinition.tiles);
 preview.properties=new Map([...pm.properties].map(([id,p])=>[id,{...p}]));
 Object.assign(preview.getProperty(tileId),{isMortgaged:!prop.isMortgaged,mortgageValue:prop.isMortgaged?0:principal});
 const toll=(manager,id)=>manager.calculateToll(id,state.newsEffect,state.priceIndex);
 const affected=[...pm.properties].filter(([id,p])=>id!==tileId&&p.owner===player.id)
  .map(([id])=>({tileId:id,name:state.getTile(id).name,before:toll(pm,id),after:toll(preview,id)})).filter(r=>r.before!==r.after);
 const threat=session.getTravelOptions().filter(o=>o.kind==='RENT')
  .map(o=>({tileId:o.tileId,name:o.name,rent:pm.calculateToll(o.tileId,state.newsEffect,state.priceIndex,player)}))
  .filter(o=>o.rent>0).sort((a,b)=>b.rent-a.rent||a.tileId-b.tileId)[0]||null;
 return {tileId,action,isMortgaged:prop.isMortgaged,principal,redeemCost,fee:redeemCost-principal,cashDelta,cash:player.cash,cashAfter:player.cash+cashDelta,
  netWorthDelta:prop.isMortgaged?Math.min(tile.price||0,principal)-redeemCost:0,
  currentRent:toll(pm,tileId),afterRent:toll(preview,tileId),affected,threat,blockedReason};
}
