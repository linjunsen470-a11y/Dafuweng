import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const make=(mapId='shanhai-coast')=>{const s=new SliceSession({mapId,storage:null});s.start({seed:314});s.state.round=8;s.state.propertyManager.buyProperty(1,0);return s;};
const stable=s=>{const snap=s.snapshot();delete snap.savedAt;return snap;};
it('quotes without mutation and charges ordinary cost plus fee on both maps, preserving position and RNG',()=>{
 for(const id of ['shanhai-coast','shanhai-highland']){const s=make(id),before=stable(s),quote=s.getConstructionOptions()[0];expect(stable(s)).toEqual(before);expect(quote.netWorthDelta).toBe(-300);
 const net=s.state.calculateNetWorth(s.currentPlayer),cash=s.currentPlayer.cash,points=s.currentPlayer.cardPoints,roll=s.state.rng.state,stats=s.state.matchStatistics.players[0];
 expect(s.contractUpgrade(1)).toMatchObject({success:true,type:'CONSTRUCTION_COMPLETED',cost:quote.cost,fee:300});expect(s.currentPlayer.cash).toBe(cash-quote.cost);expect(s.state.calculateNetWorth(s.currentPlayer)-net).toBe(quote.netWorthDelta);expect(s.currentPlayer.cardPoints).toBe(points);expect(s.currentPlayer.currentTile).toBe(0);expect(s.state.rng.state).toBe(roll);expect(s.state.phase).toBe('PRE_ROLL_ACTION');expect(s.state.propertyManager.calculateToll(1,s.state.newsEffect,s.state.priceIndex)).toBe(quote.nextRent);expect(stats.propertiesUpgraded).toBe(1);expect(stats.cashOut).toBe(quote.cost);
 }
});
it('rejects early, cash, mortgage, cap, bad luck, bankruptcy, movement and wrong-phase attempts atomically',()=>{
 for(const change of [s=>s.state.round=7,s=>s.currentPlayer.cash=899,s=>s.state.propertyManager.getProperty(1).isMortgaged=true,s=>s.state.propertyManager.getProperty(1).level=4,s=>s.currentPlayer.godType='BAD',s=>s.currentPlayer.isBankrupt=true,s=>s.state.pendingMove={steps:1},s=>s.state.phase='LANDING_ACTION',s=>s.state.phase='GAME_OVER']){const s=make();change(s);const before=stable(s);expect(s.contractUpgrade(1).success).toBe(false);expect(stable(s)).toEqual(before);}
 const s=make();const before=stable(s);expect(s.contractUpgrade(2).success).toBe(false);expect(stable(s)).toEqual(before);
});
it('shares the strategy slot in both directions and restores it from the existing save field',()=>{
 for(const mapId of ['shanhai-coast','shanhai-highland']){const s=make(mapId);s.contractUpgrade(1);const before=stable(s);expect(s.contractUpgrade(1).success).toBe(false);expect(s.useTactic('OBSTACLE',3).success).toBe(false);expect(s.useRemoteDice(1).success).toBe(false);expect(s.getTransportOptions().every(o=>o.blockedReason)).toBe(true);expect(stable(s)).toEqual(before);
 const restored=make(mapId);expect(restored.restore(s.snapshot()).success).toBe(true);expect(restored.cardUsed).toBe(true);expect(restored.contractUpgrade(1).success).toBe(false);expect(restored.roll().success).toBe(true);restored.resolveMovement();restored.resolveLanding();if(restored.pendingEvent)restored.chooseAIIslandEvent();expect(restored.endTurn().success).toBe(true);expect(restored.cardUsed).toBe(false);}
 const s=make();expect(s.useTactic('OBSTACLE',3).success).toBe(true);expect(s.contractUpgrade(1).success).toBe(false);
});
it('respects commercial max level and engine cost modifiers, including the always-paid callout fee',()=>{
 const s=make();s.state.propertyManager.buyProperty(12,0,'MALL');let quote=s.getConstructionOptions().find(o=>o.tileId===12);expect(quote.cost).toBe(1680);s.contractUpgrade(12);expect(s.state.propertyManager.getProperty(12).level).toBe(1);
 const park=make();park.state.propertyManager.buyProperty(12,0,'PARK');park.state.propertyManager.getProperty(12).level=1;expect(park.getConstructionOptions().find(o=>o.tileId===12).blockedReason).toContain('最高');
 const lucky=make();lucky.currentPlayer.godType='LUCK';expect(lucky.getConstructionOptions()[0].cost).toBe(300);expect(lucky.contractUpgrade(1).cost).toBe(300);expect(lucky.currentPlayer.cash).toBe(15700);
});
it('does not grant renewal commission; ordinary landing upgrade still charges no callout fee and completes it',()=>{
 const s=make();s.acceptCommission('RENEWAL');s.contractUpgrade(1);expect(s.careers[0].completed).toBe(0);expect(s.careers[0].active.kind).toBe('RENEWAL');s.currentPlayer.currentTile=1;s.state.phase='LANDING_ACTION';s.resolveLanding();const cost=s.focus.cost;const result=s.upgrade();expect(result.cost).toBe(cost);expect(result.commission).toBeTruthy();expect(s.careers[0].completed).toBe(1);
});
it('old chapter snapshots without new fields keep property, careers, stories and cash and can use the new action',()=>{
 for(const id of ['shanhai-coast','shanhai-highland']){const s=make(id);s.advanceStory('accept');const old=s.snapshot(),r=new SliceSession({mapId:id,storage:null});expect(r.restore(old).success).toBe(true);expect(r.stories).toEqual(s.stories);expect(r.careers).toEqual(s.careers);expect(r.currentPlayer.cash).toBe(16000);expect(r.getConstructionOptions()[0].blockedReason).toBe('');expect(r.snapshot().slice).toEqual(old.slice);}
});
it('AI uses the same quoted price and slot when a rival can reach the property; no final-round speculation',async()=>{
 for(const mapId of ['shanhai-coast','shanhai-highland']){const s=make(mapId);s.state.currentPlayerIndex=1;s.state.propertyManager.getProperty(1).owner=1;s.currentPlayer.currentTile=12;const quote=s.chooseAIConstruction();expect(quote.tileId).toBe(1);let built=0;await s.playAITurn({onAbility:async result=>{if(result.type!=='CONSTRUCTION_COMPLETED')return;built++;expect(result.cost).toBe(quote.cost);expect(s.currentPlayer.cash).toBe(16000-quote.cost);expect(s.cardUsed).toBe(true);}});expect(built).toBe(1);}
 const s=make();s.currentPlayer.cash=2000;expect(s.chooseAIConstruction()).toBe(null);s.currentPlayer.cash=16000;s.state.round=16;expect(s.chooseAIConstruction()).toBe(null);
});
it('rival route preview respects a stopping fence and never promises a landing or guaranteed income',()=>{
 const s=make();s.state.propertyManager.buyProperty(5,0);expect(s.getConstructionOptions().find(o=>o.tileId===5).nearRival).toBe(true);s.state.propertyManager.getProperty(2).hasObstacle=true;expect(s.getConstructionOptions().find(o=>o.tileId===5).nearRival).toBe(false);
});
