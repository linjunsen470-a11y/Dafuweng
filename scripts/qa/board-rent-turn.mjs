import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';

const server=await createServer({plugins:[{name:'qa-controller',transform(code,id){
  if(id.endsWith('/src/main.js')) return code.replace('new GameController();','window.boardQA = new GameController();');
}}],server:{host:'127.0.0.1',port:5199,strictPort:true,hmr:false,watch:null}});
await server.listen();
let browser;
const mobileOnly=process.argv.includes('--mobile');
const results=mobileOnly?JSON.parse(await readFile('qa/review/m5-rent-turn-checks.json','utf8')):{};
try {
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [size,width,height] of [['desktop',1440,900],['mobile',390,844]]){
    if(mobileOnly && size==='desktop')continue;
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setViewport({width,height,isMobile:size==='mobile',hasTouch:size==='mobile'});
    await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
    await page.goto('http://127.0.0.1:5199/');
    await page.waitForFunction(()=>window.boardQA);
    const state=new GameState({seed:5});
    state.setupGame([{profileIndex:0,name:'小满',isAI:false},{profileIndex:7,name:'阿飞',isAI:true}],80000,{mapId:'grand-bay'});
    state.players[0].vehicle='CAR';state.players[0].selectedDiceCount=3;
    state.boardGods=[];
    for(const id of [3,6,8]) {state.propertyManager.buyProperty(id,1);state.propertyManager.getProperty(id).level=4;}
    await page.evaluate(s=>boardQA.restoreGame(s),state.createSnapshot());
    await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');
    const press=sel=>size==='mobile'?page.tap(sel):page.click(sel);
    if(size==='mobile')await press('#btn-mobile-tools');
    await press('#btn-pause-game');
    await page.select('#ai-pace','skip');await press('#btn-resume-game');
    await page.evaluate(()=>{
      window.rentEvents=[];
      boardQA.gameEngine.subscribe(event=>rentEvents.push({type:event.type,amount:event.amount,chain:event.chainSize,id:event.tileId}));
    });
    if(size==='desktop') await page.evaluate(()=>{
      const {renderer}=boardQA.scene3D, render=renderer.render.bind(renderer);
      renderer.render=(...args)=>{
        render(...args);
        if(boardQA.dice3D.dice.every(d=>d.visible) && !window.diceFrame) {
          window.diceFrame=renderer.domElement.toDataURL();
          renderer.render=render;
        }
      };
    });
    await press('#btn-roll');
    await page.waitForFunction(()=>boardQA.dice3D.dice.filter(d=>d.visible).length===3);
    if(size==='desktop') {
      await page.waitForFunction(()=>window.diceFrame);
      const data=await page.evaluate(()=>window.diceFrame.split(',')[1]);
      await writeFile('qa/review/m5-three-dice.png',Buffer.from(data,'base64'));
    }
    await page.waitForFunction(()=>rentEvents.some(e=>e.type==='RENT_PAID'),{timeout:90000});
    if(size==='mobile') await page.screenshot({path:'qa/review/m5-rent-turn-mobile.png'});
    await page.waitForFunction(()=>boardQA.gameState.round>=2 && boardQA.gameState.currentPlayerIndex===0,{timeout:90000});
    const info=await page.evaluate(()=>({rent:rentEvents.find(e=>e.type==='RENT_PAID'),round:boardQA.gameState.round,
      humanSpeed:boardQA.actionSpeed,aiPace:boardQA.aiPace,bands:boardQA.boardBuilder.streetBands.children.length}));
    assert.equal(info.rent.chain,3);
    assert.equal(info.rent.id,8);
    assert.equal(info.humanSpeed,1);
    assert.ok(info.bands>=2);
    assert.deepEqual(errors,[]);
    results[size]={...info,errors};
    await page.close();
  }
  await writeFile('qa/review/m5-rent-turn-checks.json',JSON.stringify(results,null,2)+'\n');
} finally {await browser?.close();await server.close();}
