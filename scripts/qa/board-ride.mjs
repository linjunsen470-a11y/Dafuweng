import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';
import {boardClearance} from './board-clearance.mjs';

const server=await createServer({cacheDir:'node_modules/.vite-ride',plugins:[{name:'qa-controller',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameController();','window.boardQA = new GameController();');
}}],server:{host:'127.0.0.1',port:5194,strictPort:true}});
await server.listen();
let browser;
const results={};
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [size,width,height,vehicle,count] of [['mobile',390,844,'MOTOR',2],['desktop',1440,900,'CAR',3]]){
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setViewport({width,height,isMobile:size==='mobile',hasTouch:size==='mobile'});
    await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
    await page.goto('http://127.0.0.1:5194/');
    await page.waitForFunction(()=>window.boardQA);
    const state=new GameState({seed:64});
    state.setupGame([7,1,2,3].map((profileIndex,i)=>({name:['阿岚','小海','星星','船长'][i],profileIndex,isAI:i>0})),60000,{mapId:'grand-bay'});
    state.players[0].vehicle=vehicle;state.players[0].selectedDiceCount=count;state.players[0].currentTile=1;
    await page.evaluate(s=>boardQA.restoreGame(s),state.createSnapshot());
    await page.waitForFunction(()=>boardQA.pawnManager.pawns[0].ride && boardQA.pawnManager.pawns[0].skin && document.querySelector('#game-container').dataset.harborArt==='ready');
    const clear=await page.evaluate(boardClearance);
    const target=await page.evaluate(()=>{
      const scene=boardQA.scene3D;
      scene.camera.updateMatrixWorld();
      const p=boardQA.boardBuilder.tilePositions[3].clone().project(scene.camera);
      const x=(1+p.x)*innerWidth/2,y=(1-p.y)*innerHeight/2;
      return {x,y,element:document.elementFromPoint(x,y)?.tagName};
    });
    const inspectable=target.element==='CANVAS';
    if(inspectable){
      if(size==='mobile')await page.touchscreen.tap(target.x,target.y);else await page.mouse.move(target.x,target.y);
    }
    await new Promise(resolve=>setTimeout(resolve,500));
    const info=await page.evaluate(()=>({hover:document.querySelector('.board-tip').hidden?null:document.querySelector('.board-tip').textContent,clip:boardQA.pawnManager.pawns[0].skin.name,wheels:boardQA.pawnManager.pawns[0].wheels.length,count:Number(document.querySelector('#dice-count-select').value)}));
    await page.screenshot({path:`qa/review/ride-${size}.png`});
    if(size==='mobile')await page.tap('#btn-roll');else await page.click('#btn-roll');
    await page.waitForFunction(()=>boardQA.gameState.players[0].currentTile!==1);
    results[size]={clear,vehicle,target,...info,rolled:true,errors};
    console.log(size,JSON.stringify(results[size]));
    assert.equal(info.clip,'Ride');
    assert.equal(info.wheels,count===2?2:4);
    assert.equal(info.count,count);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  await writeFile('qa/review/ride-checks.json',JSON.stringify(results,null,2)+'\n');
}finally{await browser?.close();await server.close();}
