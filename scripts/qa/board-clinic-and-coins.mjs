import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';

const server=await createServer({cacheDir:'node_modules/.vite-roster',plugins:[{name:'qa-controller',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameController();','window.boardQA = new GameController();');
}}],server:{host:'127.0.0.1',port:5203,strictPort:true,hmr:false,watch:null}});
await server.listen();
let browser;
const results={};
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--autoplay-policy=no-user-gesture-required','--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for (const size of ['mobile','desktop']) {
    if (process.argv[2] && process.argv[2]!==size) continue;
    const mobile=size==='mobile';
    const [width,height]=mobile?[390,844]:[1440,900];
    const cast=[12,13];
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setViewport({width,height,isMobile:size==='mobile',hasTouch:size==='mobile'});
    await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
    await page.goto('http://127.0.0.1:5203/');
    await page.waitForFunction(()=>window.boardQA);
    const state=new GameState({seed:64});
    state.setupGame(cast.map(profileIndex=>({profileIndex,isAI:false})),60000,{mapId:'grand-bay'});
    const tile=state.mapDefinition.tiles.find(t=>t.minigameId==='SKY_COINS');
    state.players[0].currentTile=mobile?tile.id-1:0;
    state.players[0].moveLimitThisTurn=1;
    state.boardGods=[];
    if(!mobile)state.propertyManager.getProperty(1).hasMine=true;
    await page.evaluate(snapshot=>boardQA.restoreGame(snapshot),state.createSnapshot());
    await page.waitForFunction(()=>boardQA.pawnManager.pawns.every(p=>p.skin) && document.querySelector('#game-container').dataset.harborArt==='ready');
    const result=results[size]={};
    if(mobile){
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
      await page.screenshot({path:'qa/review/coin-challenge-touch.png'});
      await press('.minigame-skip');
      await page.waitForSelector('.minigame-claim',{visible:true});
      const reward=await page.$eval('.minigame-claim',el=>Number(el.textContent.match(/\d+/)[0]));
      const box=await page.$eval('.minigame-claim',el=>el.getBoundingClientRect().toJSON());
      assert.ok(box.height>=44 && box.x>=0 && box.right<=width && box.bottom<=height);
      const before=await page.evaluate(()=>boardQA.gameState.players[0].cardPoints);

      await press('.minigame-claim');
      await page.waitForFunction(value=>window.arcadeReward===value,{},reward);
      assert.ok(await page.evaluate(()=>boardQA.gameState.players[0].cardPoints)>=before+reward);
      result.reward=reward;
    } else {
      // Observe the actual rendered frames so a short arrival cannot be missed on slow WebGL.
      await page.evaluate(()=>{
        const app=boardQA, view=app.scene3D, renderer=view.renderer;
        const draw=renderer.render.bind(renderer);
        window.transport={phases:[], frames:{}, points:[],returned:false};
        renderer.render=(scene,camera)=>{
          draw(scene,camera);
          const van=scene.getObjectByName('clinic-pickup');
          if(!van){
            if(transport.phases.includes('arrive')){
              transport.returned=view.followedObject==null && app.pawnManager.pawns[0].mesh.visible;
              renderer.render=draw;
            }
            return;
          }
          const phase=van.userData.phase;
          if(transport.phases.at(-1)!==phase) transport.phases.push(phase);
          if(phase==='drive'||phase==='arrive'){
            transport.points.push([van.position.x,van.position.z]);
            if(!transport.frames[phase] && van.getObjectByName('clinic-passenger').visible)
              transport.frames[phase]=renderer.domElement.toDataURL();
          }
        };
      });
      await page.click('#btn-roll');
      await page.waitForFunction(()=>window.transport.returned,{timeout:60000});
      const data=await page.evaluate(()=>{
        const app=boardQA, patient=app.gameState.players[0];
        const clinics=app.gameState.mapDefinition.tiles.filter(t=>t.type==='HOSPITAL');
        const [x,z]=transport.points.at(-1);
        const nearest=clinics.map(t=>({id:t.id,distance:Math.hypot(t.position.x-x,t.position.z-z)})).sort((a,b)=>a.distance-b.distance)[0];
        return {...transport,nearest,hospital:patient.hospitalTurns,tile:patient.currentTile};
      });
      assert.equal(data.tile,1);assert.ok(data.hospital>0 && data.nearest.distance<3.5);
      assert.ok(data.phases.includes('board') && data.phases.includes('drive'));
      for(const [phase,png] of Object.entries(data.frames))
        await writeFile('qa/review/clinic-'+phase+'.png',Buffer.from(png.split(',')[1],'base64'));
      Object.assign(result,{phases:data.phases,hospital:data.hospital,tile:data.tile,nearest:data.nearest,returned:data.returned});
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
  await writeFile(process.argv[2] ? '/tmp/clinic-'+process.argv[2]+'-checks.json' : 'qa/review/clinic-and-coins.json',JSON.stringify(results,null,2)+'\n');
}finally{await browser?.close();await server.close();}
