import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';
import {boardClearance,boardHudFraction} from './board-clearance.mjs';

const server=await createServer({cacheDir:'node_modules/.vite-roster',plugins:[{name:'qa-controller',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameController();','window.boardQA = new GameController();');
}}],server:{host:'127.0.0.1',port:5203,strictPort:true}});
await server.listen();
let browser;
const results={};
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--autoplay-policy=no-user-gesture-required','--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [size,width,height,cast] of [['desktop',1440,900,[8,9,10,11]],['mobile',390,844,[12,13,14,15]]]){
    if (process.argv[2] && process.argv[2] !== size) continue;
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setViewport({width,height,isMobile:size==='mobile',hasTouch:size==='mobile'});
    await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
    await page.goto('http://127.0.0.1:5203/');
    await page.waitForFunction(()=>window.boardQA);
    const state=new GameState({seed:64});
    state.setupGame(cast.map(profileIndex=>({profileIndex,isAI:false})),60000,{mapId:'grand-bay'});
    state.newsHistory=[{round:1,category:'城市',title:'海港周末市集开张',desc:'沿港步行街本周增设十个摊位，市民可以搭乘渡轮到场。'}];
    const tile=state.mapDefinition.tiles.find(t=>t.minigameId==='SKY_COINS');
    state.players.forEach((p,i)=>p.currentTile=tile.id-1+i);
    state.players[0].moveLimitThisTurn=1;
    await page.evaluate(snapshot=>boardQA.restoreGame(snapshot),state.createSnapshot());
    await page.waitForFunction(()=>boardQA.pawnManager.pawns.every(p=>p.skin?.actions.size===7));
    await page.waitForFunction(()=>boardQA.boardBuilder.specialTileMeshes.get(62)?.children.length && document.querySelector('#game-container').dataset.harborArt==='ready');
    const result=results[size]={models:await page.evaluate(()=>boardQA.pawnManager.pawns.map(p=>p.skin.model)),clearance:await page.evaluate(boardClearance),hud:await page.evaluate(boardHudFraction)};
    result.news=await page.$eval('#btn-news-history',el=>({visible:el.getBoundingClientRect().height>0,headline:el.innerText}));
    if(size==='desktop')assert.ok(result.clearance>=.65 && result.hud<=.22);
    await page.screenshot({path:'qa/review/kite-festival-'+size+'.png'});
    {
      await page.evaluate(()=>boardQA.gameEngine.subscribe(event=>{
        if(event.type==='MINIGAME_COMPLETED')window.arcadeReward=event.reward;
      }));
      const press = selector => size==='mobile' ? page.tap(selector) : page.click(selector);
      await press('#btn-roll');
      await page.waitForSelector('.minigame-start',{visible:true,timeout:60000});
      await press('.minigame-start');
      await page.waitForSelector('.sky-object.kind-coin',{visible:true});
      // Moving targets can escape between a touch down and its synthesized click.
      for (let attempt=0;attempt<8;attempt++) {
        const point=await page.evaluate(()=>{
          const coin=[...document.querySelectorAll('.sky-object.kind-coin')].at(-1);
          if (!coin) return null;
          const r=coin.getBoundingClientRect();
          return {x:r.x+r.width/2,y:r.y+r.height/2};
        });
        if (point) {
          if(size==='mobile')await page.touchscreen.tap(point.x,point.y);
          else await page.mouse.click(point.x,point.y);
        }
        if(await page.$eval('.minigame-score span',el=>Number(el.textContent)>0)) break;
        await new Promise(resolve=>setTimeout(resolve,140));
      }
      await page.waitForFunction(()=>Number(document.querySelector('.minigame-score span')?.textContent)>0);
      await press('.minigame-skip');
      const reward=await page.$eval('.minigame-claim',el=>Number(el.textContent.match(/\d+/)[0]));
      const box=await page.$eval('.minigame-claim',el=>el.getBoundingClientRect().toJSON());
      assert.ok(box.height>=44 && box.x>=0 && box.right<=width && box.bottom<=height);
      const before=await page.evaluate(()=>boardQA.gameState.players[0].cardPoints);
      await page.screenshot({path:'qa/review/kite-festival-reward-'+size+'.png'});
      await press('.minigame-claim');
      await page.waitForFunction(value=>window.arcadeReward===value,{},reward);
      assert.ok(await page.evaluate(()=>boardQA.gameState.players[0].cardPoints)>=before+reward);
      result.reward=reward;
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
  await writeFile('qa/review/kite-festival-'+(process.argv[2]||'both')+'-checks.json',JSON.stringify(results,null,2)+'\n');
}finally{await browser?.close();await server.close();}
