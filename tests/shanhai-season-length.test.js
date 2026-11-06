import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {seasonReport} from '../src/shanhai/SliceSeasonReport.js';
const make=(mapId='shanhai-coast',options={})=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount:4,...options});return s;};
const stable=s=>{const x=s.snapshot();delete x.savedAt;x.logHistory=x.logHistory.map(({time,...l})=>l);return x;};
it('keeps default 16-round setup identical, including initial assets, and stores a chosen 12-round limit',()=>{
 expect(stable(make())).toEqual(stable(make('shanhai-coast',{maxRounds:16})));const short=make('shanhai-coast',{maxRounds:12}),standard=make();expect(short.state.players).toEqual(standard.state.players);expect(short.snapshot().properties).toEqual(standard.snapshot().properties);expect(short.snapshot().maxRounds).toBe(12);expect(short.state.matchConfig.options.maxRounds).toBe(12);
});
it.each(['shanhai-coast','shanhai-highland'])('completes a fixed-seed 12-round four-seat game under the existing AI rules on %s',async map=>{
 const s=make(map,{maxRounds:12});s.state.players[0].isAI=true;let turns=0;while(s.state.phase!=='GAME_OVER'&&turns<48){expect((await s.playAITurn()).success).toBe(true);turns++;}expect(s.state.phase).toBe('GAME_OVER');expect(s.state.round).toBe(12);expect(turns).toBeLessThanOrEqual(48);expect(turns).toBeGreaterThan(12);const r=seasonReport(s);expect(r.maxRounds).toBe(12);expect(r.rankings).toHaveLength(4);expect(r.winner.id).toBe(s.state.winner.id);expect(r.winner.assets.total).toBe(Math.max(...r.rankings.map(p=>p.assets.total)));expect(s.state.winReason).toBe('NET_WORTH');
});
it.each(['shanhai-coast','shanhai-highland'])('restores the real limit, clips commission deadlines and waits for all four last-round turns on %s',async map=>{
 const s=make(map,{maxRounds:12});s.state.round=12;expect(s.getCommissionOffers().every(o=>o.dueRound===12)).toBe(true);expect(s.chooseAIConstruction()).toBeNull();const restored=make(map);expect(restored.restore(s.snapshot()).success).toBe(true);expect(restored.state.maxRounds).toBe(12);expect(restored.getAIPropertyBudget().reserve).toBe(1800);restored.state.players[0].isAI=true;for(let i=0;i<4;i++){expect(restored.currentPlayer.id).toBe(i);expect((await restored.playAITurn()).success).toBe(true);expect(restored.state.phase==='GAME_OVER').toBe(i===3);}
 for(const maxRounds of [16,3]){const old=make(map,{maxRounds});expect(restored.restore(old.snapshot()).success).toBe(true);expect(restored.state.maxRounds).toBe(maxRounds);}
});
it('retains an early sole-survivor win in a short two-player game',()=>{
 const s=make('shanhai-coast',{playerCount:2,maxRounds:12});s.state.players[1].isBankrupt=true;expect(s.state.checkWinCondition()).toBe(true);expect(s.state.winReason).toBe('LAST_PLAYER');expect(seasonReport(s)).toMatchObject({round:1,maxRounds:12,winner:{id:0}});
});
