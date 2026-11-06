import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
const fixture=JSON.parse(await fs.readFile('qa/continuity-initial-save.json','utf8'));
fixture.players.forEach((p,i)=>p.isAI=i!==0);
Object.assign(fixture.players[0],{godType:'GREAT_FORTUNE',godTurns:5});
Object.assign(fixture.properties.find(([id])=>id===1)[1],{owner:1,level:2});
const report={errors:[],scope:'Prepared save: human with GREAT_FORTUNE, opponent tile1 LV2. UI inspection, remote dice1, actual rent waiver; not a naturally acquired god.'};
const server=await createServer({plugins:[{name:'qa-controller',transform(c,id){if(id.endsWith('/src/main.js'))return c.replace('new GameController();','window.__qaGame=new GameController();');}}],server:{host:'127.0.0.1',port:5240,strictPort:true}});
await server.listen();
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage();p.setDefaultTimeout(90000);p.on('pageerror',e=>report.errors.push(e.message));await p.setViewport({width:1280,height:800});
 await p.evaluateOnNewDocument(s=>{localStorage.setItem('fortune-empire:auto-save:v1',JSON.stringify(s));localStorage.setItem('fortune-empire:tutorial-seen','1');},fixture);
 await p.goto('http://127.0.0.1:5240/',{waitUntil:'networkidle0',timeout:120000});await p.click('#load-auto-save-btn');await p.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');await p.waitForFunction(()=>!document.querySelector('.presentation-turn-banner.is-visible'));
 await p.evaluate(()=>{window.qaRent=null;const engine=__qaGame.gameEngine,run=engine.execute.bind(engine);engine.execute=command=>{const r=run(command);if(['RENT_WAIVED','RENT_PAID'].includes(r.type)&&command.playerId===0)qaRent={type:r.type,amount:r.amount,player:structuredClone(__qaGame.gameState.players[0])};return r;};});
 const snapshot=()=>p.evaluate(()=>{const s=__qaGame.gameState.createSnapshot();delete s.savedAt;return s;});
 assert.equal(await p.$eval('#map-inspector',e=>getComputedStyle(e).display),'none');report.initiallyHidden=true;
 const before=await snapshot();await p.click('#btn-inspect-map');await p.select('#map-inspector-select','1');
 report.description=await p.$eval('#map-inspector .map-inspector-body',e=>e.innerText);assert.ok(report.description.includes('$1,200（非最终实收）'));assert.ok(report.description.includes('落地时仍有效则免租'));
 assert.deepEqual(await snapshot(),before);report.readOnly=true;
 await p.waitForFunction(()=>!__qaGame.scene3D.targetCameraPos);await p.screenshot({path:'qa/rent-qualification-preview.png'});
 await p.click('#map-inspector-close');await p.waitForFunction(()=>getComputedStyle(document.querySelector('#map-inspector')).display==='none');await p.click('#btn-use-card');await p.waitForSelector('#modal-inventory:not(.hidden)');await p.click('#inventory-card-grid [data-entry-key="CARD:REMOTE_DICE"] .strategy-primary');await p.waitForSelector('#modal-remote-dice:not(.hidden)');await p.click('.dice-choice-btn[data-val="1"]');await p.waitForFunction(()=>qaRent!==null);
 report.result=await p.evaluate(()=>({type:qaRent.type,amount:qaRent.amount,cash:qaRent.player.cash,tile:qaRent.player.currentTile,godType:qaRent.player.godType}));
 assert.equal(report.result.type,'RENT_WAIVED');assert.equal(report.result.amount,0);assert.equal(report.result.cash,before.players[0].cash);assert.equal(report.result.tile,1);
 await p.waitForFunction(()=>getComputedStyle(document.querySelector('#map-inspector')).display==='none');report.inspectorClosed=true;
 report.visibleFeedback=await p.$eval('#presentation-layer',e=>e.innerText);await p.screenshot({path:'qa/rent-qualification-result.png'});assert.equal(report.errors.length,0);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await server.close();await fs.writeFile('qa/rent-qualification-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
