import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const report={startedAt:new Date().toISOString(),checks:[],errors:[]};
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5184,strictPort:true}});
let browser;
try{
  browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.setViewport({width:1440,height:1000});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  const ready=()=>page.waitForFunction(()=>window.shanhai?.ready);
  const idle=()=>page.waitForFunction(()=>window.shanhai.active&&!window.shanhai.busy&&!window.shanhai.session.currentPlayer.isAI);
  const state=()=>page.evaluate(()=>window.shanhai.session.snapshot());
  const reload=async()=>{await page.reload({waitUntil:'domcontentloaded'});await ready();await page.click('#resume-button');await idle();};
  const route=async steps=>{await page.click('#remote-button');await page.click(`[data-step="${steps}"]`);await idle();};
  await page.goto('http://127.0.0.1:5184/shanhai.html',{waitUntil:'domcontentloaded'});await ready();
  await page.click('#region-button');assert.equal(await page.$$eval('.region-guide article',nodes=>nodes.length),3);await page.click('.modal-close');
  // Fix only the initial seed; every game action still uses the visible UI.
  await page.evaluate(()=>{window.__originalNow=Date.now;Date.now=()=>314;});await page.click('#start-button');await idle();await page.evaluate(()=>{Date.now=window.__originalNow;});
  await page.click('#commission-open');await page.click('[data-commission="DELIVERY"]');
  await page.click('#remote-button');assert.match(await page.$eval('[data-step="4"]',e=>e.textContent),/晨光港口.*海雾中的船期/);await page.click('[data-step="4"]');await idle();
  assert.equal(await page.$$eval('[data-event-choice]',nodes=>nodes.length),3);
  assert.equal(await page.$('#end-turn-button'),null);
  assert.match(await page.$eval('[data-event-choice="sail"]',e=>e.textContent),/60%.*40%/s);
  const pending=await state();await reload();const resumed=await state();
  assert.deepEqual(resumed.slice.pendingEvent,pending.slice.pendingEvent);assert.equal(resumed.rngState,pending.rngState);
  await page.screenshot({path:'qa/events-harbor.png'});
  report.checks.push('Three-region guide, route preview and three visible harbor choices; pending event survives refresh without RNG changes.');
  await page.click('[data-event-choice="sail"]');await idle();let after=await state();
  const delta=after.slice.focus.result.won?800:-400;
  assert.equal(after.players[0].cash,pending.players[0].cash+delta);assert.equal(after.slice.pendingEvent,null);
  await reload();assert.equal((await state()).players[0].cash,after.players[0].cash);
  report.checks.push(`Harbor risk charged exactly once, net cash ${delta}; settled reload does not repay or reroll.`);
  await page.click('#end-turn-button');await idle();await page.click('#supply-button');await route(6);
  assert.equal((await state()).players[0].currentTile,10);
  assert.match(await page.$eval('#current-region',e=>e.textContent),/灯塔商街/);
  const market=await state();await page.click('[data-event-choice="help"]');await idle();
  assert.equal((await state()).players[0].cardPoints,market.players[0].cardPoints+20);
  report.checks.push('Travel to lighthouse market and receive its guaranteed 20-point option through UI.');
  await page.click('#end-turn-button');await idle();await page.click('#supply-button');await route(6);
  assert.equal((await state()).players[0].currentTile,16);
  assert.match(await page.$eval('#current-region',e=>e.textContent),/林间艺坊/);
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await ready();
  if(!await page.evaluate(()=>window.shanhai.active)){await page.click('#resume-button');await idle();}
  assert.equal(await page.$$eval('[data-event-choice]',nodes=>nodes.length),3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>window.shanhai.scene.renderVisible&&window.shanhai.scene.renderer.info.render.frame>3);
  await page.screenshot({path:'qa/events-garden-mobile.png',fullPage:true});
  const garden=await state();assert.equal(garden.slice.careers[0].active.dueRound,3);
  await page.click('[data-event-choice="extend"]');await idle();after=await state();
  assert.equal(after.players[0].cardPoints,garden.players[0].cardPoints-20);assert.equal(after.slice.careers[0].active.dueRound,4);
  await reload();assert.equal((await state()).slice.careers[0].active.dueRound,4);
  report.checks.push('Garden choice works at 390 px: pay 20 points to extend the active commission from round 3 to 4, preserved on refresh.');
  assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.success=false;report.failure=error.stack;process.exitCode=1;}
finally{
  await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));report.finishedAt=new Date().toISOString();
  await fs.writeFile('qa/events-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
