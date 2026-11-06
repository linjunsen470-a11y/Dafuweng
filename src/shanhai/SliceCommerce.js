import { BUILDINGS } from '../game/ContentRegistry.js';
import { PropertyManager } from '../game/PropertyManager.js';

export const COAST_BUSINESSES = [
  { id:'MALL', name:'潮棚商场', tiers:['露天摊市','拱廊小铺','双层商馆','露台百货','海湾钟楼商场'] },
  { id:'PARK', name:'邻里花园', tiers:['街角花庭','树荫凉亭'] }
];

/** Read-only alternatives using the same toll calculator as actual visits.
 * Sums compare one visit to each plot, not predicted income or a per-turn payout.
 */
export function commerceOptions(state, player, tileId) {
  const tile=state.getTile(tileId),property=state.propertyManager.getProperty(tileId);
  if(tile?.type!=='BIG_PROPERTY'||!player||!property)return [];
  const nearby=state.mapDefinition.tiles.filter(t=>t.id!==tileId&&Math.abs(t.id-tileId)<=2&&['PROPERTY','BIG_PROPERTY'].includes(t.type)
    &&state.propertyManager.getProperty(t.id)?.owner===player.id&&!state.propertyManager.getProperty(t.id).isMortgaged);
  const quote=(type,level)=>{
    const manager=new PropertyManager();manager.init(state.mapDefinition.tiles);
    manager.properties=new Map([...state.propertyManager.properties].map(([id,p])=>[id,{...p}]));
    Object.assign(manager.getProperty(tileId),{owner:player.id,buildingType:type,level});
    const toll=id=>manager.calculateToll(id,state.newsEffect,state.priceIndex);
    return {rent:toll(tileId),neighbors:nearby.map(t=>({tileId:t.id,name:t.name,rent:toll(t.id)}))};
  };
  const baseline=quote('MALL',property.level);
  return COAST_BUSINESSES.map(b=>{
    const def=BUILDINGS.find(d=>d.id===b.id),level=Math.min(property.level,def.maxLevel),current=property.owner!==null&&property.buildingType===b.id;
    const view=quote(b.id,level),next=level<def.maxLevel?quote(b.id,level+1):null;
    const neighbors=view.neighbors.map((n,i)=>({...n,increase:n.rent-baseline.neighbors[i].rent}));
    const conversionCost=property.buildingType&&!current?Math.round(tile.buildCost*.25):0;
    let blockedReason='';
    if(state.phase!=='PRE_ROLL_ACTION')blockedReason='仅在自己的掷骰前改建';
    else if(property.owner!==player.id)blockedReason='只能改建自己的市集';
    else if(property.isMortgaged)blockedReason='抵押地产不能改建';
    else if(current)blockedReason='当前已采用此方案';
    else if(player.cash<conversionCost)blockedReason='现金不足';
    return {...b,...view,neighbors,level,maxLevel:def.maxLevel,current,nextRent:next?.rent??null,
      rentLadder:Array.from({length:def.maxLevel+1},(_,i)=>quote(b.id,i).rent),
      standardUpgradeCost:Math.round(tile.buildCost*def.buildMultiplier),conversionCost,lostLevels:property.level-level,blockedReason,
      visitorPoints:(b.id==='MALL'?15:20)+level*10,
      nearbyIncrease:neighbors.reduce((n,p)=>n+p.increase,0)};
  });
}

export function chooseCoastBusiness(state,player,tileId) {
  const options=commerceOptions(state,player,tileId);
  const mall=options.find(b=>b.id==='MALL'),park=options.find(b=>b.id==='PARK');
  // Conservative public-information heuristic. No hidden dice or free conversion.
  return park&&park.nearbyIncrease>mall.rent*1.25?'PARK':'MALL';
}

