import {it,expect} from 'vitest';
import {GameState} from './src/game/GameState.js';
import {GameEngine} from './src/game/GameEngine.js';
import {describePresentationEvent} from './src/ui/PresentationUI.js';
import {getArrivalBrief} from './src/game/TurnPresentationRules.js';
function visit({cash=20000,chairman=false,ai=false}={}){
 const state=new GameState({seed:64});state.setupGame([{profileIndex:0,name:'玩家',isAI:false},{profileIndex:1,name:'AI',isAI:true}],20000,{mapId:'grand-bay'});
 state.currentPlayerIndex=ai?1:0;const player=state.getCurrentPlayer(),company=state.companyManager.get('CLOUD_COMPUTE');player.cash=cash;player.currentTile=89;state.phase='LANDING_ACTION';company.chairmanId=chairman?player.id:null;
 const before={cash:player.cash,treasury:company.treasury,revenue:company.periodRevenue};
 const event=new GameEngine(state).execute({type:'RESOLVE_LANDING',playerId:player.id,payload:{tileId:89}});
 const settled=JSON.stringify({players:state.players,companies:state.companyManager.companies});
 const cues=describePresentationEvent(event,state),arrival=getArrivalBrief(state,player,89);
 expect(JSON.stringify({players:state.players,companies:state.companyManager.companies})).toBe(settled);
 expect(player.cash).toBe(before.cash-event.fee);expect(company.treasury).toBe(before.treasury+event.fee);expect(company.periodRevenue).toBe(before.revenue+event.fee);
 return {event,cues,arrival,player};
}
it('names the actual company fee and explains that dividends happen at the cycle, not on arrival',()=>{
 const {event,cues,arrival}=visit();expect(event.fee).toBe(390);expect(cues.find(c=>c.kind==='toast').fullDetail).toBe(true);expect(cues.find(c=>c.kind==='cash').amount).toBe(-390);expect(cues.find(c=>c.kind==='toast').detail).toContain('云端计算');expect(cues.find(c=>c.kind==='toast').detail).toContain('$390');expect(arrival.detail).toContain('分红在周期结算');
});
it('reports cash-limited payment rather than the nominal service fee',()=>{
 const {event,cues}=visit({cash:50});expect(event.fee).toBe(50);expect(cues.find(c=>c.kind==='toast').detail).toContain('$50');expect(cues.find(c=>c.kind==='cash').amount).toBe(-50);
});
it('distinguishes a chairman inspection from a paid visit without inventing a dividend',()=>{
 const {event,cues}=visit({chairman:true});expect(event.fee).toBe(0);expect(cues.some(c=>c.kind==='cash')).toBe(false);expect(cues.find(c=>c.kind==='toast').title).toBe('董事长视察');expect(cues.find(c=>c.kind==='toast').detail).toContain('免服务费');
});
it('uses the same result for AI visits',()=>{
 const {cues,player}=visit({ai:true});expect(cues.find(c=>c.kind==='cash').playerId).toBe(player.id);expect(cues.find(c=>c.kind==='toast').detail).toContain('AI');
});
