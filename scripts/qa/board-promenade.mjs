import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';

const server=await createServer({plugins:[{name:'qa-controller',transform(code,id){
  if(id.endsWith('/src/main.js')) return code.replace('new GameController();','window.boardQA = new GameController();');
}}],server:{host:'127.0.0.1',port:5197,strictPort:true,hmr:false,watch:null}});
await server.listen();
let browser;
const results={};
try {
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [size,width,height] of [['desktop',1440,900],['mobile',390,844]]){
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setViewport({width,height,isMobile:size==='mobile',hasTouch:size==='mobile'});
    await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
    await page.goto('http://127.0.0.1:5197/');
    await page.waitForFunction(()=>window.boardQA);
    const state=new GameState({seed:64});
    state.setupGame([0,1].map(profileIndex=>({name:['小满','田野'][profileIndex],profileIndex,isAI:false})),80000,{mapId:'grand-bay'});
    state.players[0].currentTile=3;
    state.players[0].items.push('ROBOT_DOLL');
    for (const [type,tileId] of [['BARRIER',4],['MINE',5],['TIME_BOMB',6]]) {
      state.roadEntities.push({id:'qa-'+type,type,tileId,ownerId:1,data:{},expiresRound:type==='TIME_BOMB'?4:null});
    }
    await page.evaluate(s=>boardQA.restoreGame(s),state.createSnapshot());
    await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');
    const point=await page.evaluate(()=>{
      const p=boardQA.boardBuilder.tilePositions[3].clone().project(boardQA.scene3D.camera);
      return {x:(1+p.x)*innerWidth/2,y:(1-p.y)*innerHeight/2};
    });
    if(size==='desktop') await page.mouse.move(point.x,point.y);
    else await page.touchscreen.tap(point.x,point.y);
    await page.waitForFunction(()=>!document.querySelector('.board-tip').hidden);
    const info=await page.evaluate(()=>{
      const board=boardQA.boardBuilder;
      const walk=board.mapEnvironmentGroup.getObjectByName('bay-promenade');
      return {tile:document.querySelector('.board-tip').textContent,batches:walk.children.length,
        fittings:walk.children.reduce((count,mesh)=>count+mesh.count,0),gulls:board.harborGulls.count, tokens:[board.obstacleMeshes.get(4)?.userData.token, board.mineMeshes.get(5)?.userData.token, board.roadEntityMeshes.get(6)?.userData.token]};
    });
    assert.equal(info.gulls,5);
    assert.deepEqual(info.tokens,['barrier','mine','timer']);
    assert.match(info.tile,/蓝湾码头/);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`qa/review/m4-promenade-${size}.png`});
    if (size==='desktop') {
      await page.click('#btn-use-card');
      await page.waitForSelector('[data-entry-key="ITEM:ROBOT_DOLL"] .strategy-primary',{visible:true});
      await page.click('[data-entry-key="ITEM:ROBOT_DOLL"] .strategy-primary');
      await page.waitForSelector('.board-target-bar');
      const target=await page.evaluate(()=>{
        const p=boardQA.boardBuilder.tilePositions[4].clone().project(boardQA.scene3D.camera);
        return {x:(1+p.x)*innerWidth/2,y:(1-p.y)*innerHeight/2};
      });
      await page.mouse.click(target.x,target.y);
      await page.waitForFunction(()=>!boardQA.gameState.roadEntities.some(entity=>entity.tileId===4));
      info.clearedBarrier=true;
    }
    assert.deepEqual(errors,[]);
    results[size]={...info,errors};
    await page.close();
  }
  await writeFile('qa/review/m4-promenade-checks.json',JSON.stringify(results,null,2)+'\n');
} finally {await browser?.close();await server.close();}
