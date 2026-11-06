import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const report={startedAt:new Date().toISOString(),checks:[],errors:[]};
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5185,strictPort:true}});
let browser;
try{
  browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.setViewport({width:1440,height:1000});
  const ready=()=>page.waitForFunction(()=>window.shanhai?.ready);
  const idle=()=>page.waitForFunction(()=>window.shanhai.active&&!window.shanhai.busy&&!window.shanhai.session.currentPlayer.isAI);
  const state=()=>page.evaluate(()=>window.shanhai.session.snapshot());
  const reload=async()=>{await page.reload({waitUntil:'domcontentloaded'});await ready();await page.click('#resume-button');await idle();};
  const remote=async steps=>{await page.click('#remote-button');await page.click(`[data-step="${steps}"]`);await idle();};
  await page.goto('http://127.0.0.1:5185/shanhai.html',{waitUntil:'domcontentloaded'});await ready();
  // Fix only the seed. Cash, travel and rewards come exclusively from UI actions.
  await page.evaluate(()=>{window.__originalNow=Date.now;Date.now=()=>314;});await page.click('#start-button');await idle();await page.evaluate(()=>{Date.now=window.__originalNow;});
  await page.click('#commission-open');await page.click('[data-commission="RENEWAL"]');
  const before=await state();await page.click('#transport-open');
  assert.match(await page.$eval('[data-transport="ferry"]',e=>e.textContent),/650.*保证.*15,350.*13,750/s);
  assert.match(await page.$eval('[data-transport="skiff"]',e=>e.textContent),/250.*75%.*25%.*4号/s);
  assert.equal(await page.$$eval('.transport-label',nodes=>nodes.length),3);
  assert.equal(await page.evaluate(()=>Boolean(window.shanhai.scene.transportLine)),true);
  await page.screenshot({path:'qa/transport-desktop.png'});
  await page.click('#transport-cancel');assert.equal((await state()).rngState,before.rngState);assert.equal((await state()).players[0].cash,before.players[0].cash);
  report.checks.push('Three visible transport signs, sea route preview, both fares/odds and post-purchase balances; cancelling costs no money or RNG.');
  await page.click('#transport-open');await page.click('[data-transport="ferry"]');
  // Interrupt a real animated journey after its atomic outcome is saved.
  await page.waitForFunction(()=>window.shanhai.session.lastTransport&&!window.shanhai.session.landingResolved);
  const inTransit=await state();assert.equal(inTransit.players[0].currentTile,9);assert.equal(inTransit.players[0].cash,before.players[0].cash-650);
  await reload();const landed=await state();assert.equal(landed.slice.focus.kind,'PURCHASE');assert.equal(landed.players[0].cash,inTransit.players[0].cash);
  assert.deepEqual(landed.players[0].cards,before.players[0].cards);assert.equal(await page.$('#roll-button'),null);
  assert.match(await page.$eval('#transport-feedback',e=>e.textContent),/定班渡轮.*650.*灯塔别院/s);
  await page.click('#decision-button');await idle();assert.equal((await state()).slice.careers[0].completed,1);
  assert.equal((await state()).players[0].cash,before.players[0].cash-650-1600+400);
  report.checks.push('Reload during ferry animation resumes tile 9 without duplicate fare, preserves card, resolves property and renewal reward normally.');
  await page.click('#end-turn-button');await idle();await remote(6);await page.click('#skip-button');await idle();
  await page.click('#supply-button');await remote(1);assert.equal((await state()).players[0].currentTile,16);
  await page.click('[data-event-choice="volunteer"]');await page.click('#end-turn-button');await idle();
  // Resize without changing device emulation, keeping this same live session.
  await page.setViewport({width:390,height:844});await page.click('#transport-open');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.match(await page.$eval('[data-transport="skiff"]',e=>e.textContent),/22号/);
  await page.screenshot({path:'qa/transport-mobile.png'});
  const garden=await state();await page.click('[data-transport="skiff"]');await idle();let after=await state();
  const diverted=after.slice.lastTransport.diverted;
  assert.equal(after.players[0].currentTile,diverted?22:3);
  const rentPaid=after.players[1].cash-garden.players[1].cash;
  assert.equal(rentPaid>=0,true);assert.equal(after.players[0].cash,garden.players[0].cash-250-rentPaid);
  if(rentPaid)assert.equal(after.slice.focus.kind,'RENT');
  assert.equal(after.slice.lastTransport.fare,250);assert.equal(after.slice.pendingEvent?.tileId??null,diverted?22:null);
  if(diverted){await page.click('[data-event-choice="sell"]');await idle();}
  const settled=await state();await reload();after=await state();assert.equal(after.players[0].cash,settled.players[0].cash);assert.equal(after.rngState,settled.rngState);
  report.checks.push(`390px ticket selection and garden skiff arrival at tile ${after.players[0].currentTile}; exactly ¥250 fare plus ¥${rentPaid} ordinary landing rent, no skipped-start bonus, no reroll on refresh.`);
  assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.success=false;report.failure=error.stack;process.exitCode=1;}
finally{
  await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));report.finishedAt=new Date().toISOString();
  await fs.writeFile('qa/transport-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
