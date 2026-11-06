import assert from 'node:assert/strict';import fs from 'node:fs';import {SliceSession} from '../src/shanhai/SliceSession.js';
const games=[];
for(const mapId of ['shanhai-coast','shanhai-highland']){
 const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount:4});const landings=[];let turns=0;
 while(s.state.phase!=='GAME_OVER'&&turns++<100){
  if(s.state.phase==='AUCTION'){const v=s.getAuctionView();assert.ok((v.bidder.isAI?s.bidAuctionAI():s.bidAuction(0,0,v.auction.id)).success);continue;}
  if(s.currentPlayer.isAI){assert.ok((await s.playAITurn({onLanding:async f=>{if(f.result?.rentResult||f.result?.type==='BANK_TRANSFERRED')landings.push({round:s.state.round,player:s.currentPlayer.id,focus:structuredClone(f)});}})).success);continue;}
  if(!s.currentPlayer.isBankrupt){assert.ok(s.roll().success);s.resolveMovement();s.resolveLanding();if(s.pendingEvent){const c=s.getIslandChoices().find(c=>!c.blockedReason&&!c.cost&&!c.pointCost);assert.ok(s.chooseIslandEvent(c.id).success);}
   if(!s.getPropertyBlockReason()&&s.currentPlayer.cash-s.focus.cost>1800){if(s.focus.kind==='PURCHASE')s.purchase();else if(s.focus.kind==='UPGRADE')s.upgrade();}
   if(s.getSavingsOptions()[0]&&!s.getSavingsOptions()[0].blockedReason)s.useSavings('store');
  }
  if(s.state.phase!=='GAME_OVER'&&s.state.phase!=='AUCTION')assert.ok(s.endTurn().success);
 }
 assert.equal(s.state.phase,'GAME_OVER');games.push({mapId,turns,round:s.state.round,landings,final:s.snapshot()});
}
fs.writeFileSync('qa/debt-season-observation.json',JSON.stringify({success:true,games},null,2)+'\n');console.log(games.map(g=>({map:g.mapId,turns:g.turns,round:g.round,bankOrDebt:g.landings.length})));
