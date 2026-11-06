import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
const mode=process.argv.includes('--final')?'final':'baseline';
const fixture=JSON.parse(await fs.readFile('qa/continuity-initial-save.json','utf8'));
fixture.players[0].currentTile=12; // Only prepared placement; use existing starting card and item.
const report={checks:[],commands:[],errors:[],limits:['Prepared original opening snapshot at fork 12. Existing remote card/item consumed through UI; no injected dice or engine actions.','Desktop software WebGL; no physical mobile or audio acceptance.']};
const server=await createServer({plugins:[{name:'qa-controller',transform(c,id){if(id.endsWith('/src/main.js'))return c.replace('new GameController();','window.__qaGame = new GameController();');}}],server:{host:'127.0.0.1',port:5210,strictPort:true}});await server.listen();
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});let p;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 p=await browser.newPage();p.setDefaultTimeout(90000);await p.setViewport({width:1440,height:900});p.on('pageerror',e=>report.errors.push(e.message));
 await p.evaluateOnNewDocument(s=>{localStorage.setItem('fortune-empire:tutorial-seen','1');localStorage.setItem('fortune-empire:auto-save:v1',JSON.stringify(s));},fixture);
 await p.goto('http://127.0.0.1:5210/',{waitUntil:'networkidle0',timeout:120000});await p.click('#load-auto-save-btn');await p.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');await delay(1800);await p.waitForFunction(()=>!document.querySelector('.presentation-turn-banner.is-visible'));
 await p.click('#btn-pause-game');await p.click('[data-speed="2"]');await p.click('#btn-resume-game');
 await p.evaluate(()=>{window.branchTrace=[];window.visit=null;window.companyArrival='';const ui=__qaGame.presentationUI,arrive=ui.showArrival.bind(ui);ui.showArrival=args=>{const pending=arrive(args);if(args.tileId===89)companyArrival=document.querySelector('#presentation-arrival-host').textContent;return pending;};const e=__qaGame.gameEngine,run=e.execute.bind(e);e.execute=c=>{const g=__qaGame,s=g.gameState,co=s.companyManager.get('CLOUD_COMPUTE');const before={cash:s.players[0].cash,treasury:co.treasury,revenue:co.periodRevenue};const r=run(c);branchTrace.push({round:s.round,player:c.playerId,command:c.type,tile:s.players[c.playerId]?.currentTile,result:r.type,success:r.success});if(c.playerId===0&&r.type==='COMPANY_VISIT'){visit={...r,before,after:{cash:s.players[0].cash,treasury:co.treasury,revenue:co.periodRevenue},toast:document.querySelector('#presentation-toast-stack').textContent,arrival:companyArrival};}return r;};});
 let usedCard=false,usedItem=false,captured=false,lastRoll='';const start=Date.now();
 while(Date.now()-start<300000){
  const v=await p.evaluate(()=>{const g=__qaGame,s=g.gameState;const visible=sel=>{const e=document.querySelector(sel);return e&&!e.disabled&&!e.closest('.hidden')&&e.getBoundingClientRect().width>0;};return {round:s.round,tile:s.players[0].currentTile,who:s.currentPlayerIndex,ready:s.currentPlayerIndex===0&&s.phase==='PRE_ROLL_ACTION'&&!g.isProcessingAction,banner:!!document.querySelector('.presentation-turn-banner.is-visible'),visit,actions:['.news-dismiss','.economic-report-close','.chance-accept','#btn-land-pass','.bank-close','#stock-modal-close','#shop-modal-close','.mechanism-close','.magic-house-close','.lottery-close','[data-route="84"]','.route-plan'].filter(visible),steps:branchTrace.filter(c=>c.player===0&&c.command==='ADVANCE_MOVE').map(c=>c.tile)};});
  if(v.visit&&!captured){captured=true;report.visit=v.visit;await fs.writeFile(`qa/company-branch-${mode}-visit-save.json`,JSON.stringify(await p.evaluate(()=>__qaGame.gameState.createSnapshot()),null,2)+'\n');await p.screenshot({path:`qa/company-branch-${mode}-visit.png`});}
  if(v.steps.includes(95)&&v.steps.includes(24)&&v.ready&&!v.banner){await delay(800);await p.screenshot({path:`qa/company-branch-${mode}-return.png`});report.joined=true;break;}
  if(v.actions.length&&!v.banner){await p.click(v.actions[0]).catch(e=>{if(!/detached|No element|not clickable/.test(e.message))throw e;});await delay(200);continue;}
  if(v.ready&&!v.banner){
   if(!usedCard||(!usedItem&&v.tile===89)){
    const key=!usedCard?'CARD:REMOTE_DICE':'ITEM:REMOTE_DICE_ITEM';await p.click('#btn-use-card');await p.waitForSelector(`[data-entry-key="${key}"] .strategy-primary`);await p.click(`[data-entry-key="${key}"] .strategy-primary`);await p.waitForSelector('#modal-remote-dice:not(.hidden)');await p.click('.dice-choice-btn[data-val="6"]');if(!usedCard)usedCard=true;else usedItem=true;
   }else{const k=`${v.round}:${v.tile}`;if(k!==lastRoll){lastRoll=k;await p.click('#btn-roll');}}
  }
  await delay(200);
 }
 report.commands=await p.evaluate(()=>branchTrace);report.snapshot=await p.evaluate(()=>__qaGame.gameState.createSnapshot());assert.ok(report.joined&&report.visit);assert.equal(report.visit.before.cash-report.visit.after.cash,report.visit.fee);assert.equal(report.visit.after.treasury-report.visit.before.treasury,report.visit.fee);assert.equal(report.visit.after.revenue-report.visit.before.revenue,report.visit.fee);assert.ok(!report.snapshot.players[0].cards.includes('REMOTE_DICE'));assert.ok(!report.snapshot.players[0].items.includes('REMOTE_DICE_ITEM'));if(mode==='final'){assert.ok(report.visit.toast.includes('公司服务费'));assert.ok(report.visit.toast.includes('$390'));assert.ok(report.visit.arrival.includes('董事长免服务费'));}
 report.checks.push('Actual UI: fork12→84…89, company fee enters treasury/revenue, existing remote card/item consumed, continue to95 and rejoin24 after prison turns');assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;report.commands=await p?.evaluate(()=>branchTrace).catch(()=>[]);await p?.screenshot({path:`qa/company-branch-${mode}-failure.png`}).catch(()=>{});}finally{await browser.close();await server.close();await fs.writeFile(`qa/company-branch-${mode}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,visit:report.visit,joined:report.joined,failure:report.failure,errors:report.errors}));}
