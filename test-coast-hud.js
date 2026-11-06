import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
const mode=process.argv.includes('--final')?'final':'baseline';
const fixture=JSON.parse(await fs.readFile('qa/continuity-initial-save.json','utf8'));
const report={errors:[],runs:[],limits:['Original opening save, actual remote-card 0→6 purchase per viewport; not a full natural match.','360/390 CSS viewports in software WebGL, not physical phones. Shoreline camera25 is inspection only.']};
const server=await createServer({plugins:[{name:'qa-controller',transform(c,id){if(id.endsWith('/src/main.js'))return c.replace('new GameController();','window.__qaGame = new GameController();');}}],server:{host:'127.0.0.1',port:5227,strictPort:true}});await server.listen();
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 for(const [width,height] of [[1280,720],[360,640],[390,844]]) {
  const p=await browser.newPage();p.setDefaultTimeout(90000);await p.setViewport({width,height});p.on('pageerror',e=>report.errors.push(e.message));await p.evaluateOnNewDocument(s=>{localStorage.setItem('fortune-empire:tutorial-seen','1');localStorage.setItem('fortune-empire:auto-save:v1',JSON.stringify(s));},fixture);
  await p.goto('http://127.0.0.1:5227/',{waitUntil:'networkidle0',timeout:120000});await p.click('#load-auto-save-btn');await p.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');await p.waitForFunction(()=>!document.querySelector('.presentation-turn-banner.is-visible'));
  const run={width,height};report.runs.push(run);
  run.opening=await p.evaluate(()=>{
   const rect=s=>{const el=document.querySelector(s),b=el.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height,display:getComputedStyle(el).display};};
   return {players:rect('.left-panel'),lastPlayer:rect('.player-card:last-child'),log:rect('.log-panel'),dock:rect('.control-panel')};
  });
  await p.screenshot({path:`qa/coast-hud-${mode}-${width}-opening.png`});
  if(mode==='final'&&width===1280){
   assert.ok(run.opening.players.bottom<run.opening.log.y);
   await p.focus('.left-panel');await p.keyboard.press('End');
   await p.waitForFunction(()=>document.querySelector('.left-panel').scrollTop>0);
   run.keyboardScroll=await p.evaluate(()=>{const panel=document.querySelector('.left-panel'),last=document.querySelector('.player-card:last-child').getBoundingClientRect();return {scrollTop:panel.scrollTop,lastBottom:last.bottom,panelBottom:panel.getBoundingClientRect().bottom,focused:document.activeElement===panel};});
   assert.ok(run.keyboardScroll.focused&&run.keyboardScroll.lastBottom<=run.keyboardScroll.panelBottom);
   await p.screenshot({path:'qa/coast-hud-final-desktop-assets-scrolled.png'});await p.keyboard.press('Home');
  }

  if(width===1280){await p.click('#btn-map-overview');await p.screenshot({path:`qa/coast-hud-${mode}-overview.png`});await p.evaluate(()=>{const g=__qaGame;g.scene3D.showStreetView(g.boardBuilder.tilePositions[25]);});await p.screenshot({path:`qa/coast-hud-${mode}-shore25.png`});
   if(mode==='final'){
    await p.evaluate(()=>{const g=__qaGame;g.scene3D.showStreetView(g.boardBuilder.tilePositions[12]);});await p.screenshot({path:'qa/coast-hud-final-piers.png'});
    run.piers=await p.evaluate(()=>{const list=[];__qaGame.boardBuilder.mapEnvironmentGroup.traverse(o=>{if(o.name==='harbor-pier')list.push({x:o.position.x,start:o.position.z-o.geometry.parameters.depth/2,end:o.position.z+o.geometry.parameters.depth/2});});return list;});assert.equal(run.piers.length,4);assert.ok(run.piers.every(p=>p.start<=36.35&&p.end>47));
   }
   await p.click('#btn-follow-view');}
  await p.evaluate(()=>{const g=__qaGame,e=g.gameEngine,execute=e.execute.bind(e);window.hudPurchase=null;e.execute=c=>{const r=execute(c);if(c.playerId===0&&r.type==='PROPERTY_PURCHASED')hudPurchase={result:r,snapshot:g.gameState.createSnapshot()};return r;};window.feedback=[];let end=performance.now()+180000;function sample(){const dock=document.querySelector('.control-panel').getBoundingClientRect();for(const el of document.querySelectorAll('.character-reaction.is-visible,.presentation-toast.is-visible,.presentation-arrival.is-visible,.presentation-move-progress.is-visible')){const b=el.getBoundingClientRect();if(getComputedStyle(el).opacity>.95)feedback.push({kind:el.className,bottom:b.bottom,dockTop:dock.top,overlap:Math.max(0,Math.min(b.right,dock.right)-Math.max(b.left,dock.left))*Math.max(0,Math.min(b.bottom,dock.bottom)-Math.max(b.top,dock.top))});}if(performance.now()<end)requestAnimationFrame(sample);}requestAnimationFrame(sample);});
  await p.click('#btn-use-card');await p.waitForSelector('#inventory-card-grid [data-entry-key="CARD:REMOTE_DICE"] .strategy-primary');await p.click('#inventory-card-grid [data-entry-key="CARD:REMOTE_DICE"] .strategy-primary');await p.waitForSelector('#modal-remote-dice:not(.hidden)');await p.click('.dice-choice-btn[data-val="6"]');await p.waitForSelector('#btn-land-buy:not(.hidden)',{visible:true});
  run.buyButton=await p.$eval('#btn-land-buy',el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,hit:el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};});assert.ok(run.buyButton.hit&&run.buyButton.bottom<=height&&run.buyButton.x>=0&&run.buyButton.right<=width);
  await p.screenshot({path:`qa/coast-hud-${mode}-${width}-decision.png`});await p.click('#btn-land-buy');await p.waitForFunction(()=>window.hudPurchase);await p.waitForSelector('.character-reaction.is-visible');await p.screenshot({path:`qa/coast-hud-${mode}-${width}-feedback.png`});
  run.purchase=await p.evaluate(()=>hudPurchase);run.feedback=await p.evaluate(()=>feedback);assert.equal(run.purchase.result.tileId,6);assert.equal(run.purchase.snapshot.players[0].cash,18878);
  if(mode==='final') {const before=JSON.parse(await fs.readFile('qa/coast-hud-baseline-report.json','utf8')).runs.find(r=>r.width===width);const normalize=v=>JSON.parse(JSON.stringify(v,(k,v)=>['savedAt','time'].includes(k)?undefined:v));assert.deepEqual(normalize(run.purchase),normalize(before.purchase));assert.ok(run.feedback.length);assert.equal(Math.max(...run.feedback.map(r=>r.overlap)),0);run.matchesBaseline=true;}
  await p.close();console.log(`finished ${mode} ${width}`);
 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await server.close();await fs.writeFile(`qa/coast-hud-${mode}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,failure:report.failure,errors:report.errors}));}
