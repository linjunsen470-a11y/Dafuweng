import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
const baseline=process.argv.includes('--baseline');
const report={kind:baseline?'f20a444 baseline':'regional residences and ambient life',checks:[],errors:[]};
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5187,strictPort:true}});
let browser;
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.setViewport({width:1600,height:1100});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 let oldSave;
 if(!baseline){oldSave=JSON.parse(await fs.readFile('qa/residences-old-save.json','utf8'));await page.evaluateOnNewDocument(save=>localStorage.setItem('shanhai-coast:save:v1',JSON.stringify(save)),oldSave);}
 await page.goto('http://127.0.0.1:5187/shanhai.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.shanhai?.ready);
 await page.click(baseline?'#start-button':'#resume-button');await page.waitForFunction(()=>window.shanhai.active&&!window.shanhai.busy);
 if(baseline){
  await page.click('#remote-button');await page.click('[data-step="1"]');await page.waitForFunction(()=>!window.shanhai.busy);
  await page.click('#decision-button');await page.waitForFunction(()=>!window.shanhai.busy);
  await fs.writeFile('qa/residences-old-save.json',JSON.stringify(await page.evaluate(()=>window.shanhai.session.snapshot()),null,2)+'\n');
 }else{
  assert.equal(await page.evaluate(()=>window.shanhai.session.currentPlayer.cash),oldSave.players[0].cash);
  assert.match(await page.$eval('[data-property-tile="1"]',e=>e.textContent),/阿屿.*L0/);
  assert.equal(await page.evaluate(()=>window.shanhai.scene.propertyVisuals.find(p=>p.tileId===1).model),'property_level0');
  report.checks.push('Previous-commit save resumes with unchanged cash/ownership, original vacant plot and explicit owner/L0 badge.');
 }
 await page.waitForFunction(()=>!document.querySelector('#turn-banner').classList.contains('show'));
 report.propertyFixture=await page.evaluate(()=>{
  const {session,scene}=window.shanhai,counts={};const stable=s=>JSON.stringify(s,(k,v)=>['savedAt','generatedAt'].includes(k)?undefined:v);const before=stable(session.snapshot());
  scene.syncProperties({players:session.state.players,propertyManager:{getProperty(id){const p=session.state.propertyManager.getProperty(id);if(!p)return null;const region=Math.floor(id/8);counts[region]??=0;return {...p,owner:id%2,level:id===12?3:1+(counts[region]++%4)};}}});
  return {frame:scene.renderer.info.render.frame,unchanged:stable(session.snapshot())===before,models:scene.propertyVisuals,description:'Presentation-only regional tier fixture, not earned game progress.'};
 });assert.equal(report.propertyFixture.unchanged,true);
 await page.waitForFunction(frame=>window.shanhai.scene.renderer.info.render.frame>frame+2,{},report.propertyFixture.frame);
 report.metrics=await page.evaluate(()=>({...window.shanhai.scene.metrics}));
 await page.screenshot({path:`qa/residences-${baseline?'before':'after'}.png`});
 if(!baseline){
  const original=JSON.parse(await fs.readFile('qa/residences-baseline.json','utf8'));
  report.change={calls:report.metrics.calls-original.metrics.calls,triangles:report.metrics.triangles-original.metrics.triangles};assert.ok(report.change.calls<15);
  for(const region of ['harbor','market','garden'])for(let level=1;level<=4;level++)assert.ok(report.propertyFixture.models.some(p=>p.model===`res_${region}_${level}`));
  const badgeCount=await page.$$eval('.property-badge',n=>n.length);assert.equal(badgeCount,report.propertyFixture.models.length);
  await page.click('#view-zoom');await page.screenshot({path:'qa/residences-detail.png'});await page.click('#view-home');
  report.checks.push('All 12 regional house tiers and commercial model render with owner/level badges; fixture leaves game state intact.');
  assert.equal(await page.evaluate(()=>window.shanhai.scene.ambience.group.visible),false);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.waitForFunction(()=>window.shanhai.scene.ambience.time>.3);
  const birdBefore=await page.evaluate(()=>window.shanhai.scene.ambience.birds[0].position.toArray());
  const t=await page.evaluate(()=>window.shanhai.scene.ambience.time);await page.waitForFunction(t=>window.shanhai.scene.ambience.time>t+.3,{},t);
  report.ambient=await page.evaluate(()=>({time:window.shanhai.scene.ambience.time,meshes:window.shanhai.scene.ambience.group.children.length,visible:window.shanhai.scene.ambience.group.visible,calls:window.shanhai.scene.metrics.calls}));
  assert.equal(report.ambient.meshes,4);assert.equal(report.ambient.visible,true);assert.ok(report.ambient.calls<=report.metrics.calls+4);
  const birdAfter=await page.evaluate(()=>window.shanhai.scene.ambience.birds[0].position.toArray());assert.notDeepEqual(birdAfter,birdBefore);report.ambient.birdSamples=[birdBefore,birdAfter];
  await page.screenshot({path:'qa/residences-ambient.png'});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.waitForFunction(()=>!window.shanhai.scene.ambience.group.visible);
  report.checks.push('Two sea birds and two fountain ripples animate; reduced-motion preference immediately hides ambience.');
  await page.setViewport({width:390,height:844});await page.evaluate(()=>{scrollTo(0,0);window.shanhai.scene.highlight(19);});
  const frame=await page.evaluate(()=>window.shanhai.scene.renderer.info.render.frame);
  await page.waitForFunction(f=>getComputedStyle(document.querySelector('.topbar')).height==='67px'&&window.shanhai.scene.renderer.info.render.frame>f+2,{},frame);
  assert.equal(await page.$$eval('.property-badge',nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none').length),1);
  assert.match(await page.$eval('[data-property-tile="19"]',e=>e.textContent),/L2/);
  await page.screenshot({path:'qa/residences-mobile.png'});
  await page.evaluate(()=>window.shanhai.scene.syncProperties(window.shanhai.session.state));
  await page.click('#end-turn-button');await page.waitForFunction(()=>!window.shanhai.busy&&!window.shanhai.session.currentPlayer.isAI);
  assert.equal(await page.evaluate(()=>window.shanhai.session.state.phase),'PRE_ROLL_ACTION');
  report.checks.push('390px keeps only the selected owner/level badge; restored real game completes the AI turn normally.');
 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));await fs.writeFile(`qa/residences-${baseline?'baseline':'browser-report'}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
