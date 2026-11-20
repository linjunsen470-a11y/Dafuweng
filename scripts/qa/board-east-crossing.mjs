import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';

// Capture the actual controller, picking, roll and follow camera from a reproducible saved turn.
const prefix='/tmp/east-'+(process.argv.includes('--before')?'before':'after');
const server=await createServer({plugins:[{name:'observe-board',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameController();','window.boardQA=new GameController();');
}}],server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
await server.listen();
let browser;
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const mobile of [false,true]){
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const tag=mobile?'touch':'desk';
    await page.setViewport(mobile?{width:390,height:844,isMobile:true,hasTouch:true}:{width:1440,height:900});
    await page.evaluateOnNewDocument(()=>{if(location.protocol==='http:')localStorage.setItem('fortune-empire:tutorial-seen','1');});
    await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(()=>window.boardQA);
    // Seed 7 yields 6+5+2 with the car. Seed 2 advances a walker two spaces.
    const state=new GameState({seed:mobile?2:7});
    state.setupGame([0,1,2,3].map(profileIndex=>({profileIndex,isAI:false})),80000,{mapId:'grand-bay'});
    const positions=mobile?[24,24,23,25]:[12,12,13,84];
    state.players.forEach((player,i)=>{player.currentTile=positions[i];});
    state.boardGods=[];
    if(!mobile)Object.assign(state.players[0],{vehicle:'CAR',selectedDiceCount:3});
    await page.evaluate(s=>boardQA.restoreGame(s),state.createSnapshot());
    await page.waitForFunction(()=>boardQA.pawnManager.pawns.length===4 && boardQA.pawnManager.pawns.every(p=>p.skin) && document.querySelector('#game-container').dataset.harborArt==='ready');
    await page.screenshot({path:prefix+'-'+tag+'-idle.jpg'});
    await page.evaluate(ids=>{
      window.watched={};window.followingAtMerge=false;const r=boardQA.scene3D.renderer,original=r.render;
      r.render=function(...args){original.apply(this,args);
        const p=boardQA.pawnManager.pawns[0];
        if(p.currentTile===24 && p.mesh.userData.isMoving && boardQA.scene3D.followedObject===p.mesh)window.followingAtMerge=true;
        if(ids.includes(p.currentTile) && !window.watched[p.currentTile])
          window.watched[p.currentTile]=this.domElement.toDataURL('image/jpeg',.88);
      };
    },mobile?[25,26]:[84,89,94,24]);
    if(mobile)await page.tap('#btn-roll');else{
      await page.click('#btn-roll');await page.waitForSelector('.route-target-bar',{visible:true,timeout:90000});
      await page.screenshot({path:prefix+'-choice.jpg'});
      const [x,y]=await page.evaluate(()=>{
        const p=boardQA.boardBuilder.tilePositions[84].clone();p.y+=.26;p.project(boardQA.scene3D.camera);
        return [(1+p.x)*innerWidth/2,(1-p.y)*innerHeight/2];
      });
      await page.mouse.click(x,y);
      await page.waitForSelector('.route-target-bar',{hidden:true,timeout:5000});
    }
    await page.waitForFunction(id=>boardQA.gameState.players[0].currentTile===id && !boardQA.pawnManager.pawns[0].mesh.userData.isMoving && !boardQA.gameState.pendingMove,{timeout:120000},mobile?26:24);
    const frames=await page.evaluate(()=>window.watched);
    for(const [id,frame] of Object.entries(frames))await writeFile(prefix+'-'+tag+'-'+id+'.jpg',Buffer.from(frame.split(',')[1],'base64'));
    await page.screenshot({path:prefix+'-'+tag+'-stop.jpg'});
    if(!mobile && !process.argv.includes('--before'))assert.ok(await page.evaluate(()=>window.followingAtMerge));
    if(mobile){
      await page.waitForSelector('#btn-land-buy',{visible:true});
      await page.tap('#btn-land-buy');
      await page.waitForFunction(()=>boardQA.gameState.propertyManager.getProperty(26).owner===0);
    }
    assert.deepEqual(errors,[]);console.log(tag,Object.keys(frames));await page.close();
  }
}finally{await browser?.close();await server.close();}
