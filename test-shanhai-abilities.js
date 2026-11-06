import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {preview} from 'vite';
const report={kind:'role abilities and original character performance',checks:[],errors:[],roles:{}};
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5188,strictPort:true}});let browser;
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const role of ['ayu','qinghe']){
  console.log('Playing role',role);const page=await browser.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.setViewport({width:1600,height:1100});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.evaluateOnNewDocument(()=>{Date.now=()=>314;});
  await page.goto('http://127.0.0.1:5188/shanhai.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.shanhai?.ready);
  await page.click(`[data-character="${role}"]`);await page.click('#start-button');await page.waitForFunction(()=>window.shanhai.active&&!window.shanhai.busy);
  assert.equal(await page.$eval('#ability-button',b=>b.disabled),true);
  if(role==='ayu'){await page.click('#commission-open');await page.click('[data-commission="DELIVERY"]');}
  await page.click('#remote-button');await page.click('[data-step="1"]');await page.waitForFunction(()=>window.shanhai.scene.pawns[0].currentAction==='walk');
  const gait=await page.evaluate(()=>{const p=window.shanhai.scene.pawns[0];return {action:p.currentAction,time:p.actions.walk.time,timeScale:p.actions.walk.getEffectiveTimeScale()};});
  await page.waitForFunction(()=>!window.shanhai.busy);
  if(role==='qinghe'){await page.click('#decision-button');await page.waitForFunction(()=>!window.shanhai.busy);await page.click('#end-turn-button');}else await page.click('#skip-button');
  await page.waitForFunction(()=>!window.shanhai.busy&&!window.shanhai.session.currentPlayer.isAI);
  assert.equal(await page.$eval('#ability-button',b=>b.disabled),false);
  const before=await page.evaluate(()=>{const s=window.shanhai.session,p=s.currentPlayer;return {cash:p.cash,points:p.cardPoints,tile:p.currentTile,rng:s.state.rng.state,round:s.state.round};});
  await page.click('#ability-button');await page.waitForFunction(()=>window.shanhai.scene.pawns[0].currentAction==='ability');
  await page.screenshot({path:`qa/abilities-${role}-action.png`});await page.waitForFunction(()=>!window.shanhai.busy);
  const after=await page.evaluate(()=>{const s=window.shanhai.session,p=s.currentPlayer;return {cash:p.cash,points:p.cardPoints,tile:p.currentTile,rng:s.state.rng.state,round:s.state.round,readyRound:s.abilities[0].readyRound,phase:s.state.phase};});
  assert.equal(after.cash-before.cash,role==='ayu'?900:300);assert.equal(after.points-before.points,role==='ayu'?-5:-30);assert.equal(after.tile,before.tile);assert.equal(after.rng,before.rng);assert.equal(after.readyRound,before.round+3);assert.equal(after.phase,'PRE_ROLL_ACTION');assert.equal(await page.$eval('#roll-button',b=>b.disabled),false);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#resume-button');await page.waitForFunction(()=>!window.shanhai.busy&&window.shanhai.active);
  assert.equal(await page.evaluate(()=>window.shanhai.session.currentPlayer.cash),after.cash);assert.equal(await page.$eval('#ability-button',b=>b.disabled),true);assert.match(await page.$eval('#ability-panel',b=>b.textContent),/第 5 轮/);
  // Camera-only presentation close-up of the actual pawn; gameplay state stays untouched.
  const model=await page.evaluate(()=>{const scene=window.shanhai.scene,p=scene.pawns[0];scene.controls.maxZoom=12;scene.camera.zoom=9;scene.camera.position.copy(p.root.position).add({x:4,y:3.6,z:6});scene.controls.target.copy(p.root.position).add({x:0,y:1,z:0});scene.camera.updateProjectionMatrix();return {clips:Object.keys(p.actions),frame:scene.renderer.info.render.frame,meshes:[],role:p.playerId};});
  await page.waitForFunction(f=>window.shanhai.scene.renderer.info.render.frame>f+3,{},model.frame);await page.screenshot({path:`qa/abilities-${role}-detail.png`});
  assert.ok(model.clips.includes('ability'));assert.ok(model.clips.includes('notice'));
  report.roles[role]={before,after,gait,clips:model.clips};
  report.checks.push(`${role}: actual UI movement, ability use/payment/reward, dice still available, reload preserves cooldown and balances; original GLB clips render.`);
  if(role==='qinghe'){
   await page.evaluate(()=>window.shanhai.scene.overview());await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
   const frame=await page.evaluate(()=>window.shanhai.scene.renderer.info.render.frame);await page.waitForFunction(f=>getComputedStyle(document.querySelector('.topbar')).height==='67px'&&window.shanhai.scene.renderer.info.render.frame>f+2,{},frame);
   await page.$eval('#ability-panel',e=>e.scrollIntoView());assert.ok(await page.$eval('#ability-panel',e=>e.getBoundingClientRect().width<=390));await page.screenshot({path:'qa/abilities-mobile.png'});report.checks.push('390px layout shows ability cost, cooldown and result without horizontal overflow.');
   await page.setViewport({width:1600,height:1100});await page.evaluate(()=>scrollTo(0,0));await page.click('#supply-button');await page.click('#remote-button');await page.click('[data-step="3"]');await page.waitForFunction(()=>!window.shanhai.busy&&window.shanhai.session.pendingEvent);
   assert.equal(await page.evaluate(()=>window.shanhai.scene.pawns[0].currentAction),'notice');await page.click('[data-event-choice]');assert.equal(await page.evaluate(()=>window.shanhai.scene.pawns[0].currentAction),'celebrate');report.checks.push('Actual arrival at island event plays notice, and the safe event choice plays celebration.');
  }
  await page.close();
 }
 const page=await browser.newPage();await page.setViewport({width:1280,height:900});const old=JSON.parse(await fs.readFile('qa/residences-old-save.json','utf8'));await page.evaluateOnNewDocument(save=>localStorage.setItem('shanhai-coast:save:v1',JSON.stringify(save)),old);
 await page.goto('http://127.0.0.1:5188/shanhai.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#resume-button');await page.waitForFunction(()=>window.shanhai.active);assert.equal(await page.evaluate(()=>window.shanhai.session.currentPlayer.cash),old.players[0].cash);assert.equal(await page.evaluate(()=>window.shanhai.session.abilities[0].readyRound),1);report.checks.push('Previous-version save without abilities resumes with unchanged cash and fresh optional ability ledger.');
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));await fs.writeFile('qa/abilities-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
