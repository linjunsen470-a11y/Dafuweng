import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {preview} from 'vite';
import {SliceSession} from './src/shanhai/SliceSession.js';
const baseline=process.argv.includes('--baseline'),report={checks:[],errors:[]};
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5217,strictPort:true}});let browser;
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const mapId of baseline?['shanhai-coast']:['shanhai-coast','shanhai-highland']){
  const park=mapId==='shanhai-highland',lot=park?12:3,s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount:4});s.state.currentPlayerIndex=1;s.currentPlayer.cash=0;s.currentPlayer.currentTile=17;
  Object.assign(s.state.propertyManager.getProperty(17),{owner:2,level:4});Object.assign(s.state.propertyManager.getProperty(lot),{owner:1,level:0,buildingType:park?'PARK':'RESIDENTIAL'});
  for(const id of park?[11,13]:[1,2,5,6,7])s.state.propertyManager.getProperty(id).owner=0;
  s.state.phase='LANDING_ACTION';s.resolveLanding();assert.equal(s.state.phase,'AUCTION');assert.equal(s.getAuctionView().bidder.id,0);
  const ctx=await browser.createBrowserContext(),page=await ctx.newPage();page.setDefaultTimeout(60000);await page.setViewport({width:park?390:1100,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.evaluateOnNewDocument(snapshot=>{const key=snapshot.mapId+':save:v1';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(snapshot));localStorage.setItem('shanhai:ai-quick','true');localStorage.setItem('shanhai:audio',JSON.stringify({musicEnabled:false,sfxEnabled:false}));},s.snapshot());page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`http://127.0.0.1:5217/shanhai.html${park?'?map=highland':''}`);await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#resume-button');await page.waitForSelector('#auction-amount:not([disabled])');
  if(baseline){report.observation=await page.$eval('#action-card',e=>e.textContent);assert.ok(!report.observation.includes('参考租金'));await page.$eval('#action-card',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:'qa/auction-preview-before.png'});await ctx.close();continue;}
  const quote=await page.$eval('#auction-property-preview',e=>({rent:Number(e.dataset.rent),text:e.textContent}));assert.equal(quote.rent===0,park);assert.match(quote.text,/不是每轮收入/);assert.match(quote.text,park?/邻里花园/:/普通住宅/);await page.click('#auction-property-preview summary');assert.equal(await page.$$eval('[data-auction-neighbor]',e=>e.length),park?2:5);
  const neighbors=await page.$$eval('[data-auction-neighbor]',rows=>rows.map(e=>({id:Number(e.dataset.auctionNeighbor),before:Number(e.dataset.before),after:Number(e.dataset.after)})));assert.ok(neighbors.every(n=>n.after>n.before));
  const before=await page.evaluate(()=>window.shanhai.session.snapshot());
  const fill=async value=>page.$eval('#auction-amount',(e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await fill(450);assert.equal(await page.$eval('#auction-bid',e=>e.disabled),true);assert.deepEqual(await page.evaluate(()=>window.shanhai.session.snapshot().players),before.players);await fill(4000);assert.match(await page.$eval('#auction-balance',e=>e.textContent),/12,000/);
  await page.$eval('#auction-property-preview',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`qa/auction-preview-${mapId}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.reload();await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#resume-button');await page.waitForSelector('#auction-amount:not([disabled])');assert.equal(await page.$eval('#auction-property-preview',e=>Number(e.dataset.rent)),quote.rent);assert.deepEqual(await page.evaluate(()=>window.shanhai.session.snapshot().players),before.players);await fill(4000);await page.click('#auction-bid');await page.waitForSelector('#auction-continue');await page.waitForFunction(()=>!window.shanhai.busy);
  const actual=await page.evaluate(({lot,neighbors})=>{const s=window.shanhai.session;return {owner:s.state.propertyManager.getProperty(lot).owner,cash:s.state.players[0].cash,rent:s.state.propertyManager.calculateToll(lot,s.state.newsEffect,s.state.priceIndex),neighbors:neighbors.map(n=>s.state.propertyManager.calculateToll(n.id,s.state.newsEffect,s.state.priceIndex)),sale:s.auctionResults[0]};},{lot,neighbors});assert.equal(actual.owner,0);assert.equal(actual.cash,12000);assert.equal(actual.rent,quote.rent);assert.deepEqual(actual.neighbors,neighbors.map(n=>n.after));assert.equal(actual.sale.highestBid,4000);report.checks.push({mapId,lot,rent:quote.rent,neighbors,actual,previewAndSaleMatch:true});await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));await fs.writeFile(`qa/auction-preview-${baseline?'baseline':'browser'}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
