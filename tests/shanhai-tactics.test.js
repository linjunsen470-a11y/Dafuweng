import {it,expect,vi} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const make=(mapId='shanhai-highland')=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314});s.state.boardGods=[];s.state.roadEntities=[];return s;};
it.each(['shanhai-highland','shanhai-coast'])('places a visible-state obstacle, previews its stop, consumes it on movement and preserves the one-card limit on %s',map=>{
 const s=make(map),before=s.snapshot();expect(s.useTactic('OBSTACLE',99).success).toBe(false);const after=s.snapshot();delete before.savedAt;delete after.savedAt;expect(after).toEqual(before);expect(s.useTactic('OBSTACLE',2).success).toBe(true);expect(s.getTravelOptions()[5]).toMatchObject({tileId:2,obstacleStop:true});expect(s.useRemoteDice(6).success).toBe(false);expect(s.useTactic('TURN_AROUND',1).success).toBe(false);expect(s.getTransportOptions().every(o=>o.blockedReason)).toBe(true);
 const restored=make(map);expect(restored.restore(s.snapshot()).success).toBe(true);expect(restored.cardUsed).toBe(true);expect(restored.useTactic('TURN_AROUND',1).success).toBe(false);
 vi.spyOn(s.state.rng,'int').mockReturnValue(6);expect(s.roll().success).toBe(true);s.resolveMovement();expect(s.currentPlayer.currentTile).toBe(2);expect(s.state.propertyManager.getProperty(2).hasObstacle).toBe(false);s.resolveLanding();s.endTurn();expect(s.cardUsed).toBe(false);
});
it('buys only with enough points/capacity and clears only valid obstacles',()=>{
 const s=make();s.currentPlayer.cardPoints=29;expect(s.buyTactic('CLEAR_ROAD').success).toBe(false);s.currentPlayer.cardPoints=30;expect(s.buyTactic('CLEAR_ROAD').success).toBe(true);expect(s.currentPlayer.cardPoints).toBe(0);expect(s.useTactic('CLEAR_ROAD',2).success).toBe(false);s.state.propertyManager.getProperty(2).hasObstacle=true;expect(s.useTactic('CLEAR_ROAD',2).success).toBe(true);expect(s.currentPlayer.cards).not.toContain('CLEAR_ROAD');expect(s.state.propertyManager.getProperty(2).hasObstacle).toBe(false);expect(s.buyTactic('OBSTACLE').success).toBe(false);
 const full=make();full.currentPlayer.cards=Array(12).fill('REMOTE_DICE');expect(full.buyTactic('OBSTACLE').success).toBe(false);
});
it('reverses a selected opponent without moving them and rejects out-of-turn timing',()=>{
 const s=make(),p=s.state.players[1],tile=p.currentTile;expect(s.useTactic('TURN_AROUND',1).success).toBe(true);expect(p.direction).toBe(-1);expect(p.currentTile).toBe(tile);const copy=make();copy.restore(s.snapshot());expect(copy.state.players[1].direction).toBe(-1);expect(copy.getTactics().every(t=>t.useBlocked)).toBe(true);copy.cardUsed=false;copy.state.phase='LANDING_ACTION';expect(copy.useTactic('TURN_AROUND',0).success).toBe(false);
});
it('AI clears with the same purchase reserve and never uses a second card',()=>{
 const s=make();s.state.currentPlayerIndex=1;s.currentPlayer.currentTile=5;Object.assign(s.state.propertyManager.getProperty(6),{hasObstacle:true,owner:0,level:2});s.currentPlayer.cards=[];s.currentPlayer.cardPoints=74;expect(s.useAITactic()).toBeNull();expect(s.state.propertyManager.getProperty(6).hasObstacle).toBe(true);s.currentPlayer.cardPoints=75;expect(s.useAITactic().success).toBe(true);expect(s.currentPlayer.cardPoints).toBe(45);expect(s.useAITactic()).toBeNull();
});
it('AI can set a rent trap outside its own immediate route and turn away from a costly route',()=>{
 const s=make();s.state.currentPlayerIndex=1;s.currentPlayer.currentTile=10;const prop=s.state.propertyManager.getProperty(2);prop.owner=1;prop.level=1;expect(s.useAITactic().success).toBe(true);expect(prop.hasObstacle).toBe(true);
 const turn=make();turn.state.currentPlayerIndex=1;turn.currentPlayer.currentTile=0;const danger=turn.state.propertyManager.getProperty(2);danger.owner=0;danger.level=4;expect(turn.useAITactic().success).toBe(true);expect(turn.currentPlayer.direction).toBe(-1);
});
