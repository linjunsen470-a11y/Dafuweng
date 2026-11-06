import assert from 'node:assert/strict';import fs from 'node:fs/promises';import puppeteer from 'puppeteer-core';import {preview} from 'vite';import {SliceSession} from './src/shanhai/SliceSession.js';
const report={kind:'midgame construction quotes, confirmation, save and AI feedback',checks:[],errors:[]};
const fixtures={};
// Reach midgame through normal AI turns, then hand player 0's controls to the UI.
// Select fixed-seed examples where the next real AI turn also demonstrates construction.
for(const mapId of ['shanhai-coast','shanhai-highland']){
 for(const seed of [17,41,73,101,211,314,509,811,1201,2027,4093,7132]){
  const s=new SliceSession({storage:null,mapId});s.start({seed});s.state.players.forEach(p=>p.isAI=true);let guard=0;
  while((s.state.round<8||s.currentPlayer.id!==0)&&guard++<30)assert.ok((await s.playAITurn()).success);
  if(s.state.round!==8)continue;
  s.state.players[0].isAI=false;const q=s.getConstructionOptions().find(o=>!o.blockedReason&&o.tileId!==s.currentPlayer.currentTile);if(!q)continue;
  const snapshot=s.snapshot();s.contractUpgrade(q.tileId);s.roll();s.resolveMovement();s.resolveLanding();if(s.pendingEvent)s.chooseIslandEvent(s.getIslandChoices()[0].id);s.endTurn();let built=false;
  if(s.currentPlayer.isAI)await s.playAITurn({onAbility:async r=>{if(r.type==='CONSTRUCTION_COMPLETED')built=true;}});
  if(built){fixtures[mapId]={snapshot,quote:q,seed};break;}
 }
 assert.ok(fixtures[mapId],`find actual round 8 example for ${mapId}`);
}
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5204,strictPort:true}});let browser;
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage();page.setDefaultTimeout(60000);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.evaluateOnNewDocument(fixtures=>{if(!sessionStorage.getItem('construction-fixtures')){for(const [id,{snapshot}] of Object.entries(fixtures))localStorage.setItem(`${id}:save:v1`,JSON.stringify(snapshot));localStorage.setItem('shanhai:audio',JSON.stringify({musicEnabled:false,sfxEnabled:false}));sessionStorage.setItem('construction-fixtures','loaded');}},fixtures);
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 const ready=()=>page.waitForFunction(()=>window.shanhai?.ready),idle=()=>page.waitForFunction(()=>!window.shanhai.busy&&!window.shanhai.session.currentPlayer.isAI);
 const snap=()=>page.evaluate(()=>{const s=window.shanhai.session.snapshot();delete s.savedAt;return s;});
 for(const [mapId,f] of Object.entries(fixtures)){
  await page.setViewport(mapId==='shanhai-coast'?{width:1100,height:800}:{width:390,height:844});await page.goto(`http://127.0.0.1:5204/shanhai.html?map=${mapId==='shanhai-coast'?'coast':'highland'}`);await ready();await page.click('#resume-button');await idle();assert.equal(await page.evaluate(()=>window.shanhai.session.state.round),8);
  const before=await snap();const otherKey=mapId==='shanhai-coast'?'shanhai-highland:save:v1':'shanhai-coast:save:v1',other=await page.evaluate(k=>localStorage.getItem(k),otherKey);
  await page.click('#construction-button');await page.click(`[data-construction="${f.quote.tileId}"]`);const text=await page.$eval('.construction-quote',e=>e.textContent);assert.ok(text.includes(`净值变化 ${f.quote.netWorthDelta>0?'+':f.quote.netWorthDelta<0?'−':''}¥${Math.abs(f.quote.netWorthDelta).toLocaleString('en-US')}`));assert.match(text,/上门费 ¥300/);assert.deepEqual(await snap(),before);
  await page.keyboard.press('Escape');assert.deepEqual(await snap(),before);
  await page.click('#construction-button');await page.click(`[data-construction="${f.quote.tileId}"]`);await page.screenshot({path:`qa/construction-${mapId==='shanhai-coast'?'desktop':'mobile'}.png`});await page.focus('#construction-confirm');await page.keyboard.press('Enter');await idle();const after=await snap();assert.equal(after.players[0].cash,before.players[0].cash-f.quote.cost);assert.equal(after.properties.find(([id])=>id===f.quote.tileId)[1].level,f.quote.nextLevel);assert.equal(after.players[0].currentTile,before.players[0].currentTile);assert.equal(after.slice.cardUsed,true);assert.equal(await page.evaluate(id=>window.shanhai.scene.propertyVisuals.find(p=>p.tileId===id).level,f.quote.tileId),f.quote.nextLevel);assert.equal(await page.$eval('#remote-button',e=>e.disabled),true);assert.match(await page.$eval('#route-state',e=>e.textContent),/策略机会已使用/);assert.match(await page.$eval('#tactic-result',e=>e.textContent),/异地施工/);
  await page.reload({waitUntil:'domcontentloaded'});await ready();await page.click('#resume-button');await idle();assert.equal((await snap()).players[0].cash,after.players[0].cash);await page.click('#construction-button');await page.click(`[data-construction="${f.quote.tileId}"]`);assert.equal(await page.$eval('#construction-confirm',e=>e.disabled),true);await page.click('.modal-close');
  await page.click('#roll-button');await idle();if(await page.$('.event-choice'))await page.click('.event-choice');const end=await page.$('#skip-button')||await page.$('#end-turn-button');assert.ok(end);await end.click();await idle();assert.match(await page.$eval('#tactic-result',e=>e.textContent),/AI.*异地施工/);assert.match(await page.$eval('#ai-recap',e=>e.textContent),/L\d → L\d/);assert.equal(await page.evaluate(k=>localStorage.getItem(k),otherKey),other);
  report.checks.push({mapId,seed:f.seed,round:8,tileId:f.quote.tileId,cost:f.quote.cost,netWorthDelta:f.quote.netWorthDelta,checks:'Production save of simulated midgame resumed; quote and Escape leave state intact; keyboard confirm charges once, updates building and blocks remote; reload preserves spent strategy slot; ordinary roll and real AI construction complete; other map save unchanged.'});
 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));await fs.writeFile('qa/construction-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
