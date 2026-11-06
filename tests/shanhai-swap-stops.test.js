import {it,expect,vi} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {tacticBoardView} from '../src/shanhai/SliceTactics.js';
import {counterRoute} from '../src/shanhai/SliceCounterplay.js';
const make=(mapId='shanhai-coast',playerCount=4)=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount});s.state.boardGods=[];s.state.roadEntities=[];s.state.players.forEach((p,i)=>p.currentTile=[0,6,18,12][i]);return s;};
const stable=s=>{const a=s.snapshot();delete a.savedAt;return a;};
const offer=s=>s.getTactics().find(t=>t.id==='SWAP_STOPS');
it.each(['shanhai-coast','shanhai-highland'])('swaps without landing rewards, preserves direction and resumes ordinary movement on %s',map=>{
 const s=make(map);s.state.players[1].direction=-1;const prop=s.state.propertyManager.getProperty(6);Object.assign(prop,{owner:2,level:4,hasObstacle:true});
 expect(offer(s).cost).toBe(60);expect(s.buyTactic('SWAP_STOPS').success).toBe(true);expect(s.currentPlayer.cardPoints).toBe(60);
 const before=stable(s);expect(s.useTactic('SWAP_STOPS',3).success).toBe(false);expect(stable(s)).toEqual(before);
 const result=s.useTactic('SWAP_STOPS',1);expect(result.success).toBe(true);expect(result.events.map(e=>e.type)).toEqual(['CARD_USED','POSITIONS_SWAPPED']);expect(s.state.players.map(p=>p.currentTile)).toEqual([6,0,18,12]);expect(s.state.players.map(p=>p.direction)).toEqual([1,-1,1,1]);expect(s.state.players.map(p=>p.cash)).toEqual(before.players.map(p=>p.cash));expect(s.currentPlayer.cardPoints).toBe(60);expect(s.currentPlayer.cards).not.toContain('SWAP_STOPS');expect(s.snapshot().properties).toEqual(before.properties);expect(s.snapshot().slice.careers).toEqual(before.slice.careers);expect(s.snapshot().slice.stories).toEqual(before.slice.stories);expect(s.state.phase).toBe('PRE_ROLL_ACTION');expect(s.useRemoteDice(1).success).toBe(false);
 const restored=make(map);expect(restored.restore(s.snapshot()).success).toBe(true);expect(restored.snapshot().players).toEqual(s.snapshot().players);expect(restored.snapshot().properties).toEqual(s.snapshot().properties);expect(restored.snapshot().slice).toEqual(s.snapshot().slice);expect(restored.useTactic('SWAP_STOPS',1).success).toBe(false);
 vi.spyOn(restored.state.rng,'int').mockReturnValue(1);expect(restored.roll().success).toBe(true);restored.resolveMovement();expect(restored.currentPlayer.currentTile).toBe(7);expect(restored.state.propertyManager.getProperty(6).hasObstacle).toBe(true);
});
it('filters range, same station, self and all unavailable statuses without consuming an invalid card',()=>{
 const s=make();s.buyTactic('SWAP_STOPS');expect(offer(s).targets.map(t=>t.id)).toEqual([1,2]);for(const key of ['isBankrupt','hospitalTurns','jailTurns','hotelTurns','hibernateTurns','sleepwalkTurns','isSleepwalkingThisTurn']){s.state.players[1][key]=1;expect(offer(s).targets.map(t=>t.id)).toEqual([2]);const before=stable(s);expect(s.useTactic('SWAP_STOPS',1).success).toBe(false);expect(stable(s)).toEqual(before);s.state.players[1][key]=0;}
 s.state.players[1].currentTile=0;expect(offer(s).targets.map(t=>t.id)).toEqual([2]);s.currentPlayer.hospitalTurns=1;expect(offer(s).targets).toEqual([]);
});
it('uses ordinary point/capacity checks, previews player markers without a reversal path, and restores older 2/3/4-seat saves',()=>{
 const s=make();s.currentPlayer.cardPoints=59;expect(s.buyTactic('SWAP_STOPS').success).toBe(false);s.currentPlayer.cardPoints=120;s.currentPlayer.cards=Array(12).fill('REMOTE_DICE');expect(s.buyTactic('SWAP_STOPS').success).toBe(false);s.currentPlayer.cards=[];s.buyTactic('SWAP_STOPS');const before=stable(s),v=tacticBoardView(s,'SWAP_STOPS',1);expect(v.playerTarget).toBe(true);expect(v.selected.tileId).toBe(6);expect(v.path).toEqual([]);expect(v.selected.detail).toContain('最高参考租金');expect(stable(s)).toEqual(before);
 for(const n of [2,3,4]){const old=make('shanhai-coast',n);expect(old.snapshot().players.every(p=>!p.cards.includes('SWAP_STOPS'))).toBe(true);expect(s.restore(old.snapshot()).success).toBe(true);expect(s.state.players).toHaveLength(n);expect(s.buyTactic('SWAP_STOPS').success).toBe(true);}
});
it('allows the displaced player to counter on their next turn using existing rules',()=>{
 const s=make();s.buyTactic('SWAP_STOPS');s.useTactic('SWAP_STOPS',1);vi.spyOn(s.state.rng,'int').mockReturnValue(1);s.roll();s.resolveMovement();s.resolveLanding();expect(s.endTurn().success).toBe(true);expect(s.currentPlayer.id).toBe(1);expect(s.cardUsed).toBe(false);expect(s.useTactic('TURN_AROUND',1).success).toBe(true);expect(s.currentPlayer.direction).toBe(-1);expect(s.currentPlayer.currentTile).toBe(0);
});
it.each(['shanhai-coast','shanhai-highland'])('AI uses public rent to choose a swap, respects 60+45 points and the once-per-turn limit on %s',map=>{
 const s=make(map);s.state.currentPlayerIndex=1;s.state.players[1].currentTile=0;s.state.players[0].currentTile=6;s.state.players[2].currentTile=12;s.state.players[3].currentTile=12;
 for(const id of [1,23])Object.assign(s.state.propertyManager.getProperty(id),{owner:0,level:4});
 expect(counterRoute(s,1).maxRent-counterRoute(s,1,null,6).maxRent).toBeGreaterThanOrEqual(700);expect(counterRoute(s,-1).maxRent).toBeGreaterThanOrEqual(counterRoute(s,1).maxRent*.5);
 s.currentPlayer.cards=[];s.currentPlayer.cardPoints=104;expect(s.useAITactic()).toBeNull();expect(s.currentPlayer.cardPoints).toBe(104);s.currentPlayer.cardPoints=105;expect(s.useAITactic()).toMatchObject({success:true,cardId:'SWAP_STOPS'});expect(s.currentPlayer.cardPoints).toBe(45);expect(s.currentPlayer.currentTile).toBe(6);expect(s.state.players[0].currentTile).toBe(0);expect(s.useAITactic()).toBeNull();
});
