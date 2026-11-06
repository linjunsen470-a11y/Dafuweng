import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from './src/game/GameState.js';

const report={checks:[],errors:[],limitations:['390px viewport smoke only: manual review found the existing main-game HUD obscures the board and clips controls. Mobile playability is not accepted.','Prepared situations cover upgrades, forks and saves; no full-match balance or subjective audio acceptance.']};
const server=await createServer({plugins:[{name:'test-only-controller',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameController();','window.__qaGame = new GameController();');
}}],server:{host:'127.0.0.1',port:5191,strictPort:true}});
await server.listen();
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page;
const fixture=(tile=0)=>{const s=new GameState({seed:64});s.setupGame([0,1,2,3].map((profileIndex,i)=>({name:`P${i+1}`,profileIndex,isAI:i>0,aiDifficulty:'NORMAL'})),60000,{mapId:'grand-bay',initialDeposit:5000});s.boardGods=[];s.roadEntities=[];s.players.forEach(p=>p.godType=null);s.players[0].currentTile=tile;s.players[0].moveLimitThisTurn=1;return s.createSnapshot();};
try{
 page=await browser.newPage();page.setDefaultTimeout(120000);await page.setViewport({width:1440,height:900});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
 await page.goto('http://127.0.0.1:5191/',{waitUntil:'networkidle0',timeout:120000});
 await page.select('#map-select','grand-bay');await page.click('#start-game-btn');
 await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');
 await page.waitForFunction(()=>!document.querySelector('.presentation-turn-banner.is-visible'));
 assert.equal(await page.evaluate(()=>Number.isFinite(__qaGame.scene3D.ambientLight.intensity)&&__qaGame.scene3D.ambientLight.intensity>0),true);
 await page.screenshot({path:'qa/harbor-streets-start.png'});report.checks.push('Actual main-game setup enters a readable, lit harbor street');
 const restore=async s=>{if(await page.$('.economic-report-close'))await page.click('.economic-report-close');await page.evaluate(s=>{__qaGame.actionSpeed=4;__qaGame.restoreGame(s);},s);await page.waitForFunction(()=>!document.querySelector('.presentation-turn-banner.is-visible'));};
 if(!process.argv.includes('--remaining')){
 await restore(fixture());await page.click('#btn-roll');await page.waitForSelector('#btn-land-buy',{visible:true});await page.click('#btn-land-buy');
 await page.waitForFunction(()=>__qaGame.gameState.round>=2&&__qaGame.gameState.currentPlayerIndex===0&&!__qaGame.isProcessingAction);
 assert.equal(await page.evaluate(()=>__qaGame.gameState.propertyManager.getProperty(1).owner),0);
 report.checks.push('Human rolls and buys harbor lot 1; AI turns and status skips return control');console.log('purchase and AI round passed');
 }else{const prior=JSON.parse(await fs.readFile('qa/harbor-streets-purchase-report.json','utf8'));assert.ok(prior.checks.some(c=>c.includes('buys harbor lot 1')));report.checks.push('Purchase and AI return verified in the prior run; see harbor-streets-purchase-report.json');}
 const upgrade=fixture();upgrade.properties.find(([id])=>id===1)[1].owner=0;
 await restore(upgrade);await page.click('#btn-roll');await page.waitForSelector('#btn-land-upgrade',{visible:true});await page.click('#btn-land-upgrade');
 await page.waitForFunction(()=>__qaGame.boardBuilder.buildingMeshes.get(1)?.userData.originalModel==='res_harbor_1');
 report.checks.push('Real upgrade dialog drives the original level-1 residence');
 // Finish the ongoing round before restoring another prepared situation.
 await page.waitForFunction(()=>__qaGame.gameState.round>=2&&__qaGame.gameState.currentPlayerIndex===0&&!__qaGame.isProcessingAction);
 const street=fixture(5);for(const [id,level] of [[1,1],[3,2],[6,3],[8,4]])Object.assign(street.properties.find(([i])=>i===id)[1],{owner:0,level});
 await restore(street);await page.evaluate(()=>__qaGame.scene3D.showStreetView(__qaGame.boardBuilder.tilePositions[5]));
 await page.screenshot({path:'qa/harbor-streets-levels.png'});
 const models=await page.evaluate(()=>[1,3,6,8].map(id=>__qaGame.boardBuilder.buildingMeshes.get(id).userData.originalModel));assert.deepEqual(models,['res_harbor_1','res_harbor_2','res_harbor_3','res_harbor_4']);
 const saved=await page.evaluate(()=>{const s=__qaGame.gameState.createSnapshot();__qaGame.gameEngine.saves.saveAuto(s);return s;});
 await page.reload({waitUntil:'networkidle0'});await page.click('#load-auto-save-btn');await page.waitForFunction(()=>__qaGame.boardBuilder.buildingMeshes.get(8)?.userData.originalModel==='res_harbor_4');
 const loaded=await page.evaluate(()=>__qaGame.gameState.createSnapshot());for(const key of ['players','properties','round','rngState'])assert.deepEqual(loaded[key],saved[key]);
 report.checks.push('Four prepared building levels render and recover from an unchanged legacy save');console.log('models and save passed');
 await restore(fixture(12));await page.click('#btn-roll');await page.waitForSelector('[data-route="84"]',{visible:true});
 assert.deepEqual(await page.$$eval('.route-plan',es=>es.map(e=>Number(e.dataset.route))),[13,84]);
 await page.screenshot({path:'qa/harbor-streets-route.png'});await page.click('[data-route="13"]');await page.waitForSelector('#btn-land-buy',{visible:true});
 assert.equal(await page.evaluate(()=>__qaGame.gameState.players[0].currentTile),13);await page.click('#btn-land-buy');
 await page.waitForFunction(()=>__qaGame.gameState.round>=2&&__qaGame.gameState.currentPlayerIndex===0&&!__qaGame.isProcessingAction);
 report.checks.push('Existing fork 12 exposes both 13/84 routes and coastal purchase still resolves');console.log('fork passed');
 await restore(street);await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 // Puppeteer reloads when switching to mobile emulation; restore after that reload.
 await page.waitForFunction(()=>window.__qaGame);await restore(street);
 await page.screenshot({path:'qa/harbor-streets-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.evaluate(()=>Number.isFinite(__qaGame.scene3D.ambientLight.intensity)),true);
 report.checks.push('390px mobile viewport draws the main game without horizontal overflow (simulation only)');
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;report.state=await page?.evaluate(()=>({round:__qaGame.gameState.round,phase:__qaGame.gameState.phase,player:__qaGame.gameState.players[0],prop:__qaGame.gameState.propertyManager.getProperty(1)})).catch(()=>null);process.exitCode=1;await page?.screenshot({path:'qa/harbor-streets-failure.png'}).catch(()=>{});}
finally{await browser.close();await server.close();await fs.writeFile('qa/harbor-streets-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
