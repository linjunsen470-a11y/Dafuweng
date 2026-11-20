import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {GameState} from '../../src/game/GameState.js';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';

// Capture the same new-game views, then restore successive landings from one fixture.
const server=await createServer({plugins:[{name:'observe-opening',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameState();','new GameState({seed:64});').replace('new GameController();','window.boardQA=new GameController();');
}}],server:{host:'127.0.0.1',port:5207,strictPort:true,watch:null,hmr:false}});
await server.listen();
let browser;
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:5207/');
  await page.waitForSelector('.rules-help-ready',{visible:true});await page.click('.rules-help-ready');
  await page.select('#map-select','grand-bay');await page.select('#player-count','4');
  await page.click('#start-game-btn');
  await page.waitForSelector('#btn-roll',{visible:true});
  const phase=process.argv[2]||'after';
  await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready' && boardQA.pawnManager.pawns.every(p=>p.skin));
  for(const [name,tile] of [['street',89],['overview',null]]){
    await page.evaluate(id=>id===null?boardQA.scene3D.showOverview():boardQA.showPlayerStreet(id),tile);
    await new Promise(r=>setTimeout(r,300));
    await page.screenshot({path:'/tmp/court-'+phase+'-'+name+'.jpg'});
  }
  if(phase==='after'){
    const state=new GameState({seed:64});
    state.setupGame([0,3].map(profileIndex=>({name:profileIndex?'田野':'小满',profileIndex,isAI:false})),20000,{mapId:'grand-bay'});
    const receipts=[];
    for(const [player,selector] of [[0,'#btn-land-buy'],[0,'#btn-land-upgrade'],[1,null]]){
      const snapshot=receipts.length?await page.evaluate(()=>boardQA.gameState.createSnapshot()):state.createSnapshot();
      if(receipts.length){
        await page.reload();
        await page.waitForFunction(()=>window.boardQA);
      }
      snapshot.currentPlayerIndex=player;
      snapshot.phase="LANDING_ACTION";
      snapshot.players[player].currentTile=88;
      await page.evaluate(s=>boardQA.restoreGame(s),snapshot);
      const read=()=>page.evaluate(()=>({cash:boardQA.gameState.players.map(p=>p.cash),...boardQA.gameState.propertyManager.getProperty(88)}));
      const before=await read();
      await page.evaluate(()=>{
        window.receipt=null;
        const off=boardQA.gameEngine.subscribe(e=>{
          if(!['PROPERTY_PURCHASED','PROPERTY_UPGRADED','RENT_PAID','RENT_WAIVED'].includes(e.type))return;
          window.receipt={event:e.type,cash:boardQA.gameState.players.map(p=>p.cash),...boardQA.gameState.propertyManager.getProperty(88)};
          off();
        });
        boardQA.handleTileArrival(88);
      });
      if(selector){await page.waitForSelector(selector,{visible:true,timeout:8000});await page.click(selector);}
      await page.waitForFunction(()=>window.receipt,{timeout:10000});
      const after=await page.evaluate(()=>window.receipt);console.log(player,after);receipts.push({player,before,after});
    }
    assert.equal(receipts[0].after.owner,0);assert.equal(receipts[1].after.level,1);
    const rent=receipts[2];assert.equal(rent.after.event,'RENT_PAID');assert.equal(rent.before.cash[1]-rent.after.cash[1],rent.after.cash[0]-rent.before.cash[0]);
    assert.deepEqual(errors,[]);await writeFile('qa/review/cloud-court-economy.json',JSON.stringify(receipts,null,2)+'\n');
  }
}finally{await browser?.close();await server.close();}
