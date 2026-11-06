import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {preview} from 'vite';
import {SliceSession} from './src/shanhai/SliceSession.js';
const mode=process.argv[2]||'quick';
const report={mode,scenario:'Three-round coast season from a legal initial save, all actions through UI, normal motion at 1x',turns:[],errors:[]};
const initial=new SliceSession({storage:null});initial.start({seed:314,playerCount:3,maxRounds:3});
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5213,strictPort:true}});let browser;
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();page.setDefaultTimeout(60000);await page.setViewport({width:1100,height:800});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
 await page.evaluateOnNewDocument(s=>{Date.now=()=>314;localStorage.setItem('shanhai-coast:save:v1',JSON.stringify(s));localStorage.setItem('shanhai:audio',JSON.stringify({musicEnabled:false,sfxEnabled:false}));},initial.snapshot());
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://127.0.0.1:5213/shanhai.html');await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#resume-button');
 const idle=()=>page.waitForFunction(()=>!window.shanhai.busy&&(!window.shanhai.session.currentPlayer.isAI||window.shanhai.session.state.phase==='GAME_OVER'));
 const snap=()=>page.evaluate(()=>window.shanhai.session.snapshot());await idle();
 await page.evaluate(()=>{window.paceSamples=[];window.paceSampler=setInterval(()=>{const app=window.shanhai;if(app?.busy&&app.session.currentPlayer.isAI)window.paceSamples.push({id:app.session.currentPlayer.id,round:app.session.state.round,action:document.getElementById('action-title').textContent,recapHidden:document.getElementById('ai-recap').hidden,progress:document.getElementById('ai-turn-progress')?.textContent||''});},100);});
 for(let turn=1;turn<=3;turn++){
  await page.click('#roll-button');await idle();let s=await snap();const record={round:s.round,tile:s.players[0].currentTile,kind:s.slice.focus.kind};
  if(s.slice.pendingEvent){await page.click('[data-event-choice]:not([disabled])');await idle();s=await snap();}
  if(['PURCHASE','UPGRADE'].includes(s.slice.focus.kind)&&s.players[0].cash-s.slice.focus.cost>=1800){const buy=await page.$('#decision-button:not([disabled])')||await page.$('[data-business-buy="MALL"]:not([disabled])');if(buy){await buy.click();await idle();}}
  const end=await page.$('#end-turn-button')||await page.$('#skip-button');assert.ok(end);const start=performance.now();await end.click();
  if(mode==='quick'&&turn===1){await page.waitForFunction(()=>window.shanhai.busy&&window.shanhai.session.currentPlayer.isAI);await page.click('#ai-pace-button');assert.equal(await page.$eval('#ai-pace-button',e=>e.getAttribute('aria-pressed')),'true');assert.match(await page.$eval('#ai-turn-progress',e=>e.textContent),/速览中/);}
  await idle();record.aiWaitMs=Math.round(performance.now()-start);s=await snap();record.nextPhase=s.phase;record.recapCount=await page.$$eval('.ai-turn-recap',e=>e.length);report.turns.push(record);console.log(mode,record);
 }
 const final=await snap();assert.equal(final.phase,'GAME_OVER');assert.equal(await page.$$eval('.season-player',e=>e.length),3);report.final=final;report.samples=await page.evaluate(()=>{clearInterval(window.paceSampler);return window.paceSamples;});
 if(mode==='quick'){const baseline=JSON.parse(await fs.readFile('qa/ai-pace-baseline-report.json','utf8'));for(const key of ['players','properties','winnerId'])assert.deepEqual(final[key],baseline.final[key],`${key} must not change with presentation speed`);for(const key of Object.keys(baseline.final.slice))assert.deepEqual(final.slice[key],baseline.final.slice[key]);assert.deepEqual(final.logHistory.map(({time,...event})=>event),baseline.final.logHistory.map(({time,...event})=>event),'ordered events excluding wall-clock timestamps');report.identicalRules=true;
  assert.ok(report.samples.some(s=>s.id===2&&!s.recapHidden&&/青禾已完成/.test(s.progress)),'first AI recap must be visible during second AI');
  assert.ok(report.turns.reduce((sum,t)=>sum+t.aiWaitMs,0)<baseline.turns.reduce((sum,t)=>sum+t.aiWaitMs,0)*.8,'quick viewing should materially reduce waiting');
  await page.screenshot({path:'qa/ai-pace-coast-final.png'});
  // Same preference on another map, using the untouched default two-player start.
  await page.setViewport({width:390,height:844});await page.goto('http://127.0.0.1:5213/shanhai.html?map=highland');await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#start-button');await idle();assert.equal((await snap()).players.length,2);assert.equal(await page.$eval('#ai-pace-button',e=>e.getAttribute('aria-pressed')),'true');assert.equal(await page.$eval('#speed-button',e=>e.textContent),'1× 节奏');
  await page.click('#remote-button');await page.click('[data-step="1"]');await idle();await page.click('#decision-button');await idle();await page.click('#end-turn-button');await idle();const mountain=await snap();assert.equal(mountain.round,2);assert.equal(await page.$$eval('.ai-turn-recap',e=>e.length),1);await page.reload();await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#resume-button');await idle();assert.deepEqual((await snap()).players,mountain.players);assert.deepEqual((await snap()).properties,mountain.properties);assert.equal(await page.$eval('#ai-pace-button',e=>e.getAttribute('aria-pressed')),'true');
  // Keyboard toggle and a fresh human turn retain the ordinary speed and gameplay.
  await page.focus('#ai-pace-button');await page.keyboard.press('Space');assert.equal(await page.$eval('#ai-pace-button',e=>e.getAttribute('aria-pressed')),'false');assert.equal(await page.$eval('#speed-button',e=>e.textContent),'1× 节奏');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.$eval('.round-header',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:'qa/ai-pace-highland-controls.png'});report.twoPlayerHighland='Default two-player game completes actual purchase and AI turn, refresh preserves state; quick preference spans maps and keyboard can disable it without changing 1x speed.';
  // Interactive bankruptcy auctions are covered by test-shanhai-auctions.js.

 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));await fs.writeFile(`qa/ai-pace-${mode}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({mode,success:report.success,turns:report.turns,failure:report.failure},null,2));}
