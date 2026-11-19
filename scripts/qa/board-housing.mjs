import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';

const server=await createServer({cacheDir:'node_modules/.vite-housing',plugins:[{name:'qa-controller',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameController();','window.boardQA = new GameController();');
}}],server:{hmr:false,watch:null,host:'127.0.0.1',port:5196,strictPort:true}});
await server.listen();
let browser;
const results={};
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});

  for (const [size,width,height] of [['desktop',1440,900],['mobile',390,844]]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.setViewport({width,height,isMobile:size==='mobile',hasTouch:size==='mobile'});
    await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
    await page.goto('http://127.0.0.1:5196/');
    await page.waitForFunction(()=>window.boardQA);
    const state=new GameState({seed:64});
    state.setupGame([0,1].map(profileIndex=>({name:['小满','田野'][profileIndex],profileIndex,isAI:false})),80000,{mapId:'grand-bay'});
    const tileId=3;
    state.phase='LANDING_ACTION';
    state.players[1].cards=['DEMOLISH'];
    state.players.forEach(player=>player.currentTile=tileId);
    state.propertyManager.buyProperty(tileId,0);
    state.propertyManager.getProperty(tileId).level=4;
    const snapshot=state.createSnapshot();
    assert.equal(snapshot.version,11);
    await page.evaluate(s=>boardQA.restoreGame(s),snapshot);
    await page.waitForFunction(()=>boardQA.boardBuilder.buildingMeshes.get(3)?.userData.originalModel==='board_apartment');
    await page.evaluate(()=>{void boardQA.handleTileArrival(3);});
    await page.waitForSelector('#btn-land-upgrade',{visible:true});
    const tap = size==='mobile'?'tap':'click';
    await page[tap]('#btn-land-upgrade');
    await page.waitForFunction(()=>boardQA.boardBuilder.buildingMeshes.get(3)?.userData.originalModel==='res_harbor_5');
    const info=await page.evaluate(()=>{
      const game=boardQA.gameState;
      const property=game.propertyManager.getProperty(3);
      return {level:property.level,model:boardQA.boardBuilder.buildingMeshes.get(3).userData.originalModel,toll:game.propertyManager.calculateToll(3),version:game.createSnapshot().version};
    });
    assert.equal(info.level,5);
    await page.waitForFunction(()=>boardQA.boardBuilder.buildingMeshes.get(3).scale.y===1);
    await page.waitForSelector('.hotseat-ready',{visible:true});
    await page[tap]('.hotseat-ready');
    await page.waitForSelector('.hotseat-ready',{hidden:true});
    await page.waitForFunction(()=>!boardQA.scene3D.targetCameraPos && !boardQA.scene3D.targetLookAt,{timeout:90000});
    await page.screenshot({path:`qa/review/m3-upgrade-${size}.png`});
    if (size==='desktop') {
      await page.click('#btn-use-card');
      await page.waitForSelector('[data-entry-key="CARD:DEMOLISH"] .strategy-primary',{visible:true});
      await page.click('[data-entry-key="CARD:DEMOLISH"] .strategy-primary');
      await page.waitForSelector('.board-target-bar');
      const point=await page.evaluate(()=>{
        const p=boardQA.boardBuilder.tilePositions[3].clone().project(boardQA.scene3D.camera);
        return {x:(1+p.x)*innerWidth/2,y:(1-p.y)*innerHeight/2};
      });
      await page.mouse.click(point.x,point.y);
      await page.waitForFunction(()=>boardQA.boardBuilder.buildingMeshes.get(3)?.userData.originalModel==='board_apartment');
      info.afterDemolish=await page.evaluate(()=>boardQA.gameState.propertyManager.getProperty(3).level);
      assert.equal(info.afterDemolish,4);
    }
    assert.deepEqual(errors,[]);
    results[size]={...info,errors};
    await page.close();
  }
  await writeFile('qa/review/m3-upgrade-checks.json',JSON.stringify(results,null,2)+'\n');
} finally {await browser?.close();await server.close();}
