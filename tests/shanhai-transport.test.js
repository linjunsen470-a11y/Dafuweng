import { describe, it, expect, vi } from 'vitest';
import { SliceSession } from '../src/shanhai/SliceSession.js';
import { COAST_ROUTES } from '../src/shanhai/SliceTransport.js';

const make=()=>{const s=new SliceSession({storage:null});s.start({seed:314});return s;};
function depart(s,tileId,{cash=16000,ai=false,target=null}={}){
  const snap=s.snapshot(),id=ai?1:0;snap.currentPlayerIndex=id;
  Object.assign(snap.players[id],{currentTile:tileId,cash});snap.phase='PRE_ROLL_ACTION';snap.pendingMove=null;
  Object.assign(snap.slice,{focus:null,landingResolved:false,decisionMade:false,cardUsed:false,pendingEvent:null,lastTransport:null});
  if(target!==null)snap.slice.careers[id].active={kind:'DELIVERY',targetId:target,dueRound:3,acceptedRound:1};
  expect(s.restore(snap).success).toBe(true);
}

describe('paid coastal transport',()=>{
  it('previews both fares and arrival costs without draws, payments or movement',()=>{
    const s=make(),before=s.snapshot();
    const options=s.getTransportOptions();
    expect(options[0]).toMatchObject({fare:650,chance:100,destination:{tileId:9,kind:'PURCHASE',cost:1600},alternative:null});
    expect(options[1]).toMatchObject({fare:250,chance:75,alternative:{tileId:4,event:{title:'海雾中的船期'}}});
    expect(s.state.rng.state).toBe(before.rngState);expect(s.currentPlayer.cash).toBe(16000);expect(s.currentPlayer.currentTile).toBe(0);
    depart(s,1);expect(s.getTransportOptions()).toEqual([]);
  });

  it.each(COAST_ROUTES)('$id ferry skips the road and start bonus, consumes the move, and settles property once',route=>{
    const s=make();depart(s,route.from);const before=s.snapshot();
    expect(s.takeTransport(route.id,'ferry')).toMatchObject({success:true,transport:{tileId:route.to,diverted:false}});
    expect(s.currentPlayer.cash).toBe(15350);expect(s.state.rng.state).toBe(before.rngState);
    expect(s.currentPlayer.cards).toEqual(before.players[0].cards);expect(s.state.pendingMove).toBeNull();
    expect(s.roll().success).toBe(false);expect(s.useRemoteDice(1).success).toBe(false);expect(s.takeTransport(route.id,'ferry').success).toBe(false);
    expect(s.endTurn().success).toBe(false);
    s.resolveLanding();const cost=s.focus.cost;expect(s.purchase().success).toBe(true);
    expect(s.currentPlayer.cash).toBe(15350-cost);expect(s.purchase().success).toBe(false);
  });

  it.each([75,76])('skiff boundary draw %i persists the chosen landing and charges only once',draw=>{
    const s=make();const rng=vi.spyOn(s.state.rng,'int').mockReturnValue(draw);
    const result=s.takeTransport('harbor','skiff');const target=draw===75?9:4;
    expect(result.transport).toMatchObject({tileId:target,diverted:draw>75,fare:250});expect(rng).toHaveBeenCalledTimes(1);
    expect(s.currentPlayer.cash).toBe(15750);
    const copy=make();expect(copy.restore(s.snapshot()).success).toBe(true);
    expect(copy.lastTransport).toEqual(s.lastTransport);expect(copy.currentPlayer.currentTile).toBe(target);
    expect(copy.takeTransport('harbor','skiff').success).toBe(false);copy.resolveLanding();
    if(target===4){expect(copy.pendingEvent).toEqual({tileId:4});expect(copy.chooseIslandEvent('work').cashDelta).toBe(300);}
    else expect(copy.focus.kind).toBe('PURCHASE');
    const settled=copy.snapshot();copy.restore(settled);expect(copy.resolveLanding().success).toBe(false);
    expect(copy.currentPlayer.cash).toBe(settled.players[0].cash);
  });

  it('rejects wrong station, insufficient fare and movement already begun without drawing or charging',()=>{
    const s=make();depart(s,0,{cash:249});const rng=vi.spyOn(s.state.rng,'int');
    expect(s.takeTransport('harbor','skiff').success).toBe(false);expect(s.takeTransport('garden','ferry').success).toBe(false);
    expect(s.currentPlayer.cash).toBe(249);expect(rng).not.toHaveBeenCalled();
    s.useRemoteDice(1);const pending=structuredClone(s.state.pendingMove);
    expect(s.takeTransport('harbor','skiff').success).toBe(false);expect(s.state.pendingMove).toEqual(pending);
  });

  it('uses the actual arrival for delivery and rent; passing a target grants nothing',()=>{
    const s=make();depart(s,0,{target:4});s.takeTransport('harbor','ferry');s.resolveLanding();expect(s.careers[0].completed).toBe(0);
    const rent=make();depart(rent,0,{target:9});rent.state.propertyManager.getProperty(9).owner=1;
    const otherCash=rent.state.players[1].cash;rent.takeTransport('harbor','ferry');const result=rent.resolveLanding();
    expect(result.commission).toMatchObject({cash:900,points:15});expect(rent.focus.kind).toBe('RENT');
    const paid=rent.state.players[1].cash-otherCash;expect(paid).toBeGreaterThan(0);expect(rent.currentPlayer.cash).toBe(16000-650-paid+900);
    const divert=make();depart(divert,0,{target:4});vi.spyOn(divert.state.rng,'int').mockReturnValue(100);
    divert.takeTransport('harbor','skiff');divert.resolveLanding();expect(divert.careers[0].completed).toBe(0);
    expect(divert.chooseIslandEvent('work').commission.cash).toBe(900);
  });

  it('AI pays the same fare to reach a public delivery goal, never rolls again, and declines unaffordable transport',async()=>{
    const s=make();depart(s,0,{ai:true,target:9});const roll=vi.fn(),boat=vi.fn();
    const before=s.state.players[1].cash;
    expect((await s.playAITurn({onRoll:roll,onTransport:boat})).success).toBe(true);
    expect(boat).toHaveBeenCalledTimes(1);expect(roll).not.toHaveBeenCalled();
    expect(s.state.players[1].currentTile).toBe(9);expect(s.careers[1].completed).toBe(1);
    expect(s.state.players[1].cash).toBe(before-650+600-1600); // same ordinary purchase after arrival
    depart(s,0,{ai:true,target:9,cash:249});expect(s.chooseAITransport()).toBeUndefined();
  });

  it('loads pre-transport saves and leaves their in-progress walking path untouched',()=>{
    const s=make();s.useRemoteDice(3);s.advanceMove();const old=s.snapshot();delete old.slice.lastTransport;
    const copy=make();copy.restore(old);expect(copy.lastTransport).toBeNull();expect(copy.state.pendingMove).toEqual(old.pendingMove);
    copy.resolveMovement();copy.resolveLanding();expect(copy.currentPlayer.currentTile).toBe(3);
    expect(copy.currentPlayer.cash).toBe(old.players[0].cash);
  });
});
