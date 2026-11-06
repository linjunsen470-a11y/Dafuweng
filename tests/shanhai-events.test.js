import { describe, it, expect, vi } from 'vitest';
import { SliceSession } from '../src/shanhai/SliceSession.js';
import { coastRegion } from '../src/shanhai/SliceMap.js';

const make=()=>{const s=new SliceSession({storage:null});s.start({seed:314});return s;};
function land(s,tileId,{ai=false,cash=16000,points=120}={}){
  const snap=s.snapshot();snap.currentPlayerIndex=ai?1:0;
  Object.assign(snap.players[snap.currentPlayerIndex],{currentTile:tileId,cash,cardPoints:points});
  snap.phase='LANDING_ACTION';snap.pendingMove=null;
  Object.assign(snap.slice,{focus:null,landingResolved:false,decisionMade:false,pendingEvent:null});
  expect(s.restore(snap).success).toBe(true);return s.resolveLanding();
}

describe('regional island choices',()=>{
  it('opens and previews without drawing RNG, blocks ending, and resumes the exact pending choice',()=>{
    const s=make();land(s,4);const before=s.snapshot();
    expect(s.focus.kind).toBe('ISLAND_EVENT');expect(s.getIslandChoices()).toHaveLength(3);
    expect(s.getTravelOptions()).toHaveLength(6);
    expect(s.state.rng.state).toBe(before.rngState);expect(s.endTurn().success).toBe(false);
    const copy=make();copy.restore(before);
    const a=s.chooseIslandEvent('sail'),b=copy.chooseIslandEvent('sail');
    expect(a).toEqual(b);expect(s.currentPlayer.cash).toBe(copy.currentPlayer.cash);
    const cash=s.currentPlayer.cash;expect(s.chooseIslandEvent('sail').success).toBe(false);
    copy.restore(s.snapshot());expect(copy.chooseIslandEvent('sail').success).toBe(false);expect(copy.currentPlayer.cash).toBe(cash);
  });

  it.each([[4,'sail',400,1200,60],[10,'stall',700,1800,50],[16,'nursery',400,1000,75],[22,'craft',600,1700,50]])('charges exactly once on both outcomes at tile %i',(tile,id,cost,payout,chance)=>{
    for(const [draw,won]of [[chance,true],[chance+1,false]]){
      const s=make();land(s,tile);const rng=vi.spyOn(s.state.rng,'int').mockReturnValue(draw);
      const r=s.chooseIslandEvent(id);expect(r).toMatchObject({success:true,won,cashDelta:(won?payout:0)-cost});
      expect(s.currentPlayer.cash).toBe(16000-cost+(won?payout:0));expect(rng).toHaveBeenCalledTimes(1);
    }
  });

  it('rejects unavailable funds before charging or drawing, and keeps a free option available',()=>{
    const s=make();land(s,4,{cash:0,points:0});const before=s.state.rng.state;
    expect(s.chooseIslandEvent('sail').success).toBe(false);expect(s.chooseIslandEvent('supply').success).toBe(false);
    expect(s.currentPlayer.cash).toBe(0);expect(s.state.rng.state).toBe(before);
    expect(s.chooseIslandEvent('work')).toMatchObject({success:true,cashDelta:300});
    expect(s.state.rng.state).toBe(before);
    land(s,10,{points:29});expect(s.chooseIslandEvent('exchange').success).toBe(false);
    expect(s.chooseIslandEvent('help')).toMatchObject({pointsDelta:20});
  });

  it('extends an active commission once, never past the last round, and delivers only after choosing',()=>{
    const s=make();s.acceptCommission('RENEWAL');land(s,16);
    expect(s.chooseIslandEvent('extend')).toMatchObject({pointsDelta:-20});expect(s.careers[0].active.dueRound).toBe(4);
    const snap=s.snapshot();snap.slice.careers[0].active.dueRound=16;s.restore(snap);land(s,16);
    expect(s.getIslandChoices().find(c=>c.id==='extend').blockedReason).toContain('本季');
    expect(s.chooseIslandEvent('extend').success).toBe(false);
    const delivery=make();delivery.acceptCommission('DELIVERY');const saved=delivery.snapshot();saved.slice.careers[0].active.targetId=4;delivery.restore(saved);
    land(delivery,4);expect(delivery.careers[0].completed).toBe(0);
    expect(delivery.chooseIslandEvent('work').commission).toMatchObject({cash:900,points:15});
    expect(delivery.currentPlayer.cash).toBe(16000+300+900);
  });

  it('keeps already settled older saves settled and distinguishes all three regional economies',()=>{
    const s=make();land(s,4);const old=s.snapshot();delete old.slice.pendingEvent;
    old.slice.focus={kind:'SPECIAL',tileId:4,title:'旧事件',description:'已经结算',result:{success:true}};
    s.restore(old);const cash=s.currentPlayer.cash;expect(s.pendingEvent).toBeNull();expect(s.chooseIslandEvent('work').success).toBe(false);
    expect(s.currentPlayer.cash).toBe(cash);expect(s.endTurn().success).toBe(true);
    expect([0,8,16].map(id=>coastRegion(id).id)).toEqual(['HARBOR','MARKET','GARDEN']);
  });

  it('lets a cash-poor AI resolve the same safe choice and finish its turn',async()=>{
    const s=make();land(s,4,{ai:true,cash:0,points:0});
    expect((await s.playAITurn()).success).toBe(true);
    expect(s.state.players[1].cash).toBe(300);expect(s.pendingEvent).toBeNull();expect(s.currentPlayer.id).toBe(0);
  });
});
