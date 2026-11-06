import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
const mode=process.argv.includes('--final')?'final':'baseline';
const mobile=process.argv.includes('--mobile');
const tag=`ai-feedback-${mode}${mobile?'-mobile':''}`;
const fixture=JSON.parse(await fs.readFile('qa/continuity-initial-save.json','utf8'));
fixture.players.forEach((p,i)=>{p.isAI=i!==0;});
// Prepared ownership/positions only. AI decisions, dice and settlement use production rules.
for(const [id,prop] of fixture.properties) if(id>0&&id<12&&id!==6)prop.owner=1;
fixture.players[2].currentTile=24; fixture.players[3].currentTile=40;
const report={errors:[],scope:'Prepared human plus three AI: human remote6 purchase, then unmodified AI decisions until human turn returns; not a natural full match.'};
const server=await createServer({plugins:[{name:'qa-controller',transform(c,id){if(id.endsWith('/src/main.js'))return c.replace('new GameController();','window.__qaGame=new GameController();');}}],server:{host:'127.0.0.1',port:5240,strictPort:true}});
await server.listen();
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page;const shots=[];
try{
 page=await browser.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>report.errors.push(e.message));await page.setViewport(mobile?{width:390,height:844}:{width:1280,height:800});
 await page.exposeFunction('captureFeedback',()=>{const job=page.screenshot({path:`qa/${tag}-upgrade.png`});shots.push(job);return job.then(()=>true);});
 await page.evaluateOnNewDocument(s=>{localStorage.setItem('fortune-empire:tutorial-seen','1');localStorage.setItem('fortune-empire:auto-save:v1',JSON.stringify(s));},fixture);
 await page.goto('http://127.0.0.1:5240/',{waitUntil:'networkidle0',timeout:120000});await page.click('#load-auto-save-btn');await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');await page.waitForFunction(()=>!document.querySelector('.presentation-turn-banner.is-visible'));
 await page.evaluate(()=>{
 window.qaEvents=[];window.qaToasts=[];
 const engine=__qaGame.gameEngine,run=engine.execute.bind(engine);
 engine.execute=command=>{const result=run(command);qaEvents.push({command,result:JSON.parse(JSON.stringify(result)),positions:__qaGame.gameState.players.map(p=>p.currentTile),cash:__qaGame.gameState.players.map(p=>p.cash)});return result;};
 const ui=__qaGame.presentationUI,show=ui.showToast.bind(ui);
 ui.showToast=cue=>{show(cue);const node=ui.toastStack.firstElementChild;qaToasts.push({cue,text:node.textContent,currentPlayer:__qaGame.gameState.getCurrentPlayer().name});if(cue.title.includes('建筑升级')){requestAnimationFrame(()=>{const detail=node.children[1].lastElementChild,r=detail.getBoundingClientRect();window.qaUpgrade={text:node.textContent,opacity:getComputedStyle(node).opacity,whiteSpace:getComputedStyle(detail).whiteSpace,clientWidth:detail.clientWidth,scrollWidth:detail.scrollWidth,reactionVisible:[...document.querySelectorAll('.character-reaction')].some(e=>getComputedStyle(e).visibility!=='hidden'),rect:{x:r.x,y:r.y,w:r.width,h:r.height}};void captureFeedback();});}};
 });
 await page.click('#btn-use-card');await page.waitForSelector('#modal-inventory:not(.hidden)');await page.click('#inventory-card-grid [data-entry-key="CARD:REMOTE_DICE"] .strategy-primary');await page.waitForSelector('#modal-remote-dice:not(.hidden)');await page.click('.dice-choice-btn[data-val="6"]');await page.waitForSelector('#btn-land-buy',{visible:true});await page.click('#btn-land-buy');
 await page.waitForFunction(()=>qaEvents.some(e=>e.command.playerId===3)&&__qaGame.gameState.currentPlayerIndex===0&&__qaGame.gameState.round>=2);
 await Promise.all(shots);report.events=await page.evaluate(()=>qaEvents);report.toasts=await page.evaluate(()=>qaToasts);report.upgrade=await page.evaluate(()=>window.qaUpgrade);report.final=await page.evaluate(()=>({players:__qaGame.gameState.players.map(p=>({id:p.id,cash:p.cash,currentTile:p.currentTile})),properties:[...__qaGame.gameState.propertyManager.properties]}));
 await page.screenshot({path:`qa/${tag}-end.png`});
 if(mode==='final'){const baseline=JSON.parse(await fs.readFile('qa/ai-feedback-baseline-report.json','utf8'));assert.deepEqual(report.final,baseline.final);assert.deepEqual(report.events,baseline.events);const upgrade=report.toasts.find(t=>t.cue.title.includes('建筑升级'));assert.ok(upgrade.cue.detail.includes(upgrade.currentPlayer));assert.equal(report.upgrade.whiteSpace,'normal');if(mobile)assert.equal(report.upgrade.reactionVisible,false);assert.ok(report.upgrade.scrollWidth<=report.upgrade.clientWidth+1);}
 assert.equal(report.errors.length,0);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;report.events=await page?.evaluate(()=>window.qaEvents).catch(()=>[]);report.toasts=await page?.evaluate(()=>window.qaToasts).catch(()=>[]);await page?.screenshot({path:`qa/${tag}-failure.png`}).catch(()=>{});process.exitCode=1;}
finally{await Promise.allSettled(shots);await browser.close();await server.close();await fs.writeFile(`qa/${tag}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,failure:report.failure,toasts:report.toasts,upgrade:report.upgrade}));}
