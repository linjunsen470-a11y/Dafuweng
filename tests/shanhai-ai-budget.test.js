import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const make=(mapId='shanhai-coast',kind='UPGRADE')=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount:4});s.state.round=6;s.state.currentPlayerIndex=3;const p=s.currentPlayer;p.currentTile=1;p.godType=null;p.cash=kind==='PURCHASE'?3500:2800;Object.assign(s.state.propertyManager.getProperty(1),{owner:kind==='PURCHASE'?null:3,level:0});Object.assign(s.state.propertyManager.getProperty(2),{owner:0,level:4});s.state.phase='LANDING_ACTION';s.resolveLanding();return s;};
const stable=s=>{const r=s.snapshot();delete r.savedAt;return r;};
it.each(['shanhai-coast','shanhai-highland'].flatMap(map=>['PURCHASE','UPGRADE'].map(kind=>[map,kind])))('keeps cash for a visible rent when %s AI considers %s; old save resumes identically',async(map,kind)=>{
 const s=make(map,kind),before=stable(s),q=s.getAIPropertyBudget();expect(q.threat.tileId).toBe(2);expect(q.reserve).toBe(q.threat.rent+1000);expect(before.players[3].cash-before.slice.focus.cost).toBeLessThan(q.threat.rent);expect(stable(s)).toEqual(before);
 const restored=new SliceSession({storage:null,mapId:map});expect(restored.restore(before).success).toBe(true);await s.playAITurn();await restored.playAITurn();expect(s.state.players[3].cash).toBe(before.players[3].cash);expect(s.state.propertyManager.getProperty(1)).toEqual(before.properties.find(([id])=>id===1)[1]);expect(s.state.players).toEqual(restored.state.players);expect(s.state.logHistory.some(l=>l.msg.includes('暂缓')&&l.msg.includes('不预知下次骰子'))).toBe(true);
});
it('invests when it can retain the quoted reserve, with exactly the ordinary upgrade cost',async()=>{
 const s=make();s.currentPlayer.cash=s.focus.cost+s.getAIPropertyBudget().reserve;const cash=s.currentPlayer.cash,cost=s.focus.cost;await s.playAITurn();expect(s.state.propertyManager.getProperty(1).level).toBe(1);expect(s.state.players[3].cash).toBe(cash-cost);
});
it('uses only reachable stops: direction, fence and mortgage matter, with no state/RNG mutation',()=>{
 const s=make();const before=stable(s);s.getAIPropertyBudget(9);expect(stable(s)).toEqual(before);s.currentPlayer.direction=-1;expect(s.getAIPropertyBudget().reserve).toBe(1800);s.currentPlayer.direction=1;s.state.propertyManager.getProperty(2).isMortgaged=true;expect(s.getAIPropertyBudget().reserve).toBe(1800);Object.assign(s.state.propertyManager.getProperty(5),{owner:0,level:4});s.state.propertyManager.getProperty(2).hasObstacle=true;expect(s.getAIPropertyBudget().reserve).toBe(1800);s.state.propertyManager.getProperty(2).hasObstacle=false;expect(s.getAIPropertyBudget().threat.tileId).toBe(5);
});
it('does not save for a nonexistent next turn in the final round',async()=>{
 const s=make();s.state.round=s.state.maxRounds;expect(s.getAIPropertyBudget()).toEqual({reserve:1800,threat:null});await s.playAITurn();expect(s.state.propertyManager.getProperty(1).level).toBe(1);expect(s.state.phase).toBe('GAME_OVER');
});
it('leaves the human free to take the same investment risk at the same price',()=>{
 const s=make();s.currentPlayer.isAI=false;const cash=s.currentPlayer.cash,cost=s.focus.cost;expect(s.upgrade().success).toBe(true);expect(s.currentPlayer.cash).toBe(cash-cost);expect(s.state.propertyManager.getProperty(1).level).toBe(1);
});

it('does not claim a reserve rejection for a park upgrade the AI did not intend to make',async()=>{
 const s=make();s.currentPlayer.currentTile=12;Object.assign(s.state.propertyManager.getProperty(12),{owner:3,level:0,buildingType:'PARK'});Object.assign(s.state.propertyManager.getProperty(13),{owner:0,level:4});s.currentPlayer.cash=3000;s.landingResolved=false;s.resolveLanding();await s.playAITurn();expect(s.state.propertyManager.getProperty(12).level).toBe(0);expect(s.state.logHistory.some(l=>l.msg.includes('暂缓'))).toBe(false);
});
