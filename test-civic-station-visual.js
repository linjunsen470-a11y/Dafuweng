import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
const mode='visual';
const fixture=JSON.parse(await fs.readFile('qa/continuity-initial-save.json','utf8'));
fixture.players[0].currentTile=41;
const report={errors:[],limits:['Prepared original save at41; camera-only visual follow-up after rear windows/trim. Actual gameplay is in baseline/final reports.','Desktop software WebGL and mobile viewport, not physical phone or complete natural game.']};
const server=await createServer({plugins:[{name:'qa-controller',transform(c,id){if(id.endsWith('/src/main.js'))return c.replace('new GameController();','window.__qaGame = new GameController();');}}],server:{host:'127.0.0.1',port:5230,strictPort:true}});await server.listen();
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});let p;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
 p=await browser.newPage();p.setDefaultTimeout(90000);await p.setViewport({width:1280,height:800});p.on('pageerror',e=>report.errors.push(e.message));
 await p.evaluateOnNewDocument(s=>{localStorage.setItem('fortune-empire:tutorial-seen','1');localStorage.setItem('fortune-empire:auto-save:v1',JSON.stringify(s));},fixture);
 await p.goto('http://127.0.0.1:5230/',{waitUntil:'networkidle0',timeout:120000});await p.click('#load-auto-save-btn');await p.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');await p.waitForFunction(()=>!document.querySelector('.presentation-turn-banner.is-visible'));
 await p.evaluate(()=>{const g=__qaGame;g.scene3D.showStreetView(g.boardBuilder.tilePositions[42]);});await p.screenshot({path:`qa/civic-station-${mode}-approach.png`});await p.click('#btn-follow-view');
 await p.setViewport({width:360,height:640});await p.evaluate(()=>{const g=__qaGame;g.scene3D.showStreetView(g.boardBuilder.tilePositions[42]);});await p.screenshot({path:'qa/civic-station-visual-mobile.png'});report.success=true;

}catch(e){report.success=false;report.failure=e.stack;await p?.screenshot({path:`qa/civic-station-${mode}-failure.png`}).catch(()=>{});process.exitCode=1;}
finally{await browser.close();await server.close();await fs.writeFile(`qa/civic-station-${mode}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,failure:report.failure,errors:report.errors}));}
