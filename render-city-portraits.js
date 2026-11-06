// Reproducible original portraits rendered from the actual main-game models.
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
const server=await createServer({plugins:[{name:'portrait-canvas',configureServer(s){s.middlewares.use('/__portraits',(_q,r)=>{r.setHeader('Content-Type','text/html');r.end('<!doctype html><title>Original city portraits</title>');});}}],server:{host:'127.0.0.1',port:5236,strictPort:true}});
await server.listen();
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5236/__portraits');
 const portraits=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {createCityCharacter,disposeCityCharacter}=await import('/src/engine/CityCharacters.js');
  const {PLAYER_PROFILES}=await import('/src/game/BoardData.js');
  const {CITY_CHARACTER_PROFILE_IDS}=await import('/src/engine/CityCharacterProfiles.js');
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(192,192);renderer.setClearColor(0,0);
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x75818c,2));const key=new THREE.DirectionalLight(0xffeed7,2);key.position.set(-3,5,5);scene.add(key);
  const camera=new THREE.OrthographicCamera(-.67,.67,.67,-.67,.1,20);camera.position.set(0,1.56,5);camera.lookAt(0,1.56,0);
  const images=[];for(const profile of PLAYER_PROFILES.filter(p=>CITY_CHARACTER_PROFILE_IDS.includes(p.id))){const model=createCityCharacter(profile);scene.add(model);renderer.render(scene,camera);images.push({id:profile.id,png:renderer.domElement.toDataURL('image/png').split(',')[1]});scene.remove(model);disposeCityCharacter(model);}renderer.dispose();return images;
 });
 await fs.mkdir('public/assets/city-portraits',{recursive:true});for(const {id:i,png} of portraits)await fs.writeFile(`public/assets/city-portraits/${i}.png`,Buffer.from(png,'base64'));
 console.log('Rendered supported original 192px portraits from CityCharacters.js');
}finally{await browser.close();await server.close();}
