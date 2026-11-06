import {it,expect} from 'vitest';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {sliceCast} from '../src/shanhai/SliceMap.js';
import {seasonReport} from '../src/shanhai/SliceSeasonReport.js';
import {tacticBoardView} from '../src/shanhai/SliceTactics.js';
const make=(mapId='shanhai-coast',playerCount=3)=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount});return s;};
it('keeps old two-player defaults and builds three unique ordered roles for every human choice',()=>{
 expect(sliceCast().map(c=>c.id)).toEqual(['ayu','qinghe']);for(const id of ['ayu','qinghe','xingluo']){const cast=sliceCast(id,id,3);expect(cast[0].id).toBe(id);expect(new Set(cast.map(c=>c.id)).size).toBe(3);}expect(sliceCast('xingluo','ayu',3).map(c=>c.id)).toEqual(['xingluo','ayu','qinghe']);const old=new SliceSession({storage:null});old.start();expect(old.state.players.map(p=>p.isAI)).toEqual([false,true]);
});
it.each(['shanhai-coast','shanhai-highland'])('runs human + both AIs before incrementing a round on %s',async map=>{
 const s=make(map);expect(s.state.players.map(p=>p.isAI)).toEqual([false,true,true]);s.state.players[0].isAI=true;for(const [id,next,round] of [[0,1,1],[1,2,1],[2,0,2]]){expect(s.currentPlayer.id).toBe(id);expect((await s.playAITurn()).success).toBe(true);expect(s.currentPlayer.id).toBe(next);expect(s.state.round).toBe(round);}expect(Object.keys(s.careers)).toEqual(['0','1','2']);expect(Object.keys(s.abilities)).toEqual(['0','1','2']);
});
it('pays rent to the third seat and preserves its ownership through a save',()=>{
 const s=make();Object.assign(s.state.propertyManager.getProperty(1),{owner:2,level:1});const cash=s.state.players.map(p=>p.cash);s.currentPlayer.currentTile=1;s.state.phase='LANDING_ACTION';const rent=s.state.propertyManager.calculateToll(1,s.state.newsEffect,s.state.priceIndex);s.resolveLanding();expect(s.state.players[0].cash).toBe(cash[0]-rent);expect(s.state.players[1].cash).toBe(cash[1]);expect(s.state.players[2].cash).toBe(cash[2]+rent);const restored=make();expect(restored.restore(s.snapshot()).success).toBe(true);expect(restored.state.propertyManager.getProperty(1).owner).toBe(2);expect(restored.state.players[2].cash).toBe(cash[2]+rent);
});
it('resumes the second AI exactly once and leaves old two-player saves as two-player',async()=>{
 const s=make();s.state.players[0].isAI=true;await s.playAITurn();s.state.players[0].isAI=false;await s.playAITurn();expect(s.currentPlayer.id).toBe(2);const restored=make();expect(restored.restore(s.snapshot()).success).toBe(true);await s.playAITurn();await restored.playAITurn();expect(restored.currentPlayer.id).toBe(0);expect(restored.state.round).toBe(2);expect(restored.state.players).toEqual(s.state.players);expect(restored.careers).toEqual(s.careers);const old=make('shanhai-coast',2);expect(restored.restore(old.snapshot()).success).toBe(true);expect(restored.state.players.length).toBe(2);
});
it('offers the third person as a distinct card target and considers both rivals for rent traps',()=>{
 const s=make();expect(s.getTactics().find(t=>t.id==='TURN_AROUND').targets.map(t=>t.id)).toEqual([0,1,2]);const view=tacticBoardView(s,'TURN_AROUND');expect(new Set(view.targets.map(t=>`${t.x}:${t.z}`)).size).toBe(3);expect(s.useTactic('TURN_AROUND',2).success).toBe(true);expect(s.state.players[2].direction).toBe(-1);
 const a=make();a.state.currentPlayerIndex=1;a.currentPlayer.currentTile=10;a.state.players[0].currentTile=17;a.state.players[2].currentTile=0;Object.assign(a.state.propertyManager.getProperty(2),{owner:1,level:1});expect(a.useAITactic().success).toBe(true);expect(a.state.propertyManager.getProperty(2).hasObstacle).toBe(true);
});
it('skips a bankrupt seat without ending the surviving two-player competition',async()=>{
 const s=make();s.state.players[1].isBankrupt=true;expect(s.state.checkWinCondition()).toBe(false);s.state.players[0].isAI=true;await s.playAITurn();expect(s.currentPlayer.id).toBe(2);await s.playAITurn();expect(s.currentPlayer.id).toBe(0);expect(s.state.round).toBe(2);expect(s.state.phase).not.toBe('GAME_OVER');
});
it('includes all three in the final ranking and retains the engine winner after restore',()=>{
 const s=make('shanhai-highland');s.state.players[2].cash=18000;s.state.round=17;s.state.checkWinCondition();const restored=make('shanhai-highland');expect(restored.restore(s.snapshot()).success).toBe(true);const r=seasonReport(restored);expect(r.rankings.map(p=>p.id)).toEqual([2,0,1]);expect(r.winner.id).toBe(2);expect(r.mapId).toBe('shanhai-highland');
});

it.each([0,1])('completes real debt liquidation for seat %i, opens auctions and permits explicit all-pass without charging survivors, and continues',id=>{
 const s=make();s.state.currentPlayerIndex=id;s.currentPlayer.cash=0;s.currentPlayer.currentTile=2;
 const creditor=id===0?1:0;Object.assign(s.state.propertyManager.getProperty(2),{owner:creditor,level:4});Object.assign(s.state.propertyManager.getProperty(3),{owner:id,level:0});s.state.phase='LANDING_ACTION';const untouched=s.state.players[2].cash;s.resolveLanding();expect(s.currentPlayer.isBankrupt).toBe(true);expect(s.focus.kind).toBe('BANKRUPT');expect(s.state.phase).toBe('AUCTION');for(let n=0;n<6&&s.getAuctionView();n++){const v=s.getAuctionView();expect(s.bidAuction(v.bidder.id,0,v.auction.id).success).toBe(true);}expect(s.state.phase).toBe('LANDING_ACTION');expect(s.state.auction).toBe(null);expect(s.state.bankruptcyAuctionQueue).toEqual([]);expect(s.state.propertyManager.getProperty(3)).toMatchObject({owner:null,level:0,isMortgaged:false});expect(s.state.players[2].cash).toBe(untouched);expect(s.endTurn().success).toBe(true);expect(s.currentPlayer.isBankrupt).toBe(false);
});
