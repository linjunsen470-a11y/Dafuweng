import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';

// Only the seed and read-only controller access differ from the normal new-game entry.
const server=await createServer({plugins:[{name:'observe-opening',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameState();','new GameState({seed:Number(location.hash.slice(1))||64});').replace('new GameController();','window.boardQA=new GameController();');
}}],server:{host:'127.0.0.1',port:5252,strictPort:true,watch:null,hmr:false}});
await server.listen();
let browser;
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  const phase=process.argv[2]||'after';
  await page.evaluateOnNewDocument(()=>{if(location.protocol==='http:')localStorage.setItem('fortune-empire:tutorial-seen','1');});
  const maps=phase==='before'||process.argv.includes('--island')?['island-fork']:['island-fork','taiwan-loop','city-loop','fortune-crossroads','grand-bay'];
  for(const map of maps){
    await page.goto('http://127.0.0.1:5252/?view='+map+'#4');await page.waitForSelector('#start-game-btn',{visible:true});await page.select('#map-select',map);
    await page.click('#start-game-btn');await page.waitForSelector('#btn-roll',{visible:true});
    await page.screenshot({path:'/tmp/bend-'+phase+'-'+map+'-open.jpg'});
    if(map==='island-fork'){
      await page.evaluate(()=>boardQA.showPlayerStreet(7));
      await page.screenshot({path:'/tmp/bend-'+phase+'-fork.jpg'});
    }
  }
  await page.setViewport({width:390,height:844,hasTouch:true,isMobile:true});
  await page.goto('http://127.0.0.1:5252/?view=touch#4');await page.select('#map-select','island-fork');await page.tap('#start-game-btn');
  await page.waitForFunction(()=>boardQA.pawnManager.pawns.length===4 && boardQA.pawnManager.pawns.every(p=>p.skin));
  await page.screenshot({path:'/tmp/bend-'+phase+'-phone.jpg'});
  // Hold only the start of the second visual hop so a slow GPU cannot capture the later deed.
  await page.evaluate(()=>{
    const pawns=boardQA.pawnManager,step=pawns.animatePlayerStep.bind(pawns);
    let calls=0;
    pawns.animatePlayerStep=async(...args)=>{
      if(++calls===2)await new Promise(resolve=>{window.releaseCapturedHop=resolve;});
      return step(...args);
    };
  });
  await page.tap('#btn-roll');
  await page.waitForFunction(()=>typeof window.releaseCapturedHop==='function',{timeout:60000});
  await page.screenshot({path:'/tmp/bend-'+phase+'-walk.jpg'});
  await page.evaluate(()=>window.releaseCapturedHop());
  await page.waitForSelector('#btn-land-buy',{visible:true,timeout:60000});
  const receipt=await page.evaluate(()=>{const player=boardQA.gameState.players[0];return {id:player.currentTile,before:player.cash};});
  await page.screenshot({path:'/tmp/bend-'+phase+'-deed.jpg'});
  await page.tap('#btn-land-buy');
  await page.waitForFunction(id=>boardQA.gameState.propertyManager.getProperty(id)?.owner===0,{},receipt.id);
  receipt.after=await page.evaluate(()=>boardQA.gameState.players[0].cash);
  assert.ok(receipt.after<receipt.before);assert.deepEqual(errors,[]);console.log(JSON.stringify(receipt));
}finally{await browser?.close();await server.close();}
