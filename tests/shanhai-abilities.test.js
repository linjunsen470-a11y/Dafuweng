import {describe,it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const start=characterId=>{const s=new SliceSession({storage:null});s.start({characterId,seed:42});return s;};
const arrive=(s,n)=>{s.useRemoteDice(n);s.resolveMovement();s.resolveLanding();};
const next=async s=>{s.endTurn();await s.playAITurn();};
describe('role active abilities',()=>{
 it('courier relays once, preserves dice/position/RNG and persists cooldown',async()=>{
  const s=start('ayu');expect(s.useAbility().success).toBe(false);s.acceptCommission('DELIVERY');expect(s.useAbility().success).toBe(false);
  arrive(s,1);await next(s);const p=s.currentPlayer,before={cash:p.cash,points:p.cardPoints,rng:s.state.rng.state,tile:p.currentTile};
  expect(s.getAbilityPreview()).toMatchObject({id:'RELAY',blockedReason:'',reward:{cash:900,points:15}});
  expect(s.state.rng.state).toBe(before.rng);expect(s.useAbility().commission.cash).toBe(900);
  expect(p.cash).toBe(before.cash+900);expect(p.cardPoints).toBe(before.points-5);expect(p.currentTile).toBe(before.tile);expect(s.state.rng.state).toBe(before.rng);
  const reload=start('ayu');reload.restore(s.snapshot());expect(reload.useAbility().success).toBe(false);expect(reload.abilities[0].readyRound).toBe(5);expect(reload.roll().success).toBe(true);
 });
 it('flower fair counts only own local non-mortgaged plots, caps income and blocks insufficient points',()=>{
  const s=start('qinghe'),p=s.currentPlayer;expect(s.useAbility().success).toBe(false);
  const local=s.state.propertyManager.getProperty(1);Object.assign(local,{owner:p.id,level:0});Object.assign(s.state.propertyManager.getProperty(9),{owner:p.id,level:4});
  expect(s.getAbilityPreview().reward.cash).toBe(300);local.isMortgaged=true;expect(s.useAbility().success).toBe(false);local.isMortgaged=false;local.level=4;
  p.cardPoints=29;const cash=p.cash;expect(s.useAbility().success).toBe(false);expect(p.cash).toBe(cash);p.cardPoints=30;
  expect(s.useAbility().cash).toBe(600);expect(p.cardPoints).toBe(0);expect(p.cash).toBe(cash+600);expect(s.useAbility().success).toBe(false);
  s.state.round=4;p.cardPoints=30;expect(s.useAbility().success).toBe(true);
 });
 it('older saves default abilities without changing balances and reject use outside pre-roll',()=>{
  const s=start('qinghe');const old=s.snapshot();delete old.slice.abilities;expect(s.restore(old).success).toBe(true);expect(s.abilities[0].readyRound).toBe(1);expect(s.currentPlayer.cash).toBe(old.players[0].cash);
  arrive(s,1);s.purchase();expect(s.useAbility().success).toBe(false);
 });
 it('both AI roles pay the same costs and respect cooldown',async()=>{
  for(const human of ['ayu','qinghe']){
   const s=start(human);arrive(s,1);s.endTurn();const ai=s.currentPlayer;ai.cardPoints=75;
   if(ai.characterId==='ayu'){s.acceptCommission('DELIVERY');ai.currentTile=s.careers[ai.id].active.targetId-2;}
   else Object.assign(s.state.propertyManager.getProperty(1),{owner:ai.id,level:0});
   const cash=ai.cash,points=ai.cardPoints;let result;
   await s.playAITurn({onAbility:r=>{result=r;expect(ai.cash).toBe(cash+(ai.characterId==='ayu'?900:300));expect(ai.cardPoints).toBe(points-(ai.characterId==='ayu'?5:30));expect(s.useAbility().success).toBe(false);}});
   expect(result?.success).toBe(true);expect(s.abilities[ai.id].readyRound).toBe(4);
  }
 });
});
