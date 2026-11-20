import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {GameState} from '../../src/game/GameState.js';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';

// Only the seed and read-only controller access differ from the normal new-game entry.
const server=await createServer({plugins:[{name:'observe-opening',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameState();','new GameState({seed:64});').replace('new GameController();','window.boardQA=new GameController();');
}}],server:{host:'127.0.0.1',port:5207,strictPort:true,watch:null,hmr:false}});
await server.listen();
let browser;
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:5207/');
  await page.waitForSelector('.rules-help-ready',{visible:true});await page.click('.rules-help-ready');
  await page.select('#map-select','grand-bay');await page.select('#player-count','4');
  await page.click('#start-game-btn');
  await page.waitForSelector('#btn-roll',{visible:true});
  const phase=process.argv[2]||'after';
  await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready' && boardQA.pawnManager.pawns.every(p=>p.skin));
  for(const [name,tile] of [['opening',0],['junction',12],['overview',null]]){
    await page.evaluate(id=>id===null?boardQA.scene3D.showOverview():boardQA.showPlayerStreet(id),tile);
    await new Promise(r=>setTimeout(r,300));
    await page.screenshot({path:'/tmp/quay-'+phase+'-'+name+'.jpg'});
  }
  await page.evaluate(()=>boardQA.showPlayerStreet(0));
  await page.evaluate(()=>{
    const start=performance.now();
    window.opening={};
    const mark=key=>{opening[key]??=Math.round(performance.now()-start);};
    boardQA.gameEngine.subscribe(event=>mark(event.type));
    for(const [selector,key] of [['.presentation-dice-result','diceLabel'],['.presentation-arrival','arrivalLabel'],['#btn-land-buy','offer']]){
      const check=()=>{if(document.querySelector(selector)?.getBoundingClientRect().width)mark(key);};
      new MutationObserver(check).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
  });
  await page.click('#btn-roll');
  await page.waitForSelector('#btn-land-buy',{visible:true,timeout:90000});
  const receipt=await page.evaluate(()=>{
    const s=boardQA.gameState,p=s.players[0];return {tile:p.currentTile,name:s.getTile(p.currentTile).name,cashBefore:p.cash};
  });
  console.log('offer',JSON.stringify(await page.evaluate(()=>opening)));
  await page.click('#btn-land-buy');
  await page.waitForFunction(tile=>boardQA.gameState.propertyManager.getProperty(tile)?.owner===0,{},receipt.tile);
  receipt.cashAfter=await page.evaluate(()=>boardQA.gameState.players[0].cash);
  assert.ok(receipt.cashAfter<receipt.cashBefore);assert.deepEqual(errors,[]);
  const result={receipt,timesMs:await page.evaluate(()=>opening),errors};
  if(phase==='after'){
    const state=new GameState({seed:64});
    state.setupGame([0,1].map(profileIndex=>({name:['小满','田野'][profileIndex],profileIndex,isAI:false})),80000,{mapId:'grand-bay'});
    state.players[0].currentTile=12;
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await page.evaluate(snapshot=>boardQA.restoreGame(snapshot),state.createSnapshot());
    await page.waitForSelector('#btn-roll',{visible:true});
    await page.tap('#btn-roll');
    await page.waitForSelector('.quay-route-choice',{visible:true,timeout:60000});
    result.mobileFork=await page.$$eval('.quay-route-choice',buttons=>buttons.map(b=>b.innerText));
    assert.equal(result.mobileFork.length,2);
    await page.screenshot({path:'/tmp/quay-mobile-choice.jpg'});
    await page.tap('.quay-route-choice:last-child');
    await page.waitForFunction(()=>boardQA.gameState.players[0].currentTile===84 || boardQA.gameState.pendingMove?.path.includes(84));
    assert.deepEqual(errors,[]);
  }
  console.log(JSON.stringify(result));
  await writeFile('/tmp/quay-'+phase+'-purchase.json',JSON.stringify(result,null,2)+'\n');
}finally{await browser?.close();await server.close();}
