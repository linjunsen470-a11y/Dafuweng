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
    const result=results[size]={models:await page.evaluate(()=>boardQA.pawnManager.pawns.map(p=>p.skin.model)),clearance:await page.evaluate(boardClearance),hud:await page.evaluate(boardHudFraction)};
    result.news=await page.$eval('#btn-news-history',el=>({visible:el.getBoundingClientRect().height>0,headline:el.innerText}));
    if(size==='desktop')assert.ok(result.clearance>=.65 && result.hud<=.22);
    await page.screenshot({path:'qa/review/second-cast-'+size+'.png'});
    if(size==='desktop'){
      await page.evaluate(()=>{
        const a=boardQA.audioManager;if(a.muted)a.toggleMute();a.stopMusic();a.playMapTheme('grand-bay');
        window.levels=[];
        const taps=[a.musicGain,a.sfxGain,a.masterCompressor].map(bus=>{const tap=a.ctx.createAnalyser();tap.fftSize=2048;bus.connect(tap);return tap;});
        window.sampleTimer=setInterval(()=>{
          const peaks=taps.map(t=>{const samples=new Float32Array(t.fftSize);t.getFloatTimeDomainData(samples);return Math.max(...samples.map(Math.abs));});
          levels.push({bar:a.musicBar,peaks});
        },40);
      });
      await page.evaluate(()=>boardQA.gameEngine.subscribe(event=>{
        if(event.type==='MINIGAME_COMPLETED')window.arcadeReward=event.reward;
      }));
      await page.click('#btn-roll');
      await page.waitForSelector('.minigame-start',{visible:true,timeout:60000});
      await page.click('.minigame-start');
      await page.waitForSelector('.sky-object.kind-coin',{visible:true});
      await page.click('.sky-object.kind-coin');
      await page.waitForFunction(()=>Number(document.querySelector('.minigame-score span')?.textContent)>0);
      await page.click('.minigame-skip');
      const reward=await page.$eval('.minigame-claim',el=>Number(el.textContent.match(/\d+/)[0]));
      const before=await page.evaluate(()=>boardQA.gameState.players[0].cardPoints);
      await page.screenshot({path:'qa/review/second-cast-arcade.png'});
      await page.click('.minigame-claim');
      await page.waitForFunction(value=>window.arcadeReward===value,{},reward);
      assert.ok(await page.evaluate(()=>boardQA.gameState.players[0].cardPoints)>=before+reward);
      result.reward=reward;
      await page.waitForFunction(()=>levels.some(row=>row.bar>=5));
      result.audio=await page.evaluate(()=>{
        clearInterval(sampleTimer);
        return {peak:['music','effects','mix'].map((_,i)=>Math.max(...levels.map(row=>row.peaks[i]))),
          barPeaks:[1,2,3,4,5].map(bar=>Math.max(0,...levels.filter(row=>row.bar===bar).map(row=>row.peaks[0])))};
      });
      assert.ok(result.audio.peak.every(n=>n>0 && n<1));
      assert.ok(result.audio.barPeaks.every(n=>n>0));
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
  await writeFile('qa/review/second-cast-checks.json',JSON.stringify(results,null,2)+'\n');
}finally{await browser?.close();await server.close();}
