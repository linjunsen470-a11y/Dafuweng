import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {preview} from 'vite';
import {SliceSession} from './src/shanhai/SliceSession.js';
const report={checks:[],errors:[]};let browser,page;
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5230,strictPort:true}});
function fixture(map,round=8){
 const s=new SliceSession({mapId:`shanhai-${map}`,storage:null});s.start({seed:314,playerCount:4});s.state.round=round;s.currentPlayer.cash=2700;
 const pm=s.state.propertyManager;for(const id of [1,11,13])pm.buyProperty(id,0);pm.buyProperty(12,0,'PARK');pm.buyProperty(5,1);pm.getProperty(5).level=4;
 return s.snapshot();
}
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const open=async(map,round=8)=>{
  const context=await browser.createBrowserContext();page=await context.newPage();page.setDefaultTimeout(60000);
  await page.setViewport({width:map==='coast'?1100:390,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluateOnNewDocument(({map,saved})=>{if(!localStorage.getItem(`shanhai-${map}:save:v1`))localStorage.setItem(`shanhai-${map}:save:v1`,JSON.stringify(saved));localStorage.setItem('shanhai:audio',JSON.stringify({musicEnabled:false,sfxEnabled:false}));localStorage.setItem('shanhai:ai-quick','true');},{map,saved:fixture(map,round)});
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`http://127.0.0.1:5230/shanhai.html?map=${map}`);await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#resume-button');await idle();return context;
 };
 const idle=()=>page.waitForFunction(()=>shanhai.active&&!shanhai.busy&&!shanhai.session.currentPlayer.isAI);
 const snap=()=>page.evaluate(()=>{const s=shanhai.session.snapshot();delete s.savedAt;return s;});
 const click=async selector=>{await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.click(selector);};
 const manage=async id=>{await click('#construction-button');await click(`[data-construction="${id}"]`);};
 const quote=id=>page.evaluate(id=>shanhai.session.getPropertyFinance(id),id);
 const reload=async()=>{await page.reload();await page.waitForFunction(()=>window.shanhai?.ready);await click('#resume-button');await idle();};
 for(const map of ['coast','highland']){
  const context=await open(map),before=await snap();await manage(1);const q=await quote(1);
  assert.equal(q.threat.tileId,5);assert.equal(await page.$$eval('.property-cash-plan tbody tr',e=>e.length),3);assert.match(await page.$eval('.property-cash-plan',e=>e.textContent),/保持现状.*抵押.*异地升级/s);
  assert.deepEqual(await snap(),before);await page.keyboard.press('Escape');assert.deepEqual(await snap(),before);await manage(1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.$eval('.modal-panel',e=>e.scrollTop=0).catch(()=>{});
  await page.screenshot({path:`qa/property-finance-${map}-comparison.png`});
  // Keyboard confirms the existing reviewed quote; no synthetic gameplay mutation.
  await page.focus('#finance-confirm');await page.keyboard.press('Enter');await page.waitForSelector('#finance-receipt');
  let done=await snap();assert.equal(done.players[0].cash,q.cashAfter);assert.equal(done.properties.find(([id])=>id===1)[1].isMortgaged,true);assert.equal(done.slice.cardUsed,false);assert.equal(done.rngState,before.rngState);
  assert.equal(await page.$('#finance-confirm'),null);await page.keyboard.press('Enter');assert.equal((await snap()).players[0].cash,done.players[0].cash);
  await reload();assert.deepEqual((await snap()).players,done.players);assert.deepEqual((await snap()).properties,done.properties);
  await manage(1);const redeem=await quote(1);await click('#finance-confirm');await page.waitForSelector('#finance-receipt');assert.equal((await snap()).players[0].cash,redeem.cashAfter);await page.keyboard.press('Escape');
  // Garden collateral must show and then apply the same neighboring rent reduction.
  await manage(12);const park=await quote(12);assert.equal(park.affected.length,2);await click('.finance-affected summary');assert.match(await page.$eval('.finance-affected',e=>e.textContent),/11号.*13号/s);
  await page.screenshot({path:`qa/property-finance-${map}-garden.png`});await click('#finance-confirm');await page.waitForSelector('#finance-receipt');
  for(const row of park.affected)assert.equal(await page.evaluate(id=>{const s=shanhai.session;return s.state.propertyManager.calculateToll(id,s.state.newsEffect,s.state.priceIndex);},row.tileId),row.after);
  await click('#finance-return');const parkBack=await quote(12);await click('#finance-confirm');await page.waitForSelector('#finance-receipt');assert.equal((await snap()).players[0].cash,parkBack.cashAfter);await page.keyboard.press('Escape');
  await manage(1);const build=await page.evaluate(()=>shanhai.session.getConstructionOptions().find(o=>o.tileId===1));await click('#construction-confirm');await idle();done=await snap();
  assert.equal(done.players[0].cash,build.cashAfter);assert.equal(done.properties.find(([id])=>id===1)[1].level,1);assert.equal(done.slice.cardUsed,true);assert.equal(await page.$eval('#remote-button',e=>e.disabled),true);
  await manage(1);assert.match(await page.$eval('.finance-blocked',e=>e.textContent),/有建筑不能直接抵押/);assert.equal(await page.$eval('#finance-confirm',e=>e.disabled),true);await page.keyboard.press('Escape');await reload();assert.deepEqual((await snap()).properties,done.properties);assert.equal((await snap()).players[0].cash,done.players[0].cash);
  await click('#roll-button');await idle();if(await page.$('[data-event-choice]'))await click('[data-event-choice]');const ending=await page.$('#skip-button')?'#skip-button':'#end-turn-button';await click(ending);await idle();assert.equal((await snap()).currentPlayerIndex,0);assert.equal((await snap()).round,9);
  report.checks.push({map,kind:'four-seat finance and construction',principal:q.principal,redeemFee:redeem.fee,threat:q.threat,neighborCount:park.affected.length,upgradeCost:build.cost,previewAndCancelReadOnly:true,keyboardReceiptAndReload:true,gardenMatchesEngine:true,fullRound:true});await context.close();
 }
 const context=await open('coast',2);await manage(1);assert.equal(await page.$eval('#finance-confirm',e=>e.disabled),false);assert.equal(await page.$eval('#construction-confirm',e=>e.disabled),true);assert.match(await page.$eval('.construction-quote',e=>e.textContent),/第 8 轮开放/);report.checks.push({kind:'early game',mortgageAvailableBeforeConstruction:true});await context.close();
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;if(page&&!page.isClosed()){report.page=await page.evaluate(()=>({phase:window.shanhai?.session.state.phase,busy:window.shanhai?.busy,modal:document.getElementById('modal-content')?.textContent,action:document.getElementById('action-card')?.textContent})).catch(()=>null);await page.screenshot({path:'qa/property-finance-failure.png'}).catch(()=>{});}}
finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));await fs.writeFile('qa/property-finance-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
