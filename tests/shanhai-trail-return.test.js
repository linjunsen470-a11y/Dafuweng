import {it,expect,vi} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const land=(mapId='shanhai-highland',ai=false)=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314});s.state.currentPlayerIndex=ai?1:0;s.currentPlayer.currentTile=16;s.state.phase='LANDING_ACTION';s.resolveLanding();return s;};
const stable=s=>{const x=s.snapshot();delete x.savedAt;return x;};
it('offers distinct current/reverse routes without changing state or drawing random numbers',()=>{
 const s=land(),before=stable(s),rng=vi.spyOn(s.state.rng,'int');const c=s.getIslandChoices().find(c=>c.id==='turnback');expect(c.cost).toBe(250);expect(c.routePreview.current.stops.slice(0,3).map(t=>t.tileId)).toEqual([17,18,19]);expect(c.routePreview.reverse.stops.slice(0,3).map(t=>t.tileId)).toEqual([15,14,13]);expect(stable(s)).toEqual(before);expect(rng).not.toHaveBeenCalled();
});
it('requires the full fare, charges once, and leaves movement/cards/strategy opportunity untouched',()=>{
 const s=land();s.currentPlayer.cash=249;const before=stable(s);expect(s.chooseIslandEvent('turnback')).toMatchObject({success:false,reason:'现金不足'});expect(stable(s)).toEqual(before);s.currentPlayer.cash=250;s.cardUsed=true;const cards=[...s.currentPlayer.cards],rng=vi.spyOn(s.state.rng,'int');expect(s.chooseIslandEvent('turnback')).toMatchObject({success:true,cashDelta:-250,pointsDelta:0});expect(s.currentPlayer).toMatchObject({cash:0,currentTile:16,direction:-1,cards});expect(s.cardUsed).toBe(true);expect(rng).not.toHaveBeenCalled();expect(s.pendingEvent).toBe(null);expect(s.chooseIslandEvent('turnback').success).toBe(false);expect(s.focus.description).toContain('15号');
});
it('reverses an already reversed traveler and carries the direction into real movement',()=>{
 const s=land();s.currentPlayer.direction=-1;expect(s.getIslandChoices().find(c=>c.turnBack).routePreview.reverse.stops[0].tileId).toBe(17);s.chooseIslandEvent('turnback');expect(s.currentPlayer.direction).toBe(1);s.resetPresentation();s.state.phase='PRE_ROLL_ACTION';expect(s.useRemoteDice(1).success).toBe(true);s.resolveMovement();expect(s.currentPlayer.currentTile).toBe(17);
});
it('includes visible fence stops, enemy rent and mortgages in the reference routes',()=>{
 const s=land(),pm=s.state.propertyManager;const danger=pm.getProperty(17);danger.owner=1;danger.level=4;danger.hasObstacle=true;const r=s.getTrailTurnPreview();expect(r.current.stops.every(t=>t.tileId===17)).toBe(true);expect(r.current.meanRent).toBe(pm.calculateToll(17,s.state.newsEffect,s.state.priceIndex));expect(r.reverse.meanRent).toBe(0);danger.isMortgaged=true;expect(s.getTrailTurnPreview().current.meanRent).toBe(0);
});
it('AI pays the same fare only when visible rent savings justify giving up event income',()=>{
 const s=land('shanhai-highland',true);s.currentPlayer.cards=[];const danger=s.state.propertyManager.getProperty(17);danger.owner=0;danger.level=4;danger.hasObstacle=true;const before=s.currentPlayer.cash;expect(s.chooseAIIslandEvent()).toMatchObject({choiceId:'turnback',cashDelta:-250});expect(s.currentPlayer.cash).toBe(before-250);expect(s.currentPlayer.direction).toBe(-1);
 const safe=land('shanhai-highland',true);safe.currentPlayer.cards=[];expect(safe.chooseAIIslandEvent().choiceId).not.toBe('turnback');const poor=land('shanhai-highland',true);poor.currentPlayer.cash=0;expect(poor.chooseAIIslandEvent()).toMatchObject({choiceId:'pick',cashDelta:220});
});
it('restores old pending and new completed saves without adding fields or replaying payment',()=>{
 const s=land(),old=s.snapshot();old.slice.focus.description='旧版茶坡互助';const copy=new SliceSession({storage:null,mapId:'shanhai-highland'});expect(copy.restore(old).success).toBe(true);expect(copy.getIslandChoices().some(c=>c.turnBack)).toBe(true);copy.chooseIslandEvent('turnback');const done=copy.snapshot(),restored=new SliceSession({storage:null,mapId:'shanhai-highland'});expect(restored.restore(done).success).toBe(true);expect(restored.currentPlayer.direction).toBe(-1);expect(restored.currentPlayer.cash).toBe(copy.currentPlayer.cash);expect(restored.chooseIslandEvent('turnback').success).toBe(false);expect(Object.keys(done.slice)).toEqual(Object.keys(old.slice));
});
it('leaves coast event choices and the original mountain story/commission progress intact',()=>{
 const coast=land('shanhai-coast');expect(coast.getIslandChoices().some(c=>c.turnBack)).toBe(false);expect(coast.chooseIslandEvent('turnback').success).toBe(false);expect(coast.chooseIslandEvent('volunteer').pointsDelta).toBe(20);const s=land(),stories=structuredClone(s.stories),careers=structuredClone(s.careers);s.chooseIslandEvent('turnback');expect(s.stories).toEqual(stories);expect(s.careers).toEqual(careers);
});
