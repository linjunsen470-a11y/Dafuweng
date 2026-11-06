import {it,expect} from 'vitest';
import {GameState} from './src/game/GameState.js';
import {GameEngine} from './src/game/GameEngine.js';
import {createLandDecisionModel} from './src/ui/DialogUI.js';
import {describePresentationEvent} from './src/ui/PresentationUI.js';
const game=()=>{const state=new GameState({seed:1234});state.setupGame([{profileIndex:0,name:'小满',isAI:false},{profileIndex:1,name:'田野',isAI:true}],20000,{mapId:'grand-bay'});return {state,engine:new GameEngine(state)};};
it('keeps the engine purchase quote and identifies the actual discount, not a free god purchase',()=>{
 const {state,engine}=game(),p=state.players[0],tile=state.getTile(6),quote=engine.getPropertyActionCost(p,6);
 const model=createLandDecisionModel({tileData:tile,player:p,state,quote});expect(model.cost).toBe(1122);expect(model.abilityNote).toContain('商业奇才');
 p.godType='LUCK';const free=createLandDecisionModel({tileData:tile,player:p,state,quote:engine.getPropertyActionCost(p,6)});expect(free.cost).toBe(0);expect(free.abilityNote).not.toContain('商业奇才');
});
for(const skill of ['土地公庇护','皇家威严'])it(`matches real rent settlement for current and next level with ${skill}`,()=>{
 const {state,engine}=game(),owner=state.players[1],visitor=state.players[0];owner.skillName=skill;state.propertyManager.buyProperty(1,1);const tile=state.getTile(1);
 const model=createLandDecisionModel({tileData:tile,currentLevel:0,player:owner,state,action:'UPGRADE',quote:engine.getPropertyActionCost(owner,1,'UPGRADE')});
 const actual=engine.settleRent(visitor,1);expect(model.currentToll).toBe(actual.amount);expect(model.abilityNote).toContain(skill);
 state.propertyManager.upgradeProperty(1);const next=engine.settleRent(visitor,1);expect(model.nextToll).toBe(next.amount);expect(model.rentGrowth[1].value).toBe(next.amount);
 const cues=describePresentationEvent({...actual,playerId:0},state);expect(cues.find(c=>c.kind==='toast').detail).toContain(skill);expect(cues.filter(c=>c.kind==='cash').map(c=>c.amount)).toEqual([-actual.amount,actual.amount]);
});
it('keeps visitor immunity separate from the landlord preview and does not claim an activated rent bonus',()=>{
 const {state,engine}=game();state.propertyManager.buyProperty(1,1);state.players[0].godType='GREAT_FORTUNE';const cash=state.players.map(p=>p.cash),result=engine.settleRent(state.players[0],1);expect(result.type).toBe('RENT_WAIVED');expect(state.players.map(p=>p.cash)).toEqual(cash);const cues=describePresentationEvent({...result,playerId:0},state);expect(cues.find(c=>c.kind==='toast').detail).not.toContain('土地公庇护');
});
