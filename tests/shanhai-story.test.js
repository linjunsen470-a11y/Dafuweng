import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const make=()=>{const s=new SliceSession({storage:null});s.start({seed:314});return s;};
const land=(s,n)=>{if(!s.currentPlayer.cards.includes('REMOTE_DICE'))expect(s.buyRemoteDice().success).toBe(true);expect(s.useRemoteDice(n).success).toBe(true);s.resolveMovement();s.resolveLanding();};
const next=async s=>{expect(s.endTurn().success).toBe(true);expect((await s.playAITurn()).success).toBe(true);};
it('completes the original chain through real commissions and stops, with two cosmetic once-only endings',async()=>{
 const s=make(),initial=s.snapshot();expect(s.advanceStory('accept').success).toBe(true);expect(s.advanceStory('accept').success).toBe(false);expect(s.currentPlayer.cash).toBe(initial.players[0].cash);expect(s.state.rng.state).toBe(initial.rngState);
 s.acceptCommission('DELIVERY');land(s,3);expect(s.stories[0]).toMatchObject({stage:2,commissionKind:'DELIVERY'});expect(s.currentPlayer.cash).toBe(16900);
 const resume=make();resume.restore(s.snapshot());expect(resume.stories[0].stage).toBe(2);expect(resume.currentPlayer.cash).toBe(16900);
 await next(s);land(s,5);expect(s.advanceStory('collect').success).toBe(true);expect(s.advanceStory('collect').success).toBe(false);await next(s);land(s,6);await next(s);land(s,2);
 expect(s.advanceStory('garden').success).toBe(false);expect(s.chooseIslandEvent('volunteer').success).toBe(true);const ready=s.snapshot();
 for(const ending of ['harbor','garden']){const copy=make();copy.restore(ready);const p=copy.currentPlayer,balances=[p.cash,p.cardPoints,copy.state.rng.state];expect(copy.advanceStory(ending).success).toBe(true);expect(copy.stories[0]).toMatchObject({stage:4,ending});expect([p.cash,p.cardPoints,copy.state.rng.state]).toEqual(balances);expect(copy.advanceStory(ending).success).toBe(false);const final=copy.snapshot();copy.restore(final);expect(copy.getStoryStatus().endingInfo.title).toBe(ending==='harbor'?'归航之光':'花棚夜话');}
});
it('passing a story stop and merely accepting or expiring a commission never advance the chain',async()=>{
 const s=make();s.advanceStory('accept');s.acceptCommission('DELIVERY');expect(s.stories[0].stage).toBe(1);land(s,3);await next(s);land(s,6);expect(s.currentPlayer.currentTile).toBe(9);expect(s.advanceStory('collect').success).toBe(false);expect(s.stories[0].stage).toBe(2);
 const expired=make();expired.advanceStory('accept');expired.acceptCommission('DELIVERY');land(expired,1);expired.state.round=3;expired.endTurn();expect(expired.stories[0].stage).toBe(1);
});
it('old saves start the optional story unaccepted without retroactive commission credit or rewards',()=>{
 const s=make();s.acceptCommission('DELIVERY');land(s,3);const old=s.snapshot();delete old.slice.stories;expect(s.restore(old).success).toBe(true);expect(s.stories[0].stage).toBe(0);expect(s.currentPlayer.cash).toBe(old.players[0].cash);expect(s.advanceStory('accept').success).toBe(false);
 s.state.phase='GAME_OVER';expect(s.advanceStory('harbor').success).toBe(false);
});
it('AI accepts and progresses under the same landing and commission conditions',async()=>{
 const s=make();land(s,1);await next(s);expect(s.stories[1]).toMatchObject({stage:2,commissionKind:'RENEWAL'});expect(s.stories[0].stage).toBe(0);
 // An isolated saved-state fixture at the story stop exercises the shared AI interaction endpoint.
 const snap=s.snapshot();snap.currentPlayerIndex=1;snap.players[1].currentTile=8;snap.phase='PRE_ROLL_ACTION';Object.assign(snap.slice,{focus:null,landingResolved:false,pendingEvent:null});expect(s.restore(snap).success).toBe(true);const cash=s.currentPlayer.cash;s.advanceAIStory();expect(s.stories[1].stage).toBe(3);expect(s.currentPlayer.cash).toBe(cash);
 s.currentPlayer.currentTile=16;s.pendingEvent={tileId:16};expect(s.getStoryStatus().blockedReason).toContain('来信');s.advanceAIStory();expect(s.stories[1].stage).toBe(3);s.pendingEvent=null;s.advanceAIStory();expect(s.stories[1]).toMatchObject({stage:4,ending:'garden'});
});
