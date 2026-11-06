import assert from 'node:assert/strict';import fs from 'node:fs/promises';import puppeteer from 'puppeteer-core';import {createServer} from 'vite';
const west=JSON.parse(await fs.readFile('qa/return-route-at-west-return-save.json','utf8')),latest=JSON.parse(await fs.readFile('qa/return-route-latest-save.json','utf8')),initial=JSON.parse(await fs.readFile('qa/continuity-initial-save.json','utf8'));
const report={checks:[],errors:[],branches:[],limits:['Independent prepared art, news and branch fixtures, not part of the natural continuation.','Branch fixtures place a car at each existing fork; subsequent movement and choices use visible controls, no specified dice rolls.','390px Chromium software WebGL is not a physical phone.']};
const server=await createServer({plugins:[{name:'qa-controller',transform(c,id){if(id.endsWith('/src/main.js'))return c.replace('new GameController();','window.__qaGame = new GameController();');}}],server:{host:'127.0.0.1',port:5208,strictPort:true}});await server.listen();const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});let p;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function settle(){await delay(1600);await p.waitForFunction(()=>!document.querySelector('.presentation-turn-banner.is-visible'));}
async function open(s,mobile=false){p=await browser.newPage();p.setDefaultTimeout(90000);await p.setViewport(mobile?{width:390,height:844,isMobile:true,hasTouch:true}:{width:1440,height:900});if(mobile)await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);p.on('pageerror',e=>report.errors.push(e.message));await p.evaluateOnNewDocument(s=>{localStorage.setItem('fortune-empire:tutorial-seen','1');localStorage.setItem('fortune-empire:auto-save:v1',JSON.stringify(s));},s);await p.goto('http://127.0.0.1:5208/',{waitUntil:'networkidle0',timeout:120000});await p.click('#load-auto-save-btn');await p.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');await settle();}
try{
 for(const mobile of [false,true]){
  if(!process.argv.includes('--news-only')) {
  const s=structuredClone(west);for(const [id,level] of [[81,2],[83,4]])Object.assign(s.properties.find(([i])=>i===id)[1],{owner:0,level});
  await open(s,mobile);const loaded=await p.evaluate(()=>__qaGame.gameState.createSnapshot());for(const key of ['players','properties','round','rngState'])assert.deepEqual(loaded[key],s[key]);
  assert.deepEqual(await p.evaluate(()=>[79,82].map(i=>__qaGame.boardBuilder.specialTileMeshes.get(i).userData.originalModel)),['return_tide_gate','old_town_exchange']);
  assert.deepEqual(await p.evaluate(()=>[81,83].map(i=>__qaGame.boardBuilder.buildingMeshes.get(i).userData.originalModel)),['res_civic_2','res_civic_4']);
  await p.screenshot({path:`qa/return-route-art-${mobile?'mobile':'desktop'}.png`});
  if(!mobile){await p.click('#btn-rotate-right');await p.waitForFunction(()=>!__qaGame.scene3D.targetCameraPos);await p.screenshot({path:'qa/return-route-art-rotated.png'});}
  report.checks.push(`${mobile?'Mobile':'Desktop'}: actual saved west-return view, new mechanism and stock buildings, two existing residential plots; state unchanged`);await p.close();
  }
  await open(latest,mobile);const before=await p.evaluate(()=>__qaGame.gameState.createSnapshot());
  await p.evaluate(()=>{const g=__qaGame,r=g.gameState.economicCycle.lastReport,n=g.gameState.newsHistory.find(n=>n.round===r.round);g.presentationUI.presentDomainEvent({type:'ECONOMIC_CYCLE_ENDED',report:r},g.gameState);g.presentationUI.presentDomainEvent({type:'NEWS_FLASH',news:n},g.gameState);});await delay(300);
  assert.equal(await p.$$eval('.news-flash-overlay',e=>e.length),0);assert.equal(await p.$$eval('.economic-report-overlay',e=>e.length),1);
  const n=latest.newsHistory.find(n=>n.round===latest.economicCycle.lastReport.round),copy=await p.$eval('.economic-round-news',e=>e.textContent);assert.ok(copy.includes(n.title)&&copy.includes(n.desc));for(const i of n.impacts)assert.ok(copy.includes(i.label)&&copy.includes(i.detail));
  assert.ok(await p.$eval('.economic-round-news',e=>Array.from(e.querySelectorAll('.news-impact')).every(i=>i.getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom)&&e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().bottom<=e.nextElementSibling.getBoundingClientRect().top));
  await p.screenshot({path:`qa/return-route-news-${mobile?'mobile':'desktop'}.png`});
  await p.$eval('.economic-report-body',e=>{e.scrollTop=e.scrollHeight});assert.ok(await p.$eval('.economic-report-continue',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}));await p.click('.economic-report-continue');await delay(250);const after=await p.evaluate(()=>__qaGame.gameState.createSnapshot());delete before.savedAt;delete after.savedAt;assert.deepEqual(after,before);
  if(mobile)await p.click('#btn-mobile-tools');
  await p.click('#btn-economic-report');await p.waitForSelector('.economic-round-news');await p.click('.economic-report-close');await delay(250);report.checks.push(`${mobile?'Mobile':'Desktop'}: same-round natural news fully shown in one report, scroll/close/reopen work, entire snapshot unchanged`);await p.close();
 }
 for(const [fork,end,join] of (process.argv.includes('--news-only')?[]:[[12,95,24],[36,107,48],[60,119,72]])){
  const s=structuredClone(initial);s.players[0].currentTile=fork;s.players[0].vehicle='CAR';s.players[0].selectedDiceCount=3;
  await open(s);await p.click('#btn-pause-game');await p.click('[data-speed="2"]');await p.click('#btn-resume-game');
  await p.evaluate(()=>{window.__branch=[];const e=__qaGame.gameEngine,run=e.execute.bind(e);e.execute=c=>{const r=run(c);__branch.push({command:c.type,player:c.playerId,tile:__qaGame.gameState.players[c.playerId]?.currentTile,result:r.type,steps:r.steps??r.total,success:r.success});return r;};});
  const start=Date.now();let lastRoll='',screenshot=false,joined=false;
  while(Date.now()-start<180000){
   const v=await p.evaluate(()=>{const g=__qaGame,s=g.gameState;const visible=sel=>{const e=document.querySelector(sel);return e&&!e.disabled&&!e.closest('.hidden')&&e.getBoundingClientRect().width>0};return {round:s.round,tile:s.players[0].currentTile,ready:s.currentPlayerIndex===0&&s.phase==='PRE_ROLL_ACTION'&&!g.isProcessingAction,banner:!!document.querySelector('.presentation-turn-banner.is-visible'),actions:['.news-dismiss','.economic-report-close','.chance-accept','.minigame-skip','.mechanism-close','.magic-house-close','.lottery-close','#stock-modal-close','#shop-modal-close','#btn-land-pass','.bank-close','[data-route="84"]','[data-route="96"]','[data-route="108"]','.route-plan'].filter(visible),commands:__branch.filter(c=>c.player===0&&c.command==='ADVANCE_MOVE')};});
   const tiles=v.commands.map(c=>c.tile);if(tiles.includes(end)&&tiles.includes(join)){joined=true;await settle();await p.screenshot({path:`qa/return-route-branch-${fork}-join.png`});break;}
   if(v.actions.length&&!v.banner){await p.click(v.actions[0]).catch(e=>{if(!/detached|No element/.test(e.message))throw e});await delay(200);continue;}
   if(v.ready&&!v.banner){if(!screenshot&&tiles.length){await settle();await p.screenshot({path:`qa/return-route-branch-${fork}.png`});screenshot=true;}const key=`${v.round}:${v.tile}`;if(key!==lastRoll){lastRoll=key;await p.click('#btn-roll');}}
   await delay(200);
  }
  const commands=await p.evaluate(()=>__branch);report.branches.push({fork,end,join,joined,commands});assert.ok(joined,`Branch ${fork} did not rejoin within budget`);await p.close();
 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;await p?.screenshot({path:'qa/return-route-fixes-failure.png'}).catch(()=>{});}finally{await browser.close();await server.close();await fs.writeFile(process.argv.includes('--news-only')?'qa/return-route-news-report.json':'qa/return-route-fixes-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,checks:report.checks,branches:report.branches.map(b=>({fork:b.fork,joined:b.joined})),failure:report.failure,errors:report.errors},null,2));}
