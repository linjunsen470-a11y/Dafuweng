import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';

// Only the seed and read-only controller access differ from the normal new-game entry.
const server=await createServer({plugins:[{name:'observe-opening',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameState();','new GameState({seed:Number(location.hash.slice(1))||64});').replace('new GameController();','window.boardQA=new GameController();');
}}],server:{host:'127.0.0.1',port:5237,strictPort:true,watch:null,hmr:false}});
await server.listen();
let browser;
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  const phase=process.argv[2]||'after';
  await page.evaluateOnNewDocument(()=>{if(location.protocol==='http:')localStorage.setItem('fortune-empire:tutorial-seen','1');});
  for(const [map,id] of [['taiwan-loop',3],['island-fork',3],['city-loop',3],['fortune-crossroads',3],['grand-bay',89]]){
    await page.goto('http://127.0.0.1:5237/');
    await page.select('#map-select',map);await page.click('#start-game-btn');
    await page.waitForSelector('#btn-roll',{visible:true});
    await page.evaluate(()=>boardQA.showPlayerStreet(0));
    await new Promise(r=>setTimeout(r,450));
    await page.screenshot({path:'/tmp/streets-'+phase+'-'+map+'-start.jpg'});
    await page.evaluate(tile=>boardQA.showPlayerStreet(tile),id);
    await page.screenshot({path:'/tmp/streets-'+phase+'-'+map+'.jpg'});
    if(map==='grand-bay'){
      await page.evaluate(()=>boardQA.scene3D.showStreetView(boardQA.boardBuilder.tilePositions[89].clone().set(-22,0,4)));
      await new Promise(r=>setTimeout(r,950));
      await page.screenshot({path:'/tmp/streets-'+phase+'-roof.jpg'});
    }
  }
  const receipts=[];
  for(const [map,seed] of [['taiwan-loop',4],['grand-bay',64]]){
    const mobile=map==='grand-bay';
    await page.setViewport(mobile?{width:390,height:844,hasTouch:true,isMobile:true}:{width:1440,height:900});
    await page.goto('http://127.0.0.1:5237/#'+seed);
    await page.select('#map-select',map);
    const press=selector=>mobile?page.tap(selector):page.click(selector);
    await press('#start-game-btn');
    await page.waitForFunction(()=>boardQA.pawnManager.pawns.length===4 && boardQA.pawnManager.pawns.every(p=>p.skin));
    assert.deepEqual(await page.evaluate(()=>boardQA.gameState.players.map(p=>p.currentTile)),[0,0,0,0]);
    await page.screenshot({path:'/tmp/frontage-'+map+'-start.jpg'});
    await press('#btn-roll');
    await page.waitForSelector('#btn-land-buy',{visible:true,timeout:90000});
    const tile=await page.evaluate(()=>boardQA.gameState.players[0].currentTile);
    const cashBefore=await page.evaluate(()=>boardQA.gameState.players[0].cash);
    await page.screenshot({path:'/tmp/frontage-'+map+'-deed.jpg'});
    await press('#btn-land-buy');
    await page.waitForFunction(id=>boardQA.gameState.propertyManager.getProperty(id)?.owner===0,{},tile);
    const receipt=await page.evaluate(id=>{
      const controller=boardQA,state=controller.gameState;
      const mesh=controller.boardBuilder.buildingMeshes.get(id);
      const road=controller.boardBuilder.tilePositions[id];
      return {id,owner:state.propertyManager.getProperty(id).owner,cash:state.players[0].cash,
        landing:state.players[0].currentTile,lotDistance:Math.hypot(mesh.position.x-road.x,mesh.position.z-road.z)};
    },tile);
    assert.equal(receipt.landing,tile);assert.ok(receipt.lotDistance>2.5);
    assert.ok(receipt.cash<cashBefore);receipts.push({map,cashBefore,...receipt});console.log(JSON.stringify(receipts.at(-1)));
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify(receipts));
}finally{await browser?.close();await server.close();}
