import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';

const server=await createServer({plugins:[{name:'qa-controller',transform(code,id){
  if(id.endsWith('/src/main.js')) return code.replace('new GameController();','window.boardQA = new GameController();');
}}],server:{host:'127.0.0.1',port:5201,strictPort:true,hmr:false,watch:null}});
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
    await page.goto('http://127.0.0.1:5201/');
    await page.waitForFunction(()=>window.boardQA);
    const state=new GameState({seed:64});
    state.setupGame([0,1].map(profileIndex=>({name:['小满','田野'][profileIndex],profileIndex,isAI:false})),80000,{mapId:'grand-bay'});
    state.players[0].currentTile=12;
    state.players[0].cards=['RED_BULL','BEAR_CARD'];
    state.players[0].stocks.TECH={shares:10,avgPrice:100};
    state.boardGods=[];
    await page.evaluate(s=>boardQA.restoreGame(s),state.createSnapshot());
    await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');
    const press=async sel=>{
      await page.waitForSelector(sel,{visible:true});
      if(size==='mobile')await page.tap(sel);else await page.click(sel);
    };
    const before=await page.evaluate(()=>boardQA.gameState.stockMarket.stocks[0].price);
    const card=size==='desktop'?'RED_BULL':'BEAR_CARD';
    await press('#btn-use-card');
    await press(`[data-entry-key="CARD:${card}"] .strategy-primary`);
    await press('.target-choice');
    await page.waitForFunction(()=>document.querySelector('#stock-price-impact').textContent.includes('持仓市值变化'));
    const after=await page.evaluate(()=>boardQA.gameState.stockMarket.stocks[0].price);
    assert.equal(after,Math.round(before*(size==='desktop'?1.1:.9)));
    await press('#stock-chart-mode');
    assert.equal(await page.$eval('#stock-chart-mode',el=>el.getAttribute('aria-pressed')),'true');
    await press('[data-stock-order="buy"][data-fraction="0.5"]');
    const bought=await page.$eval('#stock-holding-count',el=>Number(el.textContent));
    assert.ok(bought>10);
    if(size==='desktop') await page.screenshot({path:'qa/review/m5-market-card.png'});
    await press('[data-stock-order="sell"][data-fraction="1"]');
    assert.equal(await page.$eval('#stock-holding-count',el=>Number(el.textContent)),0);
    await press('#stock-modal-close');
    await press('#btn-roll');
    await page.waitForSelector('.route-target-bar',{visible:true,timeout:60000});
    const id=84;
    const point=await page.evaluate(id=>{
      const p=boardQA.boardBuilder.tilePositions[id].clone();
      p.y+=.26;p.project(boardQA.scene3D.camera);
      return {x:(1+p.x)*innerWidth/2,y:(1-p.y)*innerHeight/2};
    },id);
    if(size==='mobile')await page.screenshot({path:'qa/review/m5-fork-mobile.png'});
    if(size==='desktop')await page.mouse.click(point.x,point.y);else await page.touchscreen.tap(point.x,point.y);
    await page.waitForFunction(()=>boardQA.gameState.players[0].currentTile===84 || boardQA.gameState.pendingMove?.path.includes(84));
    assert.deepEqual(errors,[]);
    results[size]={card,before,after,bought,afterSale:0,branch:id,errors};
    if(size==='desktop'){
      state.players[0].cards=['TRANSFER_CARD','MISSILE'];
      state.players[0].currentTile=3;
      state.players[1].currentTile=4;
      await page.evaluate(s=>boardQA.restoreGame(s),state.createSnapshot());
      await page.waitForFunction(()=>boardQA.pawnManager.pawns[1]?.skin?.figure);
      const pickup=await page.evaluate(()=>{
        const [caster,victim]=boardQA.gameState.players;
        const use=(cardId,targetId)=>boardQA.gameEngine.execute({type:'USE_CARD',playerId:caster.id,payload:{cardId,targetId}});
        use('TRANSFER_CARD',victim.id);
        const result=use('MISSILE',caster.currentTile);
        return result.events.filter(event=>event.type==='CLINIC_PICKUP');
      });
      assert.ok(pickup.some(event=>event.playerId===1 && event.tileId===4));
      await page.waitForFunction(()=>boardQA.scene3D.scene.children.some(node=>node.name==='clinic-pickup'));
      results.desktop.pickup=pickup;
      assert.deepEqual(errors,[]);
    }
    await page.close();
  }
  await writeFile('qa/review/m5-fork-market-checks.json',JSON.stringify(results,null,2)+'\n');
} finally {await browser?.close();await server.close();}
