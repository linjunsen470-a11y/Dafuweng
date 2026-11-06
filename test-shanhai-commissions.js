import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

// Focused production-page smoke: no legacy suite or full-match simulation.
const report={startedAt:new Date().toISOString(),checks:[],errors:[]};
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5183,strictPort:true}});
let browser;
try {
  browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.setViewport({width:1440,height:1000});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  const ready=()=>page.waitForFunction(()=>window.shanhai?.ready);
  const idle=()=>page.waitForFunction(()=>window.shanhai.active&&!window.shanhai.busy&&!window.shanhai.session.currentPlayer.isAI);
  const state=()=>page.evaluate(()=>window.shanhai.session.snapshot());
  const route=async steps=>{await page.click('#remote-button');await page.click(`[data-step="${steps}"]`);await idle();};
  await page.goto('http://127.0.0.1:5183/shanhai.html',{waitUntil:'domcontentloaded'});await ready();
  await page.click('#start-button');await idle();
  await page.click('#commission-open');
  assert.equal(await page.$$eval('[data-commission]',nodes=>nodes.length),2);
  assert.match(await page.$eval('.commission-offer.specialist',e=>e.textContent),/海风速递/);
  await page.screenshot({path:'qa/commissions-board.png'});
  await page.click('[data-commission="DELIVERY"]');
  const accepted=await state();assert.equal(accepted.slice.careers[0].active.targetId,3);
  assert.equal(await page.evaluate(()=>window.shanhai.scene.commissionMarker.visible),true);
  await page.screenshot({path:'qa/commissions-target.png'});
  await page.reload({waitUntil:'domcontentloaded'});await ready();await page.click('#resume-button');await idle();
  assert.deepEqual((await state()).slice.careers,accepted.slice.careers);
  report.checks.push('Accept delivery through UI; 3D target marker and pending order survive refresh.');
  await page.click('#remote-button');
  assert.match(await page.$eval('[data-step="3"]',e=>e.textContent),/委托目的地/);
  await page.click('[data-step="3"]');await idle();
  let after=await state();
  assert.equal(after.players[0].cash,accepted.players[0].cash+900);
  assert.equal(after.players[0].cardPoints,accepted.players[0].cardPoints+15);
  assert.equal(after.slice.careers[0].completed,1);
  assert.equal(await page.evaluate(()=>window.shanhai.scene.commissionMarker.visible),false);
  assert.equal(await page.$eval('#commission-open',e=>e.disabled),true);
  await page.reload({waitUntil:'domcontentloaded'});await ready();await page.click('#resume-button');await idle();
  assert.equal((await state()).players[0].cash,after.players[0].cash);
  report.checks.push('Courier earns exactly ¥900 + 15 points; completed save reload does not pay twice.');
  await page.click('#decision-button');await idle();await page.click('#end-turn-button');await idle();
  after=await state();assert.equal(after.slice.careers[1].completed,1);assert.equal(after.slice.careers[1].earned,700);
  report.checks.push('Botanist AI accepts and completes renewal using the same rules.');
  await page.click('#menu-button');await page.click('#confirm-menu');
  await page.click('[data-character="qinghe"]');await page.click('#start-button');await idle();
  await page.click('#commission-open');await page.click('[data-commission="RENEWAL"]');
  const before=await state();await route(1);const landed=await state();
  await page.click('#decision-button');await idle();after=await state();
  assert.equal(after.players[0].cash,before.players[0].cash-landed.slice.focus.cost+700);
  assert.equal(after.players[0].cardPoints,before.players[0].cardPoints+35);
  assert.match(await page.$eval('#commission-panel',e=>e.textContent),/委托已完成/);
  report.checks.push('Botanist human earns exactly ¥700 + 35 points after a real property purchase.');
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  // Chromium reloads when mobile emulation changes; resume the saved game.
  await ready();
  if(!await page.evaluate(()=>window.shanhai.active)){await page.click('#resume-button');await idle();}
  assert.match(await page.$eval('#commission-panel',e=>e.textContent),/委托已完成/);
  assert.equal(await page.$eval('#game-panel',e=>e.hidden),false);
  await page.$eval('#commission-panel',e=>e.scrollIntoView({block:'center'}));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'qa/commissions-mobile.png',fullPage:true});
  report.checks.push('Commission summary remains readable at 390 px without horizontal overflow.');
  assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.success=false;report.failure=error.stack;process.exitCode=1;}
finally{
  await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));
  report.finishedAt=new Date().toISOString();await fs.writeFile('qa/commissions-browser-report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
