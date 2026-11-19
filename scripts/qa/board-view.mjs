import {boardClearance} from './board-clearance.mjs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';
import {mkdir,writeFile} from 'node:fs/promises';

const label = process.argv[2] || 'after';
const server = await createServer({cacheDir:'node_modules/.vite-board-view',plugins:[{name:'capture-controller',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameController();','window.boardQA = new GameController();');
}}],server:{host:'127.0.0.1',port:5192,strictPort:true}});
await server.listen();
const results = {};
let browser;
try {
  browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  await mkdir('qa/review',{recursive:true});
  for(const [size,width,height] of [['desktop',1440,900],['mobile',390,844]]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await page.setViewport({width,height,isMobile:size==='mobile',hasTouch:size==='mobile'});
    await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
    await page.goto('http://127.0.0.1:5192/');
    await page.select('#map-select','grand-bay');
    await page.click('#start-game-btn');
    const state = new GameState({seed:64});
    state.setupGame([0,1,2,3].map((profileIndex,i)=>({name:['阿岚','小海','星星','船长'][i],profileIndex,isAI:i>0})),60000,{mapId:'grand-bay'});
    state.players[0].items=['BARRIER'];
    await page.evaluate(snapshot=>window.boardQA.restoreGame(snapshot),state.createSnapshot());
    await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');
    await new Promise(resolve=>setTimeout(resolve,2500));
    await page.screenshot({path:`qa/review/${label}-${size}.png`});
    if (label !== 'before') {
      const press = async selector => {
        await page.waitForSelector(selector,{visible:true});
        if (size === 'mobile') await page.tap(selector);
        else await page.click(selector);
      };
      const area = await page.evaluate(()=>{
        const rects = [...document.querySelectorAll('.hud-layer > :not(.hidden)')].map(el=>el.getBoundingClientRect()).filter(r=>r.width && r.height);
        const xs = [...new Set(rects.flatMap(r=>[r.left,r.right]))].sort((a,b)=>a-b);
        let sum = 0;
        for(let i=1;i<xs.length;i++){
          const intervals = rects.filter(r=>r.left<xs[i] && r.right>xs[i-1]).sort((a,b)=>a.top-b.top);
          let end = 0;
          for(const r of intervals){
            sum += (xs[i]-xs[i-1])*Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(end,r.top,0));
            end = Math.max(end,r.bottom);
          }
        }
        return sum/(innerWidth*innerHeight);
      });
      const centralClearFraction = await page.evaluate(boardClearance);
      results[size]={hudFraction:area,centralClearFraction};
      if(size==='mobile'){
        await press('#btn-mobile-tools');
        await press('#btn-map-overview');
        await press('#btn-mobile-tools');
        await press('#btn-follow-view');
      }
      // The mounted gameplay smoke checks direct inspection on both viewports.
      if(size==='desktop'){
        assert.ok(area<=.22,`HUD area ${area}`);
        assert.ok(centralClearFraction>=.65,`Center clearance ${centralClearFraction}`);
      }
      await press('#btn-use-card');
      await press('[data-entry-key="ITEM:BARRIER"] .strategy-primary');
      await page.waitForSelector('.board-target-bar');
      await page.screenshot({path:`qa/review/target-${size}.png`});
      const point = await page.evaluate(()=>{
        const game = window.boardQA;
        const p = game.boardBuilder.tilePositions[1].clone().project(game.scene3D.camera);
        return {x:(1+p.x)*innerWidth/2,y:(1-p.y)*innerHeight/2};
      });
      if(size==='mobile') await page.touchscreen.tap(point.x,point.y);
      else await page.mouse.click(point.x,point.y);
      await page.waitForFunction(()=>window.boardQA.gameState.roadEntities.some(e=>e.tileId===1 && e.type==='BARRIER'));
      await page.evaluate(()=>{
        const state=boardQA.gameState;
        state.players[0].cards.push('TURTLE');
        state.players[1].currentTile=2;
        boardQA.pawnManager.syncFromGameState(state);
        boardQA.uiRenderer.renderHUD();
      });
      await press('#btn-use-card');
      await press('[data-entry-key="CARD:TURTLE"] .strategy-primary');
      await page.waitForSelector('.board-target-bar');
      const pawn = await page.evaluate(()=>{
        const p=boardQA.pawnManager.getPawnMesh(1).position.clone();
        p.y+=1.1;
        p.project(boardQA.scene3D.camera);
        return {x:(1+p.x)*innerWidth/2,y:(1-p.y)*innerHeight/2};
      });
      if(size==='mobile') await page.touchscreen.tap(pawn.x,pawn.y);
      else await page.mouse.click(pawn.x,pawn.y);
      await page.waitForFunction(()=>boardQA.gameState.players[1].turtleTurns>0);
      for(const [open,close] of [['#btn-stock-market','#stock-modal-close'],['#btn-card-shop','#shop-modal-close']]){
        await press(open);
        await page.waitForSelector(close,{visible:true});
        await page.screenshot({path:`qa/review/${open.slice(5)}-${size}.png`});
        await press(close);
      }
      const snapshot = await page.evaluate(()=>{
        const snapshot = boardQA.gameState.createSnapshot();
        boardQA.gameEngine.saves.saveAuto(snapshot);
        return snapshot;
      });
      await page.reload();
      await press('#load-auto-save-btn');
      await page.waitForFunction(()=>window.boardQA?.gameState.players.length===4);
      const loaded = await page.evaluate(()=>boardQA.gameState.createSnapshot());
      for(const key of ['players','roadEntities','properties','rngState']) assert.deepEqual(loaded[key],snapshot[key]);
      await press('#btn-roll');
      await page.waitForFunction(()=>boardQA.gameState.players[0].currentTile!==0);
      assert.deepEqual(errors,[]);
      Object.assign(results[size],{barrierTile:1,turtlePlayer:1,saveVersion:loaded.version,rolled:true,pageErrors:errors});
    }
    await page.close();
  }
  if(label!=='before') await writeFile('qa/review/board-checks.json',JSON.stringify(results,null,2)+'\n');
} finally {await browser?.close();await server.close();}
