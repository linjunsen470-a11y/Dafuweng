import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {fenceCounterplay,counterRoute} from '../src/shanhai/SliceCounterplay.js';
const make=(map='shanhai-coast',ai=false)=>{const s=new SliceSession({storage:null,mapId:map});s.start({seed:314});s.state.boardGods=[];s.state.roadEntities=[];s.state.currentPlayerIndex=ai?1:0;s.currentPlayer.cards=[];return s;};
const stable=s=>{const x=s.snapshot();delete x.savedAt;return x;};
it.each(['shanhai-coast','shanhai-highland'])('compares legal fence outcomes on %s without changing board, cash or RNG',map=>{
 const s=make(map),pm=s.state.propertyManager;Object.assign(pm.getProperty(2),{hasObstacle:true,owner:1,level:3});pm.getProperty(5).hasObstacle=true;const before=stable(s),c=fenceCounterplay(s);expect(c.tileId).toBe(2);expect(c.distance).toBe(2);expect(c.keep.stops.map(x=>x.tileId)).toEqual([1,2,2,2,2,2]);expect(c.clear.stops.map(x=>x.tileId)).toEqual([1,2,3,4,5,5]);expect(c.reverse.stops[0].tileId).toBe(23);expect(c.clearSaving).toBeGreaterThan(150);expect(stable(s)).toEqual(before);
});
it('does not encourage AI to dismantle a free stopping point that protects against rent',()=>{
 const s=make('shanhai-coast',true),pm=s.state.propertyManager;pm.getProperty(1).hasObstacle=true;Object.assign(pm.getProperty(2),{owner:0,level:4});s.currentPlayer.cards=['CLEAR_ROAD','TURN_AROUND'];const c=fenceCounterplay(s);expect(c.keep.meanRent).toBe(0);expect(c.clear.meanRent).toBeGreaterThan(0);expect(s.useAITactic()).toBeNull();expect(pm.getProperty(1).hasObstacle).toBe(true);expect(s.currentPlayer.cards).toEqual(['CLEAR_ROAD','TURN_AROUND']);expect(s.state.logHistory.at(-1).msg).toContain('暂不花卡清路');
});
it('clears a costly rent trap through the same card command and locks out a second strategy',()=>{
 const s=make('shanhai-highland',true);Object.assign(s.state.propertyManager.getProperty(1),{hasObstacle:true,owner:0,level:4});s.currentPlayer.cards=['CLEAR_ROAD'];const r=s.useAITactic();expect(r.success).toBe(true);expect(r.description).toContain('参考平均租金');expect(s.state.propertyManager.getProperty(1).hasObstacle).toBe(false);expect(s.currentPlayer.cards).toEqual([]);expect(s.cardUsed).toBe(true);expect(s.useRemoteDice(1).success).toBe(false);expect(s.useAITactic()).toBeNull();
});
it('uses reversed routes and mortgage-adjusted tolls, and hides comparisons outside pre-roll',()=>{
 const s=make();s.currentPlayer.direction=-1;Object.assign(s.state.propertyManager.getProperty(23),{hasObstacle:true,owner:1,level:4,isMortgaged:true});const c=fenceCounterplay(s);expect(c.tileId).toBe(23);expect(c.keep.meanRent).toBe(0);expect(c.reverse.stops[0].tileId).toBe(1);s.state.phase='LANDING_ACTION';expect(fenceCounterplay(s)).toBe(null);
});
it('restores existing fence/card fields without adding a counterplay ledger',()=>{
 const s=make();s.state.propertyManager.getProperty(3).hasObstacle=true;const snap=s.snapshot(),restored=make();expect(restored.restore(snap).success).toBe(true);expect(fenceCounterplay(restored)).toEqual(fenceCounterplay(s));expect(restored.snapshot().slice).toEqual(snap.slice);expect(counterRoute(restored,1).stops.map(t=>t.tileId)).toEqual(restored.getTravelOptions().map(t=>t.tileId));
});
