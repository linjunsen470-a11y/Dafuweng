import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';

const phase=process.argv[2]||'after';
const server=await createServer({plugins:[{name:'read-game',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameState();','new GameState({seed:1});').replace('new GameController();','window.boardQA=new GameController();');
}}],server:{host:'127.0.0.1',port:0,strictPort:true,watch:null,hmr:false}});
await server.listen();
let browser;
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
  await page.setViewport({width:1440,height:900});
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(()=>window.boardQA);
  const shot=name=>page.screenshot({path:'/tmp/valley-'+phase+'-'+name+'.jpg'});
  if(!process.argv.includes('--tower-only')){
    await page.select('#map-select','fortune-crossroads');
    await page.click('#start-game-btn');
    await page.waitForFunction(()=>boardQA.pawnManager.pawns.length===4 && boardQA.pawnManager.pawns.every(p=>p.skin));
    await shot('opening');
    await page.click('#btn-roll');
    await page.waitForSelector('.route-target-bar',{visible:true,timeout:90000});
    await shot('fork');
    const point=await page.evaluate(()=>{
      const p=boardQA.boardBuilder.tilePositions[4].clone();p.y+=.26;p.project(boardQA.scene3D.camera);
      return [(1+p.x)*innerWidth/2,(1-p.y)*innerHeight/2];
    });
    await page.mouse.click(...point);
    await page.waitForSelector('#btn-land-buy',{visible:true,timeout:90000});
    const tile=await page.evaluate(()=>boardQA.gameState.players[0].currentTile);
    assert.equal(tile,8);await page.click('#btn-land-buy');
    await page.waitForFunction(()=>boardQA.gameState.propertyManager.getProperty(8).owner===0);
    console.log('Natural fork 3 -> 4 -> 5 -> 8; purchased 8');
  }
  const state=new GameState({seed:1});
  state.setupGame([0,1].map(profileIndex=>({name:'P'+profileIndex,profileIndex,isAI:false})),80000,{mapId:'city-loop'});
  state.players[0].currentTile=1;state.players[1].currentTile=13;
  for(const id of [1,3,5,7]){
    Object.assign(state.propertyManager.getProperty(id),{owner:1,level:5});
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.evaluate(s=>boardQA.restoreGame(s),state.createSnapshot());
  await page.waitForFunction(()=>boardQA.pawnManager.pawns.every(p=>p.skin) && boardQA.boardBuilder.buildingMeshes.get(3)?.userData.originalModel);
  await shot('tower');
  console.log('Fixture occluders',await page.evaluate(()=>[...boardQA.boardBuilder.buildingMeshes].filter(([,g])=>g.userData.isPawnOccluder).map(([i])=>i)));
  await page.evaluate(()=>{
    const app=boardQA,renderer=app.scene3D.renderer,render=renderer.render;
    renderer.render=function(...args){
      render.apply(this,args);
      const pawn=app.pawnManager.pawns[0];
      if(!pawn.mesh.userData.isMoving)return;
      const faded=[...app.boardBuilder.buildingMeshes].filter(([,g])=>g.userData.isPawnOccluder).map(([id])=>id);
      if(faded.length){
        window.towerEvidence={tile:pawn.currentTile,faded,frame:this.domElement.toDataURL('image/jpeg',.9)};
        this.render=render;
      }
    };
  });
  await page.tap('#btn-roll');
  await page.waitForFunction(()=>boardQA.gameState.players[0].currentTile!==1,{timeout:90000});
  await shot('tower-move');
  if(phase!=='before'){
    await page.waitForFunction(()=>window.towerEvidence,{timeout:15000});
    const {tile,faded,frame}=await page.evaluate(()=>window.towerEvidence);
    console.log('Walking fixture',tile,'faded',faded);
    await writeFile('/tmp/valley-'+phase+'-cutaway.jpg',Buffer.from(frame.split(',')[1],'base64'));
  }
  assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