/** Public map explanation only; does not change property, AI or save state. */
export function gardenInfluence(state, viewerId=0) {
  const sourceId=12,source=state.propertyManager.getProperty(sourceId);
  const ownerId=source.owner??viewerId,owner=state.players.find(p=>p.id===ownerId);
  const active=source.buildingType==='PARK'&&source.owner!==null&&!source.isMortgaged;
  const suspended=source.isMortgaged,preview=!active&&!suspended;
  const clone=()=>{const pm=new PropertyManager();pm.init(state.mapDefinition.tiles);pm.properties=new Map([...state.propertyManager.properties].map(([id,p])=>[id,{...p}]));return pm;};
  const without=clone(),withPark=clone();without.getProperty(sourceId).buildingType='MALL';
  Object.assign(withPark.getProperty(sourceId),{owner:ownerId,buildingType:'PARK'});
  const toll=(pm,id)=>pm.calculateToll(id,state.newsEffect,state.priceIndex);
  const rows=state.mapDefinition.tiles.filter(t=>t.id!==sourceId&&Math.abs(t.id-sourceId)<=2&&['PROPERTY','BIG_PROPERTY'].includes(t.type)).map(tile=>{
    const p=state.propertyManager.getProperty(tile.id),owned=p.owner!==null,eligible=owned&&p.owner===ownerId&&!p.isMortgaged&&!suspended;
    const current=toll(state.propertyManager,tile.id),base=toll(without,tile.id),projected=toll(withPark,tile.id);
    const increase=eligible?projected-base:0;
    const reason=suspended?'市集抵押，加成暂停':p.isMortgaged?'邻地抵押，不收租':!owned?'无主地，购入前不受益':p.owner!==ownerId?'与市集不同业主，不受益':increase?'同业主，租金 +20%':'已有其他花园加成，不重复叠加';
    return {tileId:tile.id,name:tile.name,ownerId:p.owner,ownerName:state.players.find(player=>player.id===p.owner)?.name||'无主',level:p.level,
      current,base,projected,increase,eligible,reason,risk:owned&&p.owner!==viewerId&&!p.isMortgaged?'对手地产 · 停靠可能付租':p.isMortgaged?'抵押中 · 暂不收租':owned?'你的地产 · 自己停靠不付租':'无主地产 · 尚无租金'};
  });
  return {sourceId,ownerId,ownerName:owner?.name||'你',active,suspended,preview,
    mode:active?'花园加成 · 当前生效':suspended?'加成暂停 · 市集已抵押':source.owner===null?'购入花园预览 · 尚未生效':'改建花园预览 · 尚未生效',
    sourceNote:source.owner===null?`按${owner?.name||'你'}购入花园预览，不会自动买下邻地。`:active?`${owner?.name}的花园只带动同业主邻地。`:suspended?'解除抵押前不提供邻地加成。':`按${owner?.name}改建预览；需付改建费，并放弃本站商场租金。`,rows};
}

/** A single ordinary-property decision and public six-step cash exposure. */
export function propertyDecision(state,player,tileId,kind,cost) {
  const tile=state.getTile(tileId);if(tile?.type!=='PROPERTY'||!['PURCHASE','UPGRADE'].includes(kind))return null;
  const pm=state.propertyManager,preview=new PropertyManager();preview.init(state.mapDefinition.tiles);
  preview.properties=new Map([...pm.properties].map(([id,p])=>[id,{...p}]));
  if(kind==='PURCHASE')preview.buyProperty(tileId,player.id);else preview.getProperty(tileId).level++;
  const toll=(manager,id)=>manager.calculateToll(id,state.newsEffect,state.priceIndex,player);
  const current=toll(pm,tileId),after=toll(preview,tileId);
  const threats=state.mapRuntime.projectPath(tileId,6,player.direction||1).filter(id=>{const p=pm.getProperty(id);return p?.owner!==null&&p?.owner!==player.id&&!p?.isMortgaged;}).map(id=>({tileId:id,name:state.getTile(id).name,rent:toll(pm,id)}));
  const threat=threats.sort((a,b)=>b.rent-a.rent)[0]||null;
  return {cost,cashAfter:player.cash-cost,current,after,increase:after-current,threat};
}

/** Auction ownership preview only: preserve the lot as the engine transfers it.
 * Reference tolls are for a walking visitor, before personal exemptions; no RNG or writes.
 */
export function auctionPropertyPreview(state,player,tileId) {
  const tile=state.getTile(tileId),pm=state.propertyManager,property=pm.getProperty(tileId);
  if(!player||!property||!['PROPERTY','BIG_PROPERTY'].includes(tile?.type))return null;
  const preview=new PropertyManager();preview.init(state.mapDefinition.tiles);
  preview.properties=new Map([...pm.properties].map(([id,p])=>[id,{...p}]));
  preview.getProperty(tileId).owner=player.id;
  const toll=(manager,id)=>manager.calculateToll(id,state.newsEffect,state.priceIndex);
  const affected=[...pm.properties].filter(([id,p])=>id!==tileId&&p.owner===player.id).map(([id])=>({tileId:id,name:state.getTile(id).name,before:toll(pm,id),after:toll(preview,id)})).filter(r=>r.before!==r.after);
  const buildingName=tile.type==='PROPERTY'?'普通住宅':COAST_BUSINESSES.find(b=>b.id===property.buildingType)?.name||BUILDINGS.find(b=>b.id===property.buildingType)?.name||'未设经营类型';
  return {tileId,level:property.level,buildingName,isMortgaged:property.isMortgaged,rent:toll(preview,tileId),affected};
}
