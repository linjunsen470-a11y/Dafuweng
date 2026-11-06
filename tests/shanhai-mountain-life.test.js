import {it,expect,vi} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const land=(cash=16000,ai=false)=>{const s=new SliceSession({storage:null,mapId:'shanhai-highland'});s.start({seed:314});s.state.currentPlayerIndex=ai?1:0;s.currentPlayer.currentTile=22;s.currentPlayer.cash=cash;s.state.phase='LANDING_ACTION';s.resolveLanding();return s;};
it.each([[60,true,800],[61,false,-300]])('settles ridge delivery once at probability boundary %i without moving the player',(draw,won,delta)=>{
 const s=land(),rng=vi.spyOn(s.state.rng,'int').mockReturnValue(draw);expect(s.chooseIslandEvent('craft')).toMatchObject({success:true,won,cashDelta:delta});expect(s.currentPlayer.cash).toBe(16000+delta);expect(s.currentPlayer.currentTile).toBe(22);expect(s.focus.description).toContain(won?'赶上收货':'落石封路');expect(rng).toHaveBeenCalledTimes(1);expect(s.chooseIslandEvent('craft').success).toBe(false);
});
it('requires upfront cash for the guaranteed detour, draws no random number, and keeps free road work',()=>{
 const s=land(499),rng=vi.spyOn(s.state.rng,'int');expect(s.chooseIslandEvent('guide').success).toBe(false);expect(s.currentPlayer.cash).toBe(499);s.currentPlayer.cash=500;expect(s.chooseIslandEvent('guide')).toMatchObject({cashDelta:350,won:true});expect(s.currentPlayer.cash).toBe(850);expect(rng).not.toHaveBeenCalled();const poor=land(0);expect(poor.chooseIslandEvent('trail')).toMatchObject({cashDelta:200,pointsDelta:10});
});
it('lets AI use the same risk budget, fare and cargo resolution',()=>{
 for(const [cash,choice] of [[16000,'craft'],[3000,'guide'],[0,'trail']]){const s=land(cash,true);vi.spyOn(s.state.rng,'int').mockReturnValue(61);const r=s.chooseAIIslandEvent();expect(r.choiceId).toBe(choice);expect(s.currentPlayer.cash).toBe(cash+r.cashDelta);expect(s.currentPlayer.currentTile).toBe(22);}
});
it('restores a pending previous-version mountain save and retains coast event behavior',()=>{
 const s=land(),old=s.snapshot();old.slice.focus.title='护林小屋的留言';const copy=new SliceSession({storage:null,mapId:'shanhai-highland'});expect(copy.restore(old).success).toBe(true);expect(copy.focus.title).toBe('雨后的盘山货道');expect(copy.getIslandChoices().find(c=>c.id==='guide').cost).toBe(500);const a=s.chooseIslandEvent('craft'),b=copy.chooseIslandEvent('craft');expect(a).toEqual(b);expect(copy.chooseIslandEvent('guide').success).toBe(false);
 const coast=new SliceSession({storage:null});coast.start();coast.currentPlayer.currentTile=22;coast.state.phase='LANDING_ACTION';coast.resolveLanding();expect(coast.focus.title).toBe('林间交换会');expect(coast.getIslandChoices().find(c=>c.id==='guide')).toBeUndefined();
});
