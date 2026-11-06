import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
const mode=process.argv.includes('--final')?'final':'baseline';
const fixture=JSON.parse(await fs.readFile('qa/continuity-initial-save.json','utf8'));
fixture.players[0].currentTile=41;
const report={errors:[],limits:['Prepared original four-player save at41; original remote card/item used via UI. No injected turn skips or jail flags.','Desktop software WebGL and mobile viewport, not physical phone or complete natural game.']};
const server=await createServer({plugins:[{name:'qa-controller',transform(c,id){if(id.endsWith('/src/main.js'))return c.replace('new GameController();','window.__qaGame = new GameController();');}}],server:{host:'127.0.0.1',port:5230,strictPort:true}});await server.listen();
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});let p;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
 p=await browser.newPage();p.setDefaultTimeout(90000);await p.setViewport({width:1280,height:800});p.on('pageerror',e=>report.errors.push(e.message));
 await p.evaluateOnNewDocument(s=>{localStorage.setItem('fortune-empire:tutorial-seen','1');localStorage.setItem('fortune-empire:auto-save:v1',JSON.stringify(s));},fixture);
 await p.goto('http://127.0.0.1:5230/',{waitUntil:'networkidle0',timeout:120000});await p.click('#load-auto-save-btn');await p.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');await p.waitForFunction(()=>!document.querySelector('.presentation-turn-banner.is-visible'));
 await p.evaluate(()=>{const g=__qaGame;g.scene3D.showStreetView(g.boardBuilder.tilePositions[42]);});await p.screenshot({path:`qa/civic-station-${mode}-approach.png`});await p.click('#btn-follow-view');
 await p.click('#btn-pause-game');await p.click('[data-speed="2"]');await p.click('#btn-resume-game');
 await p.evaluate(()=>{window.stationTrace=[];window.stationStates={};const g=__qaGame,e=g.gameEngine,run=e.execute.bind(e);e.execute=c=>{const r=run(c),s=g.gameState;stationTrace.push({command:c.type,player:c.playerId,round:s.round,tile:s.players[0].currentTile,hospital:s.players[0].jailTurns,result:r});if(r.type==='JAILED'&&r.playerId===0){stationStates.admit=s.createSnapshot();stationStates.toast=document.querySelector('#presentation-toast-stack').textContent;}if(r.type==='TURN_CHANGED'&&s.currentPlayerIndex===0&&s.players[0].currentTile===42&&!s.players[0].jailTurns)stationStates.resume=s.createSnapshot();if(c.playerId===0&&r.type==='MOVEMENT_FINISHED'&&s.players[0].currentTile===43)stationStates.depart=s.createSnapshot();return r;};});
 async function remote(key){await p.click('#btn-use-card');await p.waitForSelector(`#inventory-card-grid [data-entry-key="${key}"] .strategy-primary`);await p.click(`#inventory-card-grid [data-entry-key="${key}"] .strategy-primary`);await p.waitForSelector('#modal-remote-dice:not(.hidden)');await p.click('.dice-choice-btn[data-val="1"]');}
 await remote('CARD:REMOTE_DICE');let captured=false,resumed=false;const start=Date.now();
 while(Date.now()-start<300000){
  const v=await p.evaluate(()=>{const g=__qaGame,s=g.gameState;const visible=sel=>{const e=document.querySelector(sel);return e&&!e.disabled&&!e.closest('.hidden')&&e.getBoundingClientRect().width>0;};return {ready:s.currentPlayerIndex===0&&s.phase==='PRE_ROLL_ACTION'&&!g.isProcessingAction,banner:!!document.querySelector('.presentation-turn-banner.is-visible'),tile:s.players[0].currentTile,admit:!!stationStates.admit,depart:!!stationStates.depart,actions:['.news-dismiss','.economic-report-close','.chance-accept'].filter(visible)};});
  if(v.admit&&!captured){captured=true;await p.screenshot({path:`qa/civic-station-${mode}-admitted.png`});}
  if(v.depart){await p.waitForSelector('#btn-land-buy:not(.hidden)',{visible:true});await p.click('#btn-land-pass');report.departed=true;break;}
  if(v.actions.length&&!v.banner){await p.click(v.actions[0]);continue;}
  if(v.ready&&!v.banner&&v.tile===42&&!resumed){resumed=true;await p.screenshot({path:`qa/civic-station-${mode}-resumed.png`});await p.setViewport({width:360,height:640});await p.evaluate(()=>{const g=__qaGame;g.scene3D.showStreetView(g.boardBuilder.tilePositions[42]);});await p.screenshot({path:`qa/civic-station-${mode}-mobile.png`});await remote('ITEM:REMOTE_DICE_ITEM');}
  await delay(250);
 }
 const observed=await p.evaluate(()=>({trace:stationTrace,states:stationStates}));Object.assign(report,observed);
 assert.ok(report.departed);assert.equal(report.states.admit.players[0].jailTurns,2);assert.equal(report.states.admit.players[0].currentTile,42);assert.equal(report.states.resume.round,report.states.admit.round+3);assert.equal(report.states.resume.players[0].jailTurns,0);assert.equal(report.states.admit.players[0].cash,20000);assert.equal(report.states.resume.players[0].cash,20000);assert.ok(report.states.resume.logHistory.some(e=>e.msg.includes('林小满')&&e.msg.includes('监狱')));assert.equal(report.states.depart.players[0].currentTile,43);
 assert.ok(!report.trace.some(e=>e.player===0&&e.command==='BEGIN_MOVE'&&[2,3].includes(e.round)));
 await p.screenshot({path:`qa/civic-station-${mode}-departed.png`});
 if(mode==='final'){const before=JSON.parse(await fs.readFile('qa/civic-station-baseline-report.json','utf8'));const normalize=s=>JSON.parse(JSON.stringify(s,(k,v)=>['savedAt','time'].includes(k)?undefined:v));for(const k of ['admit','resume','depart'])assert.deepEqual(normalize(report.states[k]),normalize(before.states[k]));report.matchesBaseline=true;report.model=await p.evaluate(()=>__qaGame.boardBuilder.specialTileMeshes.get(42).userData.originalStation);assert.ok(report.model);assert.ok(report.states.toast.includes('暂停 2 次行动'));assert.ok(report.states.toast.includes('从当前格继续'));}
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;Object.assign(report,await p?.evaluate(()=>({trace:window.stationTrace,states:window.stationStates})).catch(()=>({})));await p?.screenshot({path:`qa/civic-station-${mode}-failure.png`}).catch(()=>{});process.exitCode=1;}
finally{await browser.close();await server.close();await fs.writeFile(`qa/civic-station-${mode}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,failure:report.failure,errors:report.errors}));}
