import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
// Record Chrome's displayed frames and their presentation times. Encoding after play
// avoids competing with software WebGL while the camera is following the pawn.
async function recordTurn(page){
  const frames=[],session=await page.createCDPSession();
  session.on('Page.screencastFrame',event=>{
    frames.push({time:event.metadata.timestamp,data:event.data});
    void session.send('Page.screencastFrameAck',{sessionId:event.sessionId});
  });
  await session.send('Page.startScreencast',{format:'jpeg',quality:75,maxWidth:960,maxHeight:600});
  return async()=>{
    await session.send('Page.stopScreencast');await session.detach();
    assert.ok(frames.length>2);
    const temp=await mkdtemp('/tmp/street-film-'),list=[];
    try{
      for(const [index,frame] of frames.entries()){
        const name=index+'.jpg';
        await writeFile(temp+'/'+name,Buffer.from(frame.data,'base64'));
        list.push("file '"+name+"'");
        if(frames[index+1])list.push('duration '+Math.max(.015,frames[index+1].time-frame.time));
      }
      await writeFile(temp+'/frames.txt',list.join('\n'));
      execFileSync('ffmpeg',['-loglevel','error','-y','-f','concat','-safe','1','-i',temp+'/frames.txt','-vf','fps=12','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart','/tmp/street-turn.mp4']);
    }finally{await rm(temp,{recursive:true,force:true});}
  };
}
const before=process.argv.includes('--before'),phase=before?'before':'after';
const server=await createServer({plugins:[{name:'observe-turns',enforce:'pre',transform(code,id){
  if(before && id.endsWith('/src/engine/BoardBuilder.js'))return execFileSync('git',['show','3d982b5:src/engine/BoardBuilder.js'],{encoding:'utf8'});
  if(id.endsWith('/src/main.js'))return code.replace('new GameState();','new GameState({seed:1});').replace('new GameController();','window.boardQA=new GameController();');
}}],server:{host:'127.0.0.1',port:before?5285:5287,watch:null,hmr:false}});
await server.listen();
let browser;
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(()=>{if(location.protocol==='http:')localStorage.setItem('fortune-empire:tutorial-seen','1');});
  for(const map of (process.argv.includes('--coast-only')?['island-fork']:['fortune-crossroads','island-fork'])){
    const coast=map==='island-fork',stem='/tmp/turn-'+phase+'-'+map;
    await page.setViewport(coast?{width:390,height:844,isMobile:true,hasTouch:true}:{width:1440,height:900});
    await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:90000});await page.select('#map-select',map);
    const press=selector=>coast?page.tap(selector):page.click(selector);
    await press('#start-game-btn');
    await page.waitForFunction(()=>boardQA.pawnManager.pawns.length===4 && boardQA.pawnManager.pawns.every(p=>p.skin));
    await page.evaluate(()=>{
      const r=boardQA.scene3D.renderer,render=r.render;window.turnFrames={};
      r.render=function(...args){render.apply(this,args);const p=boardQA.pawnManager.pawns[0];
        if(p.mesh.userData.isMoving && !turnFrames[p.currentTile])
          turnFrames[p.currentTile]=this.domElement.toDataURL('image/jpeg',.82);
      };
    });
    const record=!before && !coast?await recordTurn(page):null;
    try{
      await press('#btn-roll');
      if(!coast){
        await page.waitForSelector('.route-target-bar',{visible:true,timeout:90000});
        await page.screenshot({path:stem+'-choice.jpg'});
        const xy=await page.evaluate(()=>{const p=boardQA.boardBuilder.tilePositions[6].clone();p.y+=.26;p.project(boardQA.scene3D.camera);return [(1+p.x)*innerWidth/2,(1-p.y)*innerHeight/2];});
        await page.mouse.click(...xy);await page.waitForSelector('#btn-land-buy',{visible:true,timeout:90000});
        await page.screenshot({path:stem+'-purchase.jpg'});
        await press('#btn-land-buy');await page.waitForFunction(()=>boardQA.gameState.propertyManager.getProperty(8).owner===0);
      }else await page.waitForFunction(()=>turnFrames[6],{timeout:90000});
      const frames=await page.evaluate(()=>window.turnFrames);
      console.log(map,Object.keys(frames));for(const [id,data] of Object.entries(frames))await writeFile(stem+'-'+id+'.jpg',Buffer.from(data.split(',')[1],'base64'));
      for(const id of coast?[2,4,6]:[3,6,7,8])assert.ok(frames[id]);
    }finally{await record?.();}
  }
  assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
