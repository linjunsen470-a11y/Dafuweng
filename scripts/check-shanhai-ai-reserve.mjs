import fs from 'node:fs/promises';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const label=process.argv[2]||'baseline';const report={scope:'Eight four-seat 16-round engine games; seat zero uses the same AI as a reproducible proxy, not a human win-rate study',games:[],exposed:[],paidRemoteTargets:[]};
for(const mapId of ['shanhai-coast','shanhai-highland'])for(const seed of [314,2718,42,2026]){
 const s=new SliceSession({storage:null,mapId});s.start({seed,playerCount:4,maxRounds:16});s.state.players[0].isAI=true;let purchases=0,upgrades=0,pauses=0;
 for(const method of ['purchase','upgrade']){const original=s[method].bind(s);s[method]=(...args)=>{const p=s.currentPlayer,cash=p.cash,cost=s.focus?.cost||0,tileId=p.currentTile;const threats=s.getTravelOptions().filter(o=>o.kind==='RENT').map(o=>({tileId:o.tileId,rent:s.state.propertyManager.calculateToll(o.tileId,s.state.newsEffect,s.state.priceIndex,p)})).sort((a,b)=>b.rent-a.rent);const r=original(...args);if(r.success){if(method==='purchase')purchases++;else upgrades++;if(threats[0]?.rent>cash-cost)report.exposed.push({mapId,seed,round:s.state.round,playerId:p.id,method,tileId,cash,cost,cashAfterCost:cash-cost,threat:threats[0]});}return r;};}
 const remote=s.useRemoteDice.bind(s);s.useRemoteDice=(steps)=>{const p=s.currentPlayer,o=s.getTravelOptions().find(o=>o.steps===steps),rent=o?.kind==='RENT'?s.state.propertyManager.calculateToll(o.tileId,s.state.newsEffect,s.state.priceIndex,p):0,cash=p.cash;const r=remote(steps);if(r.success&&rent>0)report.paidRemoteTargets.push({mapId,seed,round:s.state.round,playerId:p.id,cash,tileId:o.tileId,rent,task:s.careers[p.id]?.active,story:s.getStoryStatus()});return r;};
 for(let steps=0;s.state.phase!=='GAME_OVER'&&steps<1000;steps++){
  if(s.state.phase==='AUCTION'){if(!s.bidAuctionAI().success)throw Error('bid failed');continue;}
  if(s.awaitingAuctionContinue){if(!s.endTurn().success)throw Error('continue failed');continue;}
  const r=await s.playAITurn();if(!r.success)throw Error(r.reason);
 }
 if(s.state.phase!=='GAME_OVER')throw Error('game did not finish');pauses=s.state.logHistory.filter(l=>l.msg.includes('暂缓')).length;
 report.games.push({mapId,seed,purchases,upgrades,bankrupt:s.state.players.filter(p=>p.isBankrupt).length,winner:s.state.winner?.id,retainedPauseLogs:pauses});
}
report.summary={games:report.games.length,investmentsBelowReferenceRent:report.exposed.length,purchases:report.games.reduce((n,g)=>n+g.purchases,0),upgrades:report.games.reduce((n,g)=>n+g.upgrades,0)};await fs.writeFile(`qa/ai-reserve-${label}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
