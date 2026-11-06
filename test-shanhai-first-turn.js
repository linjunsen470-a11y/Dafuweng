import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {preview} from 'vite';
const baseline=process.argv.includes('--baseline'),report={mode:baseline?'baseline':'guide',checks:[],errors:[]};let browser,page;
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5231,strictPort:true}});
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const click=async selector=>{await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.click(selector);};
 const idle=()=>page.waitForFunction(()=>shanhai.active&&!shanhai.busy&&!shanhai.session.currentPlayer.isAI);
 const state=()=>page.evaluate(()=>{const s=shanhai.session.snapshot();delete s.savedAt;return s;});
 for(const map of ['coast','highland']){
  const ctx=await browser.createBrowserContext();page=await ctx.newPage();page.setDefaultTimeout(60000);await page.setViewport({width:map==='coast'?1100:390,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluateOnNewDocument(()=>{Date.now=()=>314;localStorage.setItem('shanhai:audio',JSON.stringify({musicEnabled:false,sfxEnabled:false}));localStorage.setItem('shanhai:ai-quick','true');});
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`http://127.0.0.1:5231/shanhai.html?map=${map}`);await page.waitForFunction(()=>window.shanhai?.ready);assert.equal(await page.$eval('#resume-button',e=>e.hidden),true);await page.select('#player-count','4');await click('#start-button');await idle();const started=await state();
  await page.$eval('.journey-guide',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`qa/first-turn-${report.mode}-${map}-start.png`});
  if(!baseline){
   assert.equal(await page.$eval('#turn-guide-body',e=>e.hidden),false);assert.equal(await page.$eval('#turn-guide-body',e=>e.dataset.step),'move');
   await page.focus('#turn-guide-toggle');await page.keyboard.press('Enter');assert.equal(await page.$eval('#turn-guide-body',e=>e.hidden),true);assert.deepEqual(await state(),started);
   await page.keyboard.press('Enter');assert.equal(await page.$eval('#turn-guide-body',e=>e.hidden),false);assert.deepEqual(await state(),started);
  }
  // Inspect a real board lot; no seeded save or direct gameplay mutation.
  await click('#view-clear');await page.$eval('.world-panel',e=>e.scrollIntoView({block:'start'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const point=await page.evaluate(()=>{const s=shanhai.scene,p=s.selection.position.clone();Object.assign(p,{x:s.tiles[13].position.x,y:.25,z:s.tiles[13].position.z});p.project(s.camera);const r=s.renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x*.5+.5)*r.width,y:r.top+(-p.y*.5+.5)*r.height};});
  await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>document.getElementById('info-dialog').open);assert.deepEqual(await state(),started);assert.equal(await page.$('#decision-button'),null);await page.keyboard.press('Escape');
  await click('#roll-button');await idle();const landed=await state(),focus=landed.slice.focus;
  if(!baseline){assert.equal(await page.$eval('#turn-guide-body',e=>e.dataset.step),['PURCHASE','UPGRADE','ISLAND_EVENT'].includes(focus.kind)?'decide':'finish');assert.equal(await page.$eval('#turn-guide-next',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true,'updated guide stays visible after landing');}
  if(await page.$('[data-event-choice]'))await click('[data-event-choice]');else if(await page.$('#decision-button'))await click('#decision-button');
  await idle();const decided=await state();if(!baseline)assert.equal(await page.$eval('#turn-guide-body',e=>e.dataset.step),'finish');
  await page.$eval('.journey-guide',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`qa/first-turn-${report.mode}-${map}-finish.png`});
  if(!baseline)await page.evaluate(()=>{window.guideSteps=[];new MutationObserver(()=>guideSteps.push(document.getElementById('turn-guide-body').dataset.step)).observe(document.getElementById('turn-guide-body'),{attributes:true,attributeFilter:['data-step']});});await click('#end-turn-button');await idle();if(!baseline)assert.equal(await page.evaluate(()=>guideSteps.includes('wait')),true);const ended=await state();assert.equal(ended.currentPlayerIndex,0);assert.equal(ended.round,2);assert.equal(ended.players.length,4);
  if(!baseline){
   assert.equal(await page.$eval('#turn-guide-body',e=>e.dataset.step),'move');await click('#turn-guide-toggle');assert.equal(await page.$eval('#turn-guide-body',e=>e.hidden),true);
   await page.reload();await page.waitForFunction(()=>window.shanhai?.ready);await click('#resume-button');await idle();assert.equal(await page.$eval('#turn-guide-body',e=>e.hidden),true);assert.deepEqual((await state()).players,ended.players);assert.deepEqual((await state()).properties,ended.properties);
   await click('#turn-guide-toggle');assert.equal(await page.$eval('#turn-guide-body',e=>e.hidden),false);assert.equal(await page.evaluate(()=>document.querySelector('#info-dialog').open),false);
   const baselineReport=JSON.parse(await fs.readFile('qa/first-turn-baseline-report.json','utf8')).checks.find(c=>c.map===map);
   assert.deepEqual(ended.players,baselineReport.players);assert.deepEqual(ended.properties,baselineReport.properties);assert.equal(ended.rngState,baselineReport.rng);
   // A pre-existing save without any guide preference should resume quietly.
   await page.evaluate(()=>localStorage.removeItem('shanhai:turn-guide'));await page.reload();await page.waitForFunction(()=>window.shanhai?.ready);await click('#resume-button');await idle();assert.equal(await page.$eval('#turn-guide-body',e=>e.hidden),true);assert.deepEqual((await state()).players,ended.players);
   await click('#turn-guide-toggle');assert.equal(await page.$eval('#turn-guide-body',e=>e.hidden),false);
   // Only preference writes fail; the guide remains usable without changing saves.
   await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='shanhai:turn-guide')throw new DOMException('Blocked preference','SecurityError');return original.call(this,key,value);};});
   const stable=await state();await click('#turn-guide-toggle');assert.equal(await page.$eval('#turn-guide-body',e=>e.hidden),true);await click('#turn-guide-toggle');assert.equal(await page.$eval('#turn-guide-body',e=>e.hidden),false);assert.deepEqual(await state(),stable);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  report.checks.push({map,firstTile:landed.players[0].currentTile,focus:focus.kind,afterDecision:decided.slice.focus.kind,afterFirstRound:ended.round,startGuide:await page.$eval('.journey-guide',e=>e.textContent),boardInspectionDoesNotBuy:true,cashBeforeDecision:landed.players[0].cash,cashAfterDecision:decided.players[0].cash,players:ended.players,properties:ended.properties,rng:ended.rngState});await ctx.close();console.log('Checked',map);
 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;if(page&&!page.isClosed()){report.page=await page.evaluate(()=>({phase:window.shanhai?.session.state.phase,action:document.getElementById('action-card')?.textContent})).catch(()=>null);await page.screenshot({path:`qa/first-turn-${report.mode}-failure.png`}).catch(()=>{});}}
finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));await fs.writeFile(`qa/first-turn-${report.mode}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,checks:report.checks.length,failure:report.failure},null,2));}
