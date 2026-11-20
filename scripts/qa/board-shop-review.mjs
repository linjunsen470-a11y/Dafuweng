import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';

// Only the seed and read-only controller access differ from the normal new-game entry.
const server=await createServer({plugins:[{name:'observe-opening',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameState();','new GameState({seed:Number(location.hash.slice(1))||64});').replace('new GameController();','window.boardQA=new GameController();');
}}],server:{host:'127.0.0.1',port:5269,strictPort:true,watch:null,hmr:false}});
await server.listen();
let browser;
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  const phase=process.argv[2]||'after';
  await page.evaluateOnNewDocument(()=>{if(location.protocol==='http:')localStorage.setItem('fortune-empire:tutorial-seen','1');});
  for(const map of ['island-fork','taiwan-loop']){
    const mobile=map==='island-fork';
    await page.setViewport(mobile?{width:390,height:844,isMobile:true,hasTouch:true}:{width:1440,height:900});
    await page.goto('http://127.0.0.1:5269/?map='+map+'#4');
    await page.select('#map-select',map);
    const press=selector=>mobile?page.tap(selector):page.click(selector);
    await press('#start-game-btn');
    await page.waitForFunction(()=>boardQA.pawnManager.pawns.length===4 && boardQA.pawnManager.pawns.every(p=>p.skin));
    await page.screenshot({path:'/tmp/door-'+phase+'-'+map+'.jpg'});
    await page.evaluate(()=>boardQA.showPlayerStreet(2));
    await page.screenshot({path:'/tmp/door-'+phase+'-'+map+'-shop.jpg'});
    await page.evaluate(()=>boardQA.showPlayerStreet(0));
    const record=phase==='after' && mobile?await page.screencast({path:'/tmp/door-transaction.webm',fps:12}):null;
    try{
      await press('#btn-roll');
      await page.waitForSelector('#btn-land-buy',{visible:true,timeout:90000});
      const read=()=>page.evaluate(()=>{const s=boardQA.gameState,p=s.players[0];return {id:p.currentTile,cash:p.cash,owner:s.propertyManager.getProperty(p.currentTile)?.owner};});
      const before=await read();
      await press('#btn-land-buy');
      await page.waitForFunction(id=>boardQA.gameState.propertyManager.getProperty(id)?.owner===0,{},before.id);
      const after=await read();assert.ok(after.cash<before.cash);console.log(JSON.stringify({map,before,after}));
      await page.screenshot({path:'/tmp/door-'+phase+'-'+map+'-paid.jpg'});
    }finally{await record?.stop();}
  }
  assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
