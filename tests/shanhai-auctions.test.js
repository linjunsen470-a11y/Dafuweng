import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const make=(mapId='shanhai-coast',count=3)=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount:count});s.state.currentPlayerIndex=1;s.currentPlayer.cash=0;s.currentPlayer.currentTile=2;Object.assign(s.state.propertyManager.getProperty(2),{owner:count===2?0:2,level:4});Object.assign(s.state.propertyManager.getProperty(3),{owner:1,level:0});s.state.phase='LANDING_ACTION';return s;};
const bid=(s,id,amount)=>s.bidAuction(id,amount,s.getAuctionView().auction.id);
it.each(['shanhai-coast','shanhai-highland'])('pauses the bankrupt AI for actual human bids on %s and never advances the turn',async map=>{
 const s=make(map);expect((await s.playAITurn()).type).toBe('AUCTION_PENDING');expect(s.aiRunning).toBe(false);expect(s.currentPlayer.id).toBe(1);expect(s.state.phase).toBe('AUCTION');expect(s.getAuctionView().bidder.id).toBe(0);expect(s.currentPlayer.isBankrupt).toBe(true);const before=s.snapshot();expect((await s.playAITurn()).type).toBe('AUCTION_PENDING');expect(s.snapshot().players).toEqual(before.players);expect(s.endTurn().success).toBe(false);
});
it('shows nonmutating quotes; enforces turn, cash, integer and stale-lot guards',()=>{
 const s=make();s.resolveLanding();const before=s.snapshot(),v=s.getAuctionView();expect(s.getAuctionView().minimum).toBe(v.minimum);const after=s.snapshot();delete after.savedAt;delete before.savedAt;expect(after).toEqual(before);
 for(const n of [-100,NaN,Infinity,650,0.5,100000])expect(s.bidAuction(0,n,v.auction.id).success).toBe(false);
 expect(s.bidAuction(2,v.minimum,v.auction.id).success).toBe(false);expect(s.bidAuction(0,v.minimum,'old-lot').success).toBe(false);expect(s.state.players).toEqual(before.players);expect(s.state.auction.bidHistory).toHaveLength(0);
});
it('restores a raised bid, transfers cash once on sale, and restores the result awaiting explicit continue',()=>{
 const s=make();s.resolveLanding();const v=s.getAuctionView(),cash=s.state.players.map(p=>p.cash),id=v.auction.id;
 expect(bid(s,0,v.minimum).success).toBe(true);expect(s.state.players.map(p=>p.cash)).toEqual(cash);expect(bid(s,2,v.minimum+100).success).toBe(true);
 const restored=make();expect(restored.restore(s.snapshot()).success).toBe(true);expect(restored.getAuctionView().minimum).toBe(v.minimum+200);expect(bid(restored,0,v.minimum+200).success).toBe(true);expect(bid(restored,2,0).completed).toBe(true);
 expect(restored.state.propertyManager.getProperty(3).owner).toBe(0);expect(restored.state.players[0].cash).toBe(cash[0]-v.minimum-200);expect(restored.state.players[2].cash).toBe(cash[2]+v.minimum+200);expect(restored.awaitingAuctionContinue).toBe(true);
 const done=restored.snapshot();expect(restored.restore(done).success).toBe(true);expect(restored.bidAuction(0,1000,id).success).toBe(false);expect(restored.state.players).toEqual(done.players);expect(restored.auctionResults).toHaveLength(1);expect(restored.endTurn().success).toBe(true);expect(restored.currentPlayer.id).toBe(2);expect(restored.auctionResults).toEqual([]);
});
it('uses the existing AI valuation reproducibly across refresh, including voluntary pass',()=>{
 const s=make();s.resolveLanding();bid(s,0,s.getAuctionView().minimum);const r=make();r.restore(s.snapshot());const a=s.bidAuctionAI(),b=r.bidAuctionAI();expect(a).toEqual(b);expect(s.state.players).toEqual(r.state.players);expect(s.state.auction).toEqual(r.state.auction);
 const poor=make();poor.resolveLanding();poor.state.players[2].cash=1000;const cash=poor.state.players.map(p=>p.cash);bid(poor,0,0);expect(poor.bidAuctionAI().auction.status).toBe('CANCELLED');expect(poor.state.players.map(p=>p.cash)).toEqual(cash);expect(poor.state.propertyManager.getProperty(3)).toMatchObject({owner:null,level:0,isMortgaged:false});
});
it('processes multiple lots in order and cannot apply a repeated click to the next lot',()=>{
 const s=make();Object.assign(s.state.propertyManager.getProperty(5),{owner:1,level:0});s.resolveLanding();const first=s.getAuctionView();bid(s,0,4000);expect(s.bidAuctionAI().completed).toBe(true);expect(s.getAuctionView().tile.id).toBe(5);const before=s.snapshot();expect(s.bidAuction(0,4000,first.auction.id).success).toBe(false);expect(s.snapshot().players).toEqual(before.players);bid(s,0,0);s.bidAuctionAI();expect(s.getAuctionView()).toBe(null);expect(s.auctionResults.map(a=>a.tileId)).toEqual([3,5]);
});
it.each(['shanhai-coast','shanhai-highland'])('keeps two-player bankruptcy as an immediate sole-survivor win on %s',map=>{
 const s=make(map,2);s.resolveLanding();expect(s.state.phase).toBe('GAME_OVER');expect(s.state.winner.id).toBe(0);expect(s.getAuctionView()).toBe(null);const old=s.snapshot();delete old.slice.auctionResults;const r=make(map,2);expect(r.restore(old).success).toBe(true);expect(r.state.phase).toBe('GAME_OVER');expect(r.auctionResults).toEqual([]);
});
