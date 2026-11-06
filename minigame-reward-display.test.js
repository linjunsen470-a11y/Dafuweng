import {it,expect} from 'vitest';
import {GameState} from './src/game/GameState.js';
import {GameEngine} from './src/game/GameEngine.js';
import {describePresentationEvent,describeImpactEvent} from './src/ui/PresentationUI.js';
it('shows the actual point reward without inventing a cash credit',()=>{
 const state=new GameState({seed:64});state.setupGame([{profileIndex:0,name:'玩家',isAI:false},{profileIndex:1,name:'AI',isAI:true}],60000,{mapId:'grand-bay'});
 const engine=new GameEngine(state),player=state.players[0];player.currentTile=109;state.phase='LANDING_ACTION';
 expect(engine.execute({type:'RESOLVE_LANDING',playerId:0,payload:{tileId:109}}).type).toBe('MINIGAME_OFFER');
 const before={cash:player.cash,points:player.cardPoints};
 const result=engine.execute({type:'SUBMIT_MINIGAME_RESULT',playerId:0,payload:{tileId:109,gameId:'SKY_COINS',score:10}});
 expect(result).toMatchObject({success:true,type:'MINIGAME_COMPLETED',reward:20});expect(player.cash).toBe(before.cash);expect(player.cardPoints).toBe(before.points+20);
 const cues=describePresentationEvent(result,state);expect(cues.some(c=>c.kind==='cash')).toBe(false);expect(cues.find(c=>c.kind==='toast').detail).toContain('20 点券');expect(describeImpactEvent(result,state).detail).toContain('20 点券');
});
