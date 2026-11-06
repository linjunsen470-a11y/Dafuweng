import assert from 'node:assert/strict';import fs from 'node:fs/promises';import puppeteer from 'puppeteer-core';import {preview} from 'vite';
const previewOnly=process.argv.includes('--preview-only'),report={previewOnly,checks:[],errors:[]},server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5224,strictPort:true}});let browser,page;
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const map of ['coast','highland']){
  const ctx=await browser.createBrowserContext();page=await ctx.newPage();page.setDefaultTimeout(60000);await page.setViewport({width:map==='coast'?1280:390,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:map==='coast'?'no-preference':'reduce'}]);
  await page.evaluateOnNewDocument(()=>{Date.now=()=>314;localStorage.setItem('shanhai:audio',JSON.stringify({musicEnabled:false,sfxEnabled:false}));localStorage.setItem('shanhai:ai-quick','true');});
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  const idle=()=>page.waitForFunction(()=>!window.shanhai.busy&&!window.shanhai.session.currentPlayer.isAI),stable=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))),snap=()=>page.evaluate(()=>{const s=window.shanhai.session.snapshot();delete s.savedAt;return s;});
  await page.goto(`http://127.0.0.1:5224/shanhai.html?map=${map}`);await page.waitForFunction(()=>window.shanhai?.ready);await page.select('#player-count','4');
  const before=await snap(),looks=[];
  for(const id of ['ayu','qinghe','xingluo','taoning']){
   await page.click(`[data-character="${id}"]`);await page.$eval('#preview-character',e=>e.focus());await page.keyboard.press('Enter');await stable();
   const look=await page.evaluate(()=>{const s=shanhai.scene,p=s.pawns[0];return {id:p.characterId,visible:s.scene.children.filter(o=>o.visible&&!o.isLight).map(o=>o===p.root?'selected':`${o.type}:${o.name}:${Object.entries(s).find(([k,v])=>v===o)?.[0]}`),zoom:s.camera.zoom,canvases:document.querySelectorAll('canvas').length,metrics:s.metrics,title:document.getElementById('preview-name').textContent};});
   assert.equal(look.id,id);assert.deepEqual(look.visible,['selected']);assert.equal(look.canvases,1);assert.equal(look.zoom,6);looks.push(look);
   if(previewOnly){
    // Compare the same loaded character; distinct first-use assets may allocate geometry lazily.
    await page.click(`[data-character="${id}"]`);await page.click('#preview-character');await stable();look.afterReselection=await page.evaluate(()=>shanhai.scene.metrics.geometries);
    assert.ok(look.afterReselection<=look.metrics.geometries,`${id}: repeated selection grew geometry from ${look.metrics.geometries} to ${look.afterReselection}`);
   }
   await page.screenshot({path:`qa/character-presentation-${map}-${id}.png`});
   const front=await page.evaluate(()=>shanhai.scene.camera.position.toArray());await page.click('#view-rotate');await stable();assert.notDeepEqual(await page.evaluate(()=>shanhai.scene.camera.position.toArray()),front);
   if(id==='qinghe')await page.screenshot({path:`qa/character-presentation-${map}-qinghe-back.png`});
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'preview-character');assert.equal(await page.evaluate(()=>shanhai.scene.characterPreview),null);
  }
  assert.deepEqual(await snap(),before);assert.equal(await page.evaluate(map=>localStorage.getItem(`shanhai-${map}:save:v1`),map),null);
  if(previewOnly){report.checks.push({map,looks,previewDoesNotMutateGame:true,geometryDoesNotGrow:true});await ctx.close();continue;}
  // Exercise changing the selection while preview is open, then launch directly from it.
  await page.click('#preview-character');await page.click('[data-character="xingluo"]');await page.click('[data-character="taoning"]');await stable();assert.match(await page.$eval('#preview-name',e=>e.textContent),/陶宁/);await page.click('#start-button');await idle();await stable();
  assert.equal(await page.evaluate(()=>shanhai.scene.characterPreview),null);assert.equal(await page.$eval('#character-preview',e=>e.hidden),true);assert.equal(await page.evaluate(()=>shanhai.scene.controls.maxZoom),2);assert.equal((await snap()).players.length,4);
  await page.evaluate(()=>{const scene=shanhai.scene,move=scene.move;window.motionChecks=[];scene.move=async function(id,tile,duration,continuing){const p=this.pawns.find(p=>p.playerId===id),entry={id,tile,continuing,beforeAction:p.currentAction,beforeEpoch:p.actionEpoch||0};const result=await move.call(this,id,tile,duration,continuing);Object.assign(entry,{afterAction:p.currentAction,afterEpoch:p.actionEpoch});motionChecks.push(entry);return result;};});
  await page.click('#remote-button');await page.click('[data-step="4"]');await idle();assert.equal((await snap()).players[0].currentTile,4);assert.equal(await page.$eval('#character-feedback',e=>e.dataset.mood),'surprise');
  await page.$eval('#character-feedback',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`qa/character-presentation-${map}-event.png`});
  const choice=map==='coast'?'work':'sort';await page.click(`[data-event-choice="${choice}"]`);await idle();assert.equal(await page.$eval('#character-feedback',e=>e.dataset.mood),'happy');await page.click('#end-turn-button');await idle();assert.equal((await snap()).round,2);
  const moves=await page.evaluate(()=>motionChecks),human=moves.filter(m=>m.id===0);assert.equal(human.length,4);assert.ok(human.slice(0,3).every(m=>m.continuing&&m.afterAction==='walk'));assert.ok(human.slice(1).every(m=>m.beforeAction==='walk'&&m.beforeEpoch===human[0].afterEpoch));assert.equal(human[3].afterAction,'idle');assert.ok(moves.some(m=>m.id!==0));for(const m of moves)assert.equal(m.afterAction,m.continuing?'walk':'idle');
  await page.$eval('#world',e=>e.scrollIntoView({block:'center'}));await stable();await page.screenshot({path:`qa/character-presentation-${map}-board.png`});const saved=await snap();await page.reload();await page.waitForFunction(()=>window.shanhai?.ready);await page.click('#preview-character');await page.click('#resume-button');await idle();const restored=await snap();assert.deepEqual(restored.players,saved.players);assert.deepEqual(restored.slice,saved.slice);assert.equal(await page.evaluate(()=>shanhai.scene.characterPreview),null);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  report.checks.push({map,viewport:map==='coast'?'1280x844':'390x844',reducedMotion:map==='highland',looks,moves,realEvent:choice,allFourSeatsRound2:true,saveRestore:true,previewDoesNotMutateGame:true});await ctx.close();console.log('Checked',map);
 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;if(page&&!page.isClosed()){report.page=await page.evaluate(()=>({phase:shanhai?.session.state.phase,busy:shanhai?.busy,text:document.getElementById('action-card')?.textContent})).catch(()=>null);await page.screenshot({path:'qa/character-presentation-failure.png'}).catch(()=>{});}}finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));await fs.writeFile(`qa/character-presentation-${previewOnly?'preview':'browser'}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,checks:report.checks.length,errors:report.errors,failure:report.failure,page:report.page},null,2));}
