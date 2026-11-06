import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {canPauseSpectating} from '../src/shanhai/SliceTurnSummary.js';
const make=(mapId='shanhai-coast',playerCount=4)=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount});s.state.round=13;return s;};
const bankrupt=map=>{const s=make(map);s.currentPlayer.cash=0;s.currentPlayer.currentTile=2;Object.assign(s.state.propertyManager.getProperty(2),{owner:2,level:4});Object.assign(s.state.propertyManager.getProperty(3),{owner:0,level:0});s.state.phase='LANDING_ACTION';s.resolveLanding();return s;};
it.each(['shanhai-coast','shanhai-highland'])('offers a checkpoint only after bankruptcy auctions and result acknowledgment on %s',map=>{
 const s=bankrupt(map);expect(s.state.players[0].isBankrupt).toBe(true);expect(s.state.phase).toBe('AUCTION');expect(canPauseSpectating(s)).toBe(false);while(s.getAuctionView()){expect(s.bidAuctionAI().success).toBe(true);expect(canPauseSpectating(s)).toBe(false);}expect(s.awaitingAuctionContinue).toBe(true);expect(canPauseSpectating(s)).toBe(false);expect(s.endTurn().success).toBe(true);expect(canPauseSpectating(s)).toBe(true);
 const before=s.snapshot();expect(canPauseSpectating(s)).toBe(true);const after=s.snapshot();delete before.savedAt;delete after.savedAt;expect(after).toEqual(before);const restored=make(map);expect(restored.restore(s.snapshot()).success).toBe(true);expect(canPauseSpectating(restored)).toBe(true);
});
it.each(['shanhai-coast','shanhai-highland'])('resumes an old mid-movement AI save before offering a spectator checkpoint on %s',async map=>{
 const s=make(map);s.state.players[0].isBankrupt=true;s.state.currentPlayerIndex=1;expect(s.roll().success).toBe(true);expect(s.state.pendingMove).toBeTruthy();expect(canPauseSpectating(s)).toBe(false);const r=make(map);expect(r.restore(s.snapshot()).success).toBe(true);expect(canPauseSpectating(r)).toBe(false);expect((await s.playAITurn()).success).toBe(true);expect((await r.playAITurn()).success).toBe(true);expect(r.state.players).toEqual(s.state.players);expect(r.snapshot().properties).toEqual(s.snapshot().properties);expect(r.snapshot().rngState).toBe(s.snapshot().rngState);expect(canPauseSpectating(r)).toBe(true);
});
it('does not stop living humans, final results, unresolved debt or an AI callback already running',()=>{
 for(const count of [2,3,4]){const s=make('shanhai-coast',count);s.state.currentPlayerIndex=1;expect(canPauseSpectating(s)).toBe(false);}
 const s=make();s.state.players[0].isBankrupt=true;s.state.currentPlayerIndex=1;expect(canPauseSpectating(s)).toBe(true);s.aiRunning=true;expect(canPauseSpectating(s)).toBe(false);s.aiRunning=false;s.state.pendingDebt={amount:1000};expect(canPauseSpectating(s)).toBe(false);s.state.pendingDebt=null;s.state.phase='GAME_OVER';expect(canPauseSpectating(s)).toBe(false);
});
