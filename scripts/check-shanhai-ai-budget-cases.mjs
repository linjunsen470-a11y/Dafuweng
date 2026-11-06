import fs from 'node:fs/promises';
import {SliceSession} from '../src/shanhai/SliceSession.js';
const label=process.argv[2]||'baseline',cases=[];
for(const mapId of ['shanhai-coast','shanhai-highland'])for(const kind of ['PURCHASE','UPGRADE']){
 const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount:4});s.state.round=6;s.state.currentPlayerIndex=3;const p=s.currentPlayer;p.currentTile=1;p.godType=null;p.cash=kind==='PURCHASE'?3500:2800;Object.assign(s.state.propertyManager.getProperty(1),{owner:kind==='PURCHASE'?null:3,level:0});Object.assign(s.state.propertyManager.getProperty(2),{owner:0,level:4});s.state.phase='LANDING_ACTION';s.resolveLanding();const before=s.snapshot(),rent=s.state.propertyManager.calculateToll(2,s.state.newsEffect,s.state.priceIndex,p),cost=s.focus.cost;await s.playAITurn();cases.push({mapId,kind,beforeCash:before.players[3].cash,cost,rent,nextRentCovered:p.cash>=rent,afterCash:p.cash,property:s.state.propertyManager.getProperty(1),logs:s.state.logHistory.slice(-5),...(label==='baseline'?{fixture:before}:{})});
}
await fs.writeFile(`qa/ai-budget-cases-${label}.json`,JSON.stringify(cases,null,2)+'\n');console.log(JSON.stringify(cases.map(({fixture,logs,...r})=>r),null,2));
