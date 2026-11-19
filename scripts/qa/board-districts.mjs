import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';

const server=await createServer({plugins:[{name:'qa-controller',transform(code,id){
  if(id.endsWith('/src/main.js')) return code.replace('new GameController();','window.boardQA = new GameController();');
}}],server:{host:'127.0.0.1',port:5198,strictPort:true,hmr:false,watch:null}});
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
    await page.goto('http://127.0.0.1:5198/');
    await page.waitForFunction(()=>window.boardQA);
    const state=new GameState({seed:64});
    state.setupGame([0,1].map(profileIndex=>({name:['小满','田野'][profileIndex],profileIndex,isAI:false})),80000,{mapId:'grand-bay'});
    const tileId=size==='desktop'?34:102;
    state.players[0].currentTile=tileId;
    await page.evaluate(s=>boardQA.restoreGame(s),state.createSnapshot());
    await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');
    const press=sel=>size==='mobile'?page.tap(sel):page.click(sel);
    if(size==='mobile') await press('#btn-mobile-tools');
    await press('#btn-weather');
    if(size==='desktop') { await press('#btn-time-of-day');await press('#btn-time-of-day'); }
    else { await press('#btn-mobile-tools');await press('#btn-weather'); }
    if(size==='desktop' && process.argv.includes('--plaza')) {
      const next=state.createSnapshot();next.players[0].currentTile=59;
      await page.evaluate(snapshot=>boardQA.restoreGame(snapshot),next);
      await page.waitForFunction(()=>boardQA.scene3D.scene.getObjectByName('district-frontages'));
      await page.screenshot({path:'qa/review/m4-business-square.png'});
      await page.close();
      break;
    }
    const point=await page.evaluate(id=>{
      const p=boardQA.boardBuilder.tilePositions[id].clone().project(boardQA.scene3D.camera);
      return {x:(1+p.x)*innerWidth/2,y:(1-p.y)*innerHeight/2};
    },tileId);
    if(size==='desktop')await page.mouse.move(point.x,point.y);else await page.touchscreen.tap(point.x,point.y);
    await page.waitForFunction(()=>!document.querySelector('.board-tip').hidden);
    const info=await page.evaluate(()=>{
      const view=boardQA.scene3D;
      return {tile:document.querySelector('.board-tip').textContent,weather:view.weather,time:view.timeOfDay,
        frontages:!!view.scene.getObjectByName('district-frontages'),precipitation:view.precipitation.geometry.attributes.position.count};
    });
    assert.ok(info.frontages && info.precipitation>0);
    assert.equal(info.weather,size==='desktop'?'RAIN':'SNOW');
    assert.equal(info.time,size==='desktop'?'NIGHT':'DAY');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`qa/review/m4-district-${size}.png`});
    results[size]={...info,errors};
    await page.close();
  }
  if(!process.argv.includes('--plaza')) await writeFile('qa/review/m4-district-checks.json',JSON.stringify(results,null,2)+'\n');
} finally {await browser?.close();await server.close();}
