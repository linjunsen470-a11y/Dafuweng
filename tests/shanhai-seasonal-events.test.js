import {describe,it,expect,vi} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {islandEventForRound} from '../src/shanhai/SliceEvents.js';
const maps=['shanhai-coast','shanhai-highland'];
function make(mapId){const s=new SliceSession({mapId,storage:null});s.start({seed:314,playerCount:4});s.state.round=2;return s;}
function land(s,seat=0){s.state.currentPlayerIndex=seat;s.currentPlayer.currentTile=22;s.state.phase='LANDING_ACTION';s.resetPresentation();s.resolveLanding();}

describe('predictable seasonal map events',()=>{
 it.each(maps)('%s alternates publicly without consuming RNG and pins a pending event',mapId=>{
  const s=make(mapId),rng=s.state.rng.state;
  expect(s.event(22).id).toBeTruthy();expect(s.event(4)).toEqual(islandEventForRound(4,mapId,1));
  expect(islandEventForRound(22,mapId,1).id).toBeUndefined();expect(islandEventForRound(22,mapId,3).id).toBeUndefined();
  land(s);expect(s.focus.description).toContain('双数轮');expect(s.state.rng.state).toBe(rng);expect(s.endTurn().success).toBe(false);
  const saved=s.snapshot();const restored=make(mapId);expect(restored.restore(saved).success).toBe(true);
  expect(restored.pendingEvent).toEqual(saved.slice.pendingEvent);expect(restored.getIslandChoices()).toEqual(s.getIslandChoices());expect(restored.state.rng.state).toBe(rng);
  restored.state.round=3;expect(restored.event(22).id).toBe(saved.slice.pendingEvent.eventId);
 });
 it.each([['shanhai-coast','exhibit',70,900,-30,0,-15],['shanhai-highland','sun',60,900,0,-250,0]])('%s charges once and applies success or partial recovery', (mapId,id,chance,winCash,winPoints,lossCash,lossPoints)=>{
  for(const won of [true,false]){
   const s=make(mapId);land(s);const before=s.snapshot();const draw=vi.spyOn(s.state.rng,'int').mockReturnValue(won?chance:chance+1);
   expect(s.chooseIslandEvent(id)).toMatchObject({success:true,won,cashDelta:won?winCash:lossCash,pointsDelta:won?winPoints:lossPoints});
   expect(s.currentPlayer.cash).toBe(before.players[0].cash+(won?winCash:lossCash));expect(s.currentPlayer.cardPoints).toBe(before.players[0].cardPoints+(won?winPoints:lossPoints));expect(draw).toHaveBeenCalledTimes(1);
   expect(s.focus.description).toContain(won?'现金 +¥900':mapId===maps[0]?'退回15点券':'收回 ¥250');
   const after=s.snapshot();expect(s.chooseIslandEvent(id).success).toBe(false);const copy=make(mapId);copy.restore(after);expect(copy.chooseIslandEvent(id).success).toBe(false);expect(copy.snapshot().players).toEqual(after.players);
   expect(copy.endTurn().success).toBe(true);expect(copy.currentPlayer.id).toBe(1);
  }
 });
 it.each([['shanhai-coast','shelter',350,-10],['shanhai-highland','roof',350,0]])('%s guaranteed cover has no random draw',(mapId,id,cashDelta,pointsDelta)=>{
  const s=make(mapId);land(s);const rng=s.state.rng.state;expect(s.chooseIslandEvent(id)).toMatchObject({success:true,won:true,cashDelta,pointsDelta});expect(s.state.rng.state).toBe(rng);
 });
 it.each(maps)('%s rejects unaffordable gross costs and preserves a free choice',mapId=>{
  const s=make(mapId);land(s);s.currentPlayer.cash=0;s.currentPlayer.cardPoints=0;const rng=s.state.rng.state;
  const ids=mapId===maps[0]?['exhibit','shelter']:['sun','roof'];for(const id of ids)expect(s.chooseIslandEvent(id).success).toBe(false);
  expect(s.state.rng.state).toBe(rng);expect(s.currentPlayer.cash).toBe(0);expect(s.currentPlayer.cardPoints).toBe(0);
  expect(s.chooseIslandEvent(mapId===maps[0]?'hang':'rake').success).toBe(true);
 });
 it.each(maps)('%s keeps legacy pending and settled events instead of switching content',mapId=>{
  const s=make(mapId);s.state.round=1;land(s);const old=s.snapshot();delete old.slice.pendingEvent.eventId;old.round=2;
  expect(s.restore(old).success).toBe(true);expect(s.event(22).id).toBeUndefined();expect(s.getIslandChoices().some(c=>c.id==='craft')).toBe(true);
  const result=s.chooseIslandEvent('craft');expect(result.success).toBe(true);const settled=s.snapshot();expect(s.restore(settled).success).toBe(true);expect(s.pendingEvent).toBeNull();expect(s.focus.kind).toBe('EVENT_DONE');expect(s.chooseIslandEvent('craft').success).toBe(false);
 });
 it.each(maps)('%s AI pays the same costs, uses public expected values and rotates all four seats',async mapId=>{
  const s=make(mapId);land(s);s.chooseIslandEvent(mapId===maps[0]?'hang':'rake');s.endTurn();
  for(let seat=1;seat<=3;seat++){
   expect(s.currentPlayer.id).toBe(seat);land(s,seat);const before=s.currentPlayer.cash,points=s.currentPlayer.cardPoints;
   vi.spyOn(s.state.rng,'int').mockReturnValue(100);
   const r=s.chooseAIIslandEvent();expect(r.choiceId).toBe(mapId===maps[0]?'exhibit':'sun');expect(r.won).toBe(false);
   expect(s.currentPlayer.cash-before).toBe(mapId===maps[0]?0:-250);expect(s.currentPlayer.cardPoints-points).toBe(mapId===maps[0]?-15:0);
   expect((await s.playAITurn()).success).toBe(true);
  }
  expect(s.currentPlayer.id).toBe(0);expect(s.state.round).toBe(3);
 });
 it.each(maps)('%s low-resource AI can take free work',mapId=>{const s=make(mapId);land(s,3);s.currentPlayer.cash=0;s.currentPlayer.cardPoints=0;const rng=s.state.rng.state;expect(s.chooseAIIslandEvent()).toMatchObject({success:true,choiceId:mapId===maps[0]?'hang':'rake'});expect(s.state.rng.state).toBe(rng);});
 it('new mountain event settles before the existing story ending, without extra rewards',()=>{
  const s=make('shanhai-highland');s.stories[0].stage=3;land(s);
  expect(s.advanceStory('trail').success).toBe(false);s.chooseIslandEvent('rake');
  const cash=s.currentPlayer.cash,points=s.currentPlayer.cardPoints;
  expect(s.advanceStory('trail')).toMatchObject({success:true,stage:4});expect(s.currentPlayer.cash).toBe(cash);expect(s.currentPlayer.cardPoints).toBe(points);
 });

});
