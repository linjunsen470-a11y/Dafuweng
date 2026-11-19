// Capture actual rule events from deliberately prepared one-step situations.
import {boardClearance} from './board-clearance.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';

const server=await createServer({cacheDir:'node_modules/.vite-board-events',plugins:[{name:'inspect-controller',transform(code,id){
  if(id.endsWith('/src/main.js')) return code.replace('new GameController();','window.boardQA = new GameController();');
}}],server:{host:'127.0.0.1',port:5193,strictPort:true}});
await server.listen();
let browser;
const results=[];
try {
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',protocolTimeout:180000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [size,width,height] of [['desktop',1440,900],['mobile',390,844]]) {
    for(const event of ['rent','mine']){
      const page=await browser.newPage();
      await page.setViewport({width,height,isMobile:size==='mobile',hasTouch:size==='mobile'});
      await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
      await page.goto('http://127.0.0.1:5193/');
      await page.waitForFunction(()=>window.boardQA);
      const state=new GameState({seed:64});
      state.setupGame([0,1].map((profileIndex,i)=>({name:['阿岚','小海'][i],profileIndex,isAI:i>0})),60000,{mapId:'grand-bay'});
      state.players[0].moveLimitThisTurn=1;
      state.players.forEach(p=>p.godType=null);
      state.boardGods=[];
      const property=state.propertyManager.getProperty(1);
      if(event==='rent'){property.owner=1;property.level=2;}else property.hasMine=true;
      await page.evaluate(snapshot=>boardQA.restoreGame(snapshot),state.createSnapshot());
      await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');
      const centerFree=await page.evaluate(boardClearance);
      const initial=state.players.map(p=>p.cash);
      if(size==='mobile') await page.tap('#btn-roll');else await page.click('#btn-roll');
      await page.waitForFunction((event,ownerCash)=>event==='rent'?boardQA.gameState.players[1].cash>ownerCash:boardQA.gameState.players[0].hospitalTurns>0,{timeout:90000},event,initial[1]);
      const result=await page.evaluate(()=>({position:boardQA.gameState.players[0].currentTile,cash:boardQA.gameState.players.map(p=>p.cash),hospitalTurns:boardQA.gameState.players[0].hospitalTurns,log:boardQA.gameState.logHistory.slice(-3)}));
      if(event==='rent')assert.equal(initial[0]-result.cash[0],result.cash[1]-initial[1]);
      await page.screenshot({path:`qa/review/${event}-${size}.png`});
      results.push({size,event,centerFree,initial,...result});
      await page.close();
    }
  }
  await writeFile('qa/review/board-events.json',JSON.stringify(results,null,2)+'\n');
}finally{await browser?.close();await server.close();}
