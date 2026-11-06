import {it,expect,vi} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const make=()=>{const s=new SliceSession({storage:null,mapId:'shanhai-highland'});s.start({seed:314});return s;};
const land=(s,id)=>{s.currentPlayer.currentTile=id;s.state.phase='LANDING_ACTION';s.resetPresentation();s.resolveLanding();};
it('completes the mountain story through kiln, tea and road choices without extra rewards',()=>{
 const s=make();expect(s.advanceStory('collect').success).toBe(false);expect(s.advanceStory('accept').success).toBe(true);s.acceptCommission('RENEWAL');land(s,1);s.purchase();expect(s.stories[0].stage).toBe(1);
 land(s,10);expect(s.endTurn().success).toBe(false);vi.spyOn(s.state.rng,'int').mockReturnValue(100);expect(s.chooseIslandEvent('kiln').won).toBe(false);expect(s.stories[0].stage).toBe(2);expect(s.getStoryStatus().targetId).toBe(16);
 land(s,16);expect(s.advanceStory('collect').success).toBe(false);s.chooseIslandEvent('pick');const cash=s.currentPlayer.cash;expect(s.advanceStory('collect').success).toBe(true);expect(s.currentPlayer.cash).toBe(cash);
 land(s,22);expect(s.advanceStory('trail').success).toBe(false);s.chooseIslandEvent('trail');const before=s.currentPlayer.cash;expect(s.advanceStory('trail').success).toBe(true);expect(s.getStoryStatus().endingInfo.title).toBe('古道暖茶人');expect(s.currentPlayer.cash).toBe(before);expect(s.advanceStory('trail').success).toBe(false);
 const copy=make();expect(copy.restore(s.snapshot()).success).toBe(true);expect(copy.stories[0]).toEqual(s.stories[0]);expect(copy.advanceStory('teahouse').success).toBe(false);
});
it('keeps old saves optional, ignores events before acceptance, and restores pending kiln progress',()=>{
 const s=make();const old=s.snapshot();delete old.slice.stories;expect(s.restore(old).success).toBe(true);land(s,10);s.chooseIslandEvent('pack');expect(s.stories[0].stage).toBe(0);s.currentPlayer.currentTile=0;s.state.phase='PRE_ROLL_ACTION';s.advanceStory('accept');land(s,10);const copy=make();copy.restore(s.snapshot());copy.chooseIslandEvent('pack');expect(copy.stories[0].stage).toBe(2);expect(s.stories[0].stage).toBe(1);copy.currentPlayer.currentTile=15;expect(copy.advanceStory('collect').success).toBe(false);
});
it('uses the same prerequisites and choices for the AI and gives it the tea-table ending',()=>{
 const s=make();s.state.currentPlayerIndex=1;s.advanceAIStory();expect(s.stories[1].stage).toBe(1);land(s,10);s.chooseAIIslandEvent();s.advanceAIStory();expect(s.stories[1].stage).toBe(2);land(s,16);s.advanceAIStory();expect(s.stories[1].stage).toBe(2);s.chooseAIIslandEvent();s.advanceAIStory();expect(s.stories[1].stage).toBe(3);land(s,22);s.chooseAIIslandEvent();s.advanceAIStory();expect(s.stories[1].ending).toBe('teahouse');expect(s.stories[0].stage).toBe(0);
});
