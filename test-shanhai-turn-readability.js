import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {preview} from 'vite';
import {SliceSession} from './src/shanhai/SliceSession.js';
const baseline=process.argv.includes('--baseline'),presentationOnly=process.argv.includes('--presentation-only'),label=baseline?'baseline':presentationOnly?'layout':'updated';
const report={kind:presentationOnly?'Final-build one-round keyboard and sticky-layout verification':'Four-player three-round season through UI; turn and asset readability',turns:[],errors:[]};
const initial=new SliceSession({storage:null});initial.start({seed:314,playerCount:4,maxRounds:3});
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5216,strictPort:true}});let browser,page;
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage();page.setDefaultTimeout(60000);await page.setViewport({width:1100,height:800});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
 await page.evaluateOnNewDocument(s=>{Date.now=()=>314;if(!localStorage.getItem('shanhai-coast:save:v1'))localStorage.setItem('shanhai-coast:save:v1',JSON.stringify(s));localStorage.setItem('shanhai:ai-quick','true');localStorage.setItem('shanhai:audio',JSON.stringify({musicEnabled:false,sfxEnabled:false}));},initial.snapshot());
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://127.0.0.1:5216/shanhai.html');await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#resume-button');
 const idle=()=>page.waitForFunction(()=>!window.shanhai.busy&&(!window.shanhai.session.currentPlayer.isAI||window.shanhai.session.state.phase==='GAME_OVER'));
 const snap=()=>page.evaluate(()=>window.shanhai.session.snapshot());await idle();
 await page.evaluate(()=>{window.turnSamples=[];window.turnSampler=setInterval(()=>{const a=window.shanhai;if(a?.busy&&a.session.currentPlayer.isAI)window.turnSamples.push({id:a.session.currentPlayer.id,round:a.session.state.round,progress:document.getElementById('ai-turn-progress').textContent});},100);});
 for(let turn=1;turn<=(presentationOnly?1:3);turn++){
  await page.click('#roll-button');await idle();let s=await snap();
  if(s.slice.pendingEvent){await page.click('[data-event-choice]:not([disabled])');await idle();s=await snap();}
  if(['PURCHASE','UPGRADE'].includes(s.slice.focus.kind)&&s.players[0].cash-s.slice.focus.cost>=1800){const buy=await page.$('#decision-button:not([disabled])')||await page.$('[data-business-buy="MALL"]:not([disabled])');if(buy){await buy.click();await idle();}}
  const end=await page.$('#end-turn-button')||await page.$('#skip-button');assert.ok(end);const start=performance.now();await end.click();
  if(!baseline&&turn===1){await page.waitForFunction(()=>window.shanhai.busy&&document.querySelector('.ai-turn-recap summary'));await page.focus('.ai-turn-recap summary');await page.keyboard.press('Enter');assert.equal(await page.$eval('.ai-turn-recap',e=>e.open),true);}
  await idle();
  s=await snap();report.turns.push({turn,aiWaitMs:Math.round(performance.now()-start),phase:s.phase,recaps:await page.$$eval('.ai-turn-recap',e=>e.length)});console.log(label,'turn',turn,'finished');
  if(turn===1){
   if(!baseline){assert.equal(await page.$eval('.ai-turn-recap',e=>e.open),true,'expanded first recap survives later AI recaps');assert.ok(await page.evaluate(()=>document.activeElement.matches('.ai-turn-recap summary')),'keyboard focus survives new recap insertion');await page.focus('.ai-turn-recap summary');const beforeToggle=await snap();await page.keyboard.press('Space');assert.equal(await page.$eval('.ai-turn-recap',e=>e.open),false);assert.deepEqual((await snap()).players,beforeToggle.players);assert.equal((await snap()).phase,beforeToggle.phase);assert.match(await page.$eval('#ai-turn-progress',e=>e.textContent),/轮到你/);assert.match(await page.$eval('#players .current',e=>e.textContent),/阿屿.*当前/s);}

   const measure=()=>page.evaluate(()=>{const box=id=>document.getElementById(id).getBoundingClientRect();return {recapHeight:box('ai-recap').height,assetOffsetFromAction:box('players').top-box('action-card').bottom,assetHeight:box('players').height,overflow:document.documentElement.scrollWidth>innerWidth};});
   report.desktop=await measure();
   if(!baseline){assert.ok(report.desktop.recapHeight<350);assert.ok(report.desktop.assetOffsetFromAction<30);assert.equal(report.desktop.overflow,false);}
await page.$eval('#ai-recap',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`qa/turn-readability-${label}-desktop.png`});
   await page.setViewport({width:390,height:844});report.mobile=await measure();
   if(!baseline){assert.ok(report.mobile.recapHeight<350);assert.ok(report.mobile.assetOffsetFromAction<30);assert.equal(report.mobile.overflow,false);}
await page.$eval('#players',e=>e.scrollIntoView({block:'start'}));if(!baseline)assert.ok(await page.evaluate(()=>document.querySelector('#players .player-card').getBoundingClientRect().top>=document.getElementById('ai-turn-progress').getBoundingClientRect().bottom),'sticky status must not cover the first asset card after navigation');await page.screenshot({path:`qa/turn-readability-${label}-mobile.png`});if(!baseline){const visible=await page.$eval('#ai-turn-progress',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});assert.ok(visible,'turn status stays visible while inspecting mobile assets');}await page.setViewport({width:1100,height:800});
  }
 }
 report.final=await snap();if(!presentationOnly){assert.equal(report.final.phase,'GAME_OVER');assert.equal(await page.$$eval('.season-player',e=>e.length),4);}report.samples=await page.evaluate(()=>{clearInterval(window.turnSampler);return window.turnSamples;});
 if(!baseline&&!presentationOnly){const old=JSON.parse(await fs.readFile('qa/turn-readability-baseline-report.json','utf8'));for(const key of ['players','properties','winnerId','slice'])assert.deepEqual(report.final[key],old.final[key],key);assert.deepEqual(report.final.logHistory.map(({time,...e})=>e),old.final.logHistory.map(({time,...e})=>e));report.identicalRules=true;for(const id of [1,2,3])assert.ok(report.samples.some(s=>s.id===id&&s.progress.includes(`第${id}/3位AI`)),`visible progress for AI ${id}`);}
 if(!baseline&&!presentationOnly){
  report.auctions=[];
  const openFixture=async(s,width)=>{const ctx=await browser.createBrowserContext();page=await ctx.newPage();page.setDefaultTimeout(60000);await page.setViewport({width,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.evaluateOnNewDocument(snapshot=>{const key=snapshot.mapId+':save:v1';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(snapshot));localStorage.setItem('shanhai:ai-quick','true');localStorage.setItem('shanhai:audio',JSON.stringify({musicEnabled:false,sfxEnabled:false}));},s.snapshot());page.on('pageerror',e=>report.errors.push(String(e)));await page.goto(`http://127.0.0.1:5216/shanhai.html${s.mapId==='shanhai-highland'?'?map=highland':''}`);await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#resume-button');return ctx;};
  for(const mapId of ['shanhai-coast','shanhai-highland']){
   const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount:4,maxRounds:3});s.state.currentPlayerIndex=1;s.currentPlayer.cash=0;s.currentPlayer.currentTile=2;s.state.players[2].cash=0;Object.assign(s.state.propertyManager.getProperty(2),{owner:2,level:4});Object.assign(s.state.propertyManager.getProperty(3),{owner:1,level:0});s.state.phase='LANDING_ACTION';
   const ctx=await openFixture(s,mapId==='shanhai-highland'?390:1100);await page.waitForFunction(()=>!window.shanhai.busy&&window.shanhai.session.getAuctionView()?.bidder.id===0);assert.match(await page.$eval('#ai-turn-progress',e=>e.textContent),/阿屿（你）正在报价/);assert.match(await page.$eval('#players .current',e=>e.textContent),/阿屿.*报价/s);assert.equal(await page.$$eval('#players .current',e=>e.length),1);
   await page.click('#auction-pass');await page.waitForSelector('#auction-continue');await page.waitForFunction(()=>!window.shanhai.busy);const done=await snap(),sale=done.slice.auctionResults[0];assert.equal(sale.highestBidderId,3);assert.match(await page.$eval('#ai-turn-progress',e=>e.textContent),/竞拍已结算.*1块/);assert.equal(await page.$$eval('#players .current',e=>e.length),0);assert.match(await page.$eval('.auction-results',e=>e.textContent),/陶宁.*竞得/);
   await page.$eval('#action-card',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`qa/turn-readability-${mapId}-auction.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.reload();await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#resume-button');await page.waitForSelector('#auction-continue');assert.deepEqual((await snap()).players,done.players);assert.match(await page.$eval('#ai-turn-progress',e=>e.textContent),/竞拍已结算/);await page.click('#auction-continue');await idle();assert.equal((await snap()).currentPlayerIndex,0);report.auctions.push({mapId,receipt:'Correct bidder, fourth seat winner/price, receipt refresh without duplicate payment, continue with three survivors'});await ctx.close();
  }
  report.legacy=[];
  for(const count of [2,3]){const s=new SliceSession({storage:null,mapId:'shanhai-highland'});s.start({seed:314,playerCount:count});const ctx=await openFixture(s,390);await idle();assert.equal((await snap()).players.length,count);assert.match(await page.$eval('#ai-turn-progress',e=>e.textContent),/轮到你/);await page.click('#remote-button');await page.click('[data-step="1"]');await idle();await page.click('#decision-button');await idle();await page.click('#end-turn-button');await idle();assert.equal((await snap()).round,2);assert.equal(await page.$$eval('.ai-turn-recap',e=>e.length),count-1);report.legacy.push({count,continued:true});await ctx.close();}
 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));await fs.writeFile(`qa/turn-readability-${label}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,turns:report.turns,desktop:report.desktop,mobile:report.mobile,failure:report.failure},null,2));}
