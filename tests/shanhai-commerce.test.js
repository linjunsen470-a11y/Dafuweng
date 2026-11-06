import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three-modern';
import {GLTFLoader} from 'three-modern/addons/loaders/GLTFLoader.js';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {chooseCoastBusiness} from '../src/shanhai/SliceCommerce.js';
import {residenceModel} from '../src/shanhai/SliceScenery.js';
const make=()=>{const s=new SliceSession({storage:null});s.start({seed:314});return s;};
const land=(s,tile)=>{s.currentPlayer.currentTile=tile;s.state.phase='LANDING_ACTION';s.resetPresentation();return s.resolveLanding();};
const stable=s=>{const snap=s.snapshot();delete snap.savedAt;return snap;};
const own=(s,tile,level=0,owner=0,type='RESIDENTIAL')=>{s.state.propertyManager.buyProperty(tile,owner,type);s.state.propertyManager.getProperty(tile).level=level;};
it('offers two real purchases at the same cost and preserves the legacy default',()=>{
 for(const type of ['MALL','PARK',undefined]){const s=make();land(s,12);const cash=s.currentPlayer.cash;expect(s.purchase(type).success).toBe(true);expect(s.currentPlayer.cash).toBe(cash-3200);expect(s.state.propertyManager.getProperty(12).buildingType).toBe(type||'MALL');expect(s.purchase(type).success).toBe(false);}
 const s=make();land(s,12);expect(s.purchase('HOTEL').success).toBe(false);expect(s.currentPlayer.cash).toBe(16000);
});
it('preview is read-only and matches real neighbor tolls, upgrades and rent ladder',()=>{
 const s=make();own(s,11,4);own(s,13,4);own(s,14,4);const before=stable(s),options=s.getCommerceOptions(12);expect(stable(s)).toEqual(before);
 expect(options[0].rentLadder).toEqual([472,945,1620,2565,4050]);expect(options[1].rentLadder).toEqual([0,0]);expect(options[1].neighbors.map(n=>n.tileId)).toEqual([11,13,14]);expect(options[1].nearbyIncrease).toBeGreaterThan(472*1.25);
 land(s,12);s.purchase('PARK');for(const n of options[1].neighbors)expect(s.state.propertyManager.calculateToll(n.tileId)).toBe(n.rent);
 land(s,12);expect(s.focus.cost).toBe(660);expect(s.upgrade().success).toBe(true);land(s,12);expect(s.focus.kind).toBe('OWN_MAX');expect(s.upgrade().success).toBe(false);
 const mall=make();land(mall,12);mall.purchase();land(mall,12);expect(mall.focus.cost).toBe(1380);mall.upgrade();expect(mall.state.propertyManager.calculateToll(12)).toBe(945);
});
it('charges conversion, exposes permanent level loss, and never grants a renewal reward for conversion',()=>{
 const s=make();own(s,12,4,0,'MALL');s.acceptCommission('RENEWAL');const p=s.getCommerceOptions(12).find(b=>b.id==='PARK');expect(p).toMatchObject({level:1,lostLevels:3,conversionCost:300});
 expect(s.changeBusiness(12,'PARK').success).toBe(true);expect(s.currentPlayer.cash).toBe(15700);expect(s.careers[0].active.kind).toBe('RENEWAL');expect(s.changeBusiness(12,'MALL').success).toBe(true);expect(s.state.propertyManager.getProperty(12).level).toBe(1);expect(s.currentPlayer.cash).toBe(15400);
 const snap=stable(s);expect(s.changeBusiness(12,'MALL').success).toBe(false);expect(stable(s)).toEqual(snap);
});
it('refuses unaffordable, mortgaged, non-owner and out-of-phase changes without losing levels or cash',()=>{
 for(const kind of ['cash','mortgage','owner','phase']){const s=make();own(s,12,4,0,'MALL');if(kind==='cash')s.currentPlayer.cash=299;if(kind==='mortgage')s.state.propertyManager.getProperty(12).isMortgaged=true;if(kind==='owner')s.state.propertyManager.getProperty(12).owner=1;if(kind==='phase')s.state.phase='LANDING_ACTION';const before=stable(s);expect(s.changeBusiness(12,'PARK').success).toBe(false);expect(stable(s)).toEqual(before);}
});
it('visitors get the same once-only point benefits; park boosts stop when mortgaged',()=>{
 for(const type of ['MALL','PARK']){const s=make();own(s,12,1,1,type);const points=s.currentPlayer.cardPoints,cash=s.currentPlayer.cash;land(s,12);expect(s.currentPlayer.cardPoints-points).toBe(type==='MALL'?25:30);expect(cash-s.currentPlayer.cash).toBe(type==='MALL'?945:0);expect(s.resolveLanding().success).toBe(false);expect(s.currentPlayer.cardPoints-points).toBe(type==='MALL'?25:30);}
 const s=make();own(s,11,1);const base=s.state.propertyManager.calculateToll(11);own(s,12,0,0,'PARK');expect(s.state.propertyManager.calculateToll(11)).toBe(Math.floor(base*1.2));s.state.propertyManager.getProperty(12).isMortgaged=true;expect(s.state.propertyManager.calculateToll(11)).toBe(base);
});
it('AI selects park only with sufficient public neighboring income and pays normal purchase price',async()=>{
 for(const rich of [false,true]){const s=make();s.state.currentPlayerIndex=1;if(rich)for(const id of [11,13,14])own(s,id,4,1);expect(chooseCoastBusiness(s.state,s.currentPlayer,12)).toBe(rich?'PARK':'MALL');land(s,12);const cash=s.currentPlayer.cash;expect((await s.playAITurn()).success).toBe(true);expect(s.state.propertyManager.getProperty(12).buildingType).toBe(rich?'PARK':'MALL');expect(s.state.players[1].cash).toBe(cash-3200);}
});
it('old saves and both types round-trip without a new save ledger or reset of unrelated story and commissions',()=>{
 const s=make();s.advanceStory('accept');s.acceptCommission('RENEWAL');land(s,12);s.purchase('PARK');const saved=s.snapshot(),restored=make();expect(restored.restore(saved).success).toBe(true);expect(restored.state.propertyManager.getProperty(12)).toEqual(s.state.propertyManager.getProperty(12));expect(restored.stories).toEqual(s.stories);expect(restored.careers).toEqual(s.careers);expect(restored.currentPlayer.cash).toBe(s.currentPlayer.cash);
 const legacy=make();own(legacy,12,3,0,'MALL');const old=legacy.snapshot();delete old.slice.stories;expect(restored.restore(old).success).toBe(true);expect(restored.state.propertyManager.getProperty(12)).toMatchObject({buildingType:'MALL',level:3});expect(restored.currentPlayer.cash).toBe(old.players[0].cash);
});
it('ships seven finite compact original prefabs with visibly increasing mall height and distinct names',async()=>{
 const bytes=await readFile('public/shanhai/models/commerce.glb'),pack=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const manifest=JSON.parse(await readFile('public/shanhai/models/commerce.manifest.json','utf8'));expect(manifest.prefabs).toHaveLength(7);let lastHeight=0;
 for(const def of manifest.prefabs){const root=pack.getObjectByName(def.name);expect(root).toBeTruthy();let tris=0;root.traverse(o=>{if(o.isMesh){expect([...o.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});expect(tris).toBe(def.triangles);expect(tris).toBeLessThan(5500);const box=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());expect(box.x).toBeLessThan(2.5);expect(box.z).toBeLessThan(2.5);if(def.name.includes('mall')){expect(box.y).toBeGreaterThan(lastHeight);lastHeight=box.y;}}
 for(const type of ['MALL','PARK'])for(let level=0;level<=(type==='MALL'?4:1);level++)expect(pack.getObjectByName(residenceModel(make().tiles[12],level,type))).toBeTruthy();expect(residenceModel(make().tiles[12],0,null)).toBe('market');
});
