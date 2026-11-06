import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {preview} from 'vite';
import {SliceSession} from './src/shanhai/SliceSession.js';

const report={checks:[],errors:[]};
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5229,strictPort:true}});
let browser,page;
function fixture(map,ai=false){
 const s=new SliceSession({storage:null,mapId:`shanhai-${map}`});
 s.start({seed:314,playerCount:4});s.state.round=2;
 s.state.currentPlayerIndex=ai?3:0;s.currentPlayer.currentTile=ai?22:16;
 s.state.phase=ai?'LANDING_ACTION':'PRE_ROLL_ACTION';
 return s.snapshot();
}
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const open=async(map,saved)=>{
  const context=await browser.createBrowserContext();page=await context.newPage();page.setDefaultTimeout(60000);
  await page.setViewport({width:map==='coast'?1100:390,height:844});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluateOnNewDocument(({map,saved})=>{
   if(!localStorage.getItem(`shanhai-${map}:save:v1`))localStorage.setItem(`shanhai-${map}:save:v1`,JSON.stringify(saved));
   localStorage.setItem('shanhai:audio',JSON.stringify({musicEnabled:false,sfxEnabled:false}));localStorage.setItem('shanhai:ai-quick','true');
  },{map,saved});
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`http://127.0.0.1:5229/shanhai.html?map=${map}`);await page.waitForFunction(()=>window.shanhai?.ready);
  return context;
 };
 const idle=()=>page.waitForFunction(()=>shanhai.active&&!shanhai.busy&&!shanhai.session.currentPlayer.isAI);
 const snap=()=>page.evaluate(()=>shanhai.session.snapshot());
 const click=async selector=>{await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.click(selector);};
 const reload=async()=>{await page.reload();await page.waitForFunction(()=>window.shanhai?.ready);await click('#resume-button');await idle();};
 for(const map of ['coast','highland']){
  const title=map==='coast'?'林间拓印试展':'雨后晒场抢晴',choice=map==='coast'?'exhibit':'sun';
  let context=await open(map,fixture(map));await click('#resume-button');await idle();
  await click('#current-region');assert.match(await page.$eval('#modal-content',e=>e.textContent),/双数轮/);assert.ok((await page.$eval('#modal-content',e=>e.textContent)).includes(title));await click('.modal-close');
  await click('#remote-button');assert.ok((await page.$eval('[data-step="6"]',e=>e.textContent)).includes(title));
  await click('[data-step="6"]');await idle();let pending=await snap();
  assert.equal(pending.players[0].currentTile,22);assert.equal(pending.slice.focus.title,title);assert.equal(await page.$$eval('[data-event-choice]',es=>es.length),3);
  assert.match(await page.$eval(`[data-event-choice="${choice}"]`,e=>e.textContent),map==='coast'?/70%.*退回15点券/s:/60%.*净损失 ¥250/s);
  assert.equal(await page.$('#end-turn-button'),null);await reload();assert.deepEqual((await snap()).slice.pendingEvent,pending.slice.pendingEvent);assert.equal((await snap()).rngState,pending.rngState);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.$eval('#action-card',e=>e.scrollIntoView({block:'start'}));await (await page.$('#action-card')).screenshot({path:`qa/seasonal-events-${map}-choices.png`});
  const expected=new SliceSession({mapId:`shanhai-${map}`,storage:null});assert.ok(expected.restore(pending).success);const result=expected.chooseIslandEvent(choice);
  // Use keyboard activation in the mobile-sized page as well as desktop clicking.
  if(map==='highland'){await page.focus(`[data-event-choice="${choice}"]`);await page.keyboard.press('Enter');}else await click(`[data-event-choice="${choice}"]`);
  await idle();let done=await snap();assert.deepEqual(done.players,expected.snapshot().players);assert.equal(done.slice.focus.result.won,result.won);
  assert.equal(done.slice.pendingEvent,null);assert.ok((await page.$eval('#action-card',e=>e.textContent)).includes(done.slice.focus.description));
  await (await page.$('#action-card')).screenshot({path:`qa/seasonal-events-${map}-result.png`});
  await reload();assert.deepEqual((await snap()).players,done.players);assert.equal((await snap()).rngState,done.rngState);assert.equal(await page.$$eval('[data-event-choice]',es=>es.length),0);
  await click('#end-turn-button');await idle();const rotated=await snap();assert.equal(rotated.currentPlayerIndex,0);assert.equal(rotated.round,3);assert.equal(rotated.players.length,4);
  report.checks.push({map,kind:'human route and event',title,choice,won:result.won,cashDelta:result.cashDelta,pointsDelta:result.pointsDelta,pendingAndSettledReload:true,fourSeatRound:true,keyboard:map==='highland'});
  await context.close();
  const saved=fixture(map,true),reference=new SliceSession({mapId:`shanhai-${map}`,storage:null});reference.restore(saved);await reference.playAITurn();
  context=await open(map,saved);await click('#resume-button');await idle();done=await snap();
  assert.equal(done.currentPlayerIndex,0);assert.equal(done.round,3);assert.deepEqual(done.players,reference.snapshot().players);assert.equal(done.rngState,reference.snapshot().rngState);
  assert.ok(JSON.stringify(done.logHistory).includes(title));
  const aiEvent=done.logHistory.find(l=>JSON.stringify(l).includes(title));report.checks.push({map,kind:'fourth AI event',sameRulesAndRng:true,log:aiEvent});
  await context.close();console.log('Checked',map);
 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;if(page&&!page.isClosed()){report.page=await page.evaluate(()=>({phase:window.shanhai?.session.state.phase,round:window.shanhai?.session.state.round,busy:window.shanhai?.busy,action:document.getElementById('action-card')?.textContent})).catch(()=>null);await page.screenshot({path:'qa/seasonal-events-failure.png'}).catch(()=>{});}}
finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));await fs.writeFile('qa/seasonal-events-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
