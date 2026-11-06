import {it,expect} from 'vitest';
import * as THREE from 'three-modern';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {SliceScene} from '../src/shanhai/SliceScene.js';
import {gardenInfluence} from '../src/shanhai/SliceCommerce.js';
const make=()=>{const s=new SliceSession({storage:null});s.start({seed:314});return s;};
const own=(s,id,owner,type='RESIDENTIAL',level=1)=>{s.state.propertyManager.buyProperty(id,owner,type);s.state.propertyManager.getProperty(id).level=level;};
const stable=s=>{const snap=s.snapshot();delete snap.savedAt;return snap;};
it('explains active same-owner gain with exact current toll, enemy ownership and vacant land without mutation',()=>{
 const s=make();own(s,12,0,'PARK');own(s,11,0);own(s,13,1);s.state.round=6;s.state.newsEffect={id:'DOUBLE_RENT',remainingRounds:2};const before=stable(s),view=gardenInfluence(s.state);expect(stable(s)).toEqual(before);
 expect(view.active).toBe(true);expect(view.rows.map(r=>r.tileId)).toEqual([11,13,14]);const [mine,enemy,vacant]=view.rows;
 expect(mine.current).toBe(s.state.propertyManager.calculateToll(11,s.state.newsEffect,s.state.priceIndex));expect(mine.current-mine.base).toBe(mine.increase);expect(mine.increase).toBeGreaterThan(0);expect(mine.risk).toContain('自己停靠不付租');
 expect(enemy.increase).toBe(0);expect(enemy.reason).toContain('不同业主');expect(enemy.risk).toContain('对手');expect(vacant.current).toBe(0);expect(vacant.reason).toContain('无主');
});
it('clearly separates purchase and conversion previews from current income and does not give away neighboring plots',()=>{
 const s=make();own(s,11,0);let v=gardenInfluence(s.state);expect(v.preview).toBe(true);expect(v.mode).toContain('购入');expect(v.rows[0].projected).toBeGreaterThan(v.rows[0].current);expect(v.rows[2].projected).toBe(0);
 own(s,12,1,'MALL');own(s,13,1);v=gardenInfluence(s.state);expect(v.mode).toContain('改建');expect(v.ownerId).toBe(1);expect(v.rows[0].increase).toBe(0);expect(v.rows[1].increase).toBeGreaterThan(0);expect(v.rows[1].risk).toContain('对手');
});
it('mortgaged source or neighbor never advertises an active increase; conversion and save restoration refresh the explanation',()=>{
 const s=make();own(s,12,0,'PARK');own(s,11,0);own(s,13,0);s.state.propertyManager.getProperty(13).isMortgaged=true;let v=gardenInfluence(s.state);expect(v.rows[1]).toMatchObject({current:0,increase:0});expect(v.rows[1].reason).toContain('抵押');
 s.state.propertyManager.getProperty(12).isMortgaged=true;v=gardenInfluence(s.state);expect(v.suspended).toBe(true);expect(v.preview).toBe(false);expect(v.rows.every(r=>r.increase===0)).toBe(true);
 s.state.propertyManager.getProperty(12).isMortgaged=false;expect(s.changeBusiness(12,'MALL').success).toBe(true);v=gardenInfluence(s.state);expect(v.active).toBe(false);expect(v.preview).toBe(true);const restored=make();restored.restore(s.snapshot());expect(gardenInfluence(restored.state)).toEqual(v);
});
it('keeps a fixed four map marks and four labels and disposes old resources on refresh or close',()=>{
 const s=make(),scene=Object.create(SliceScene.prototype);Object.assign(scene,{scene:new THREE.Scene(),labels:[],tiles:s.tiles.map(t=>({...t,visualLot:{x:t.position.x,z:t.position.z,rotation:0}})),container:{parentElement:{classList:{toggle(){}}}},addLabel(text,position){const label={textContent:text,style:{},dataset:{},removed:false,classList:{contains:c=>c==='garden-label',toggle(){}},remove(){this.removed=true;}};this.labels.push({label,position});return label;}});
 // Supply a compact layout fixture; the live scene derives these lots when creating the road.
 const info=gardenInfluence(s.state);scene.setGardenInfluence(info);expect(scene.gardenGroup.children).toHaveLength(4);expect(scene.labels).toHaveLength(4);let disposed=0;scene.gardenGroup.children.forEach(m=>m.geometry.addEventListener('dispose',()=>disposed++));const previous=scene.labels.map(l=>l.label);
 scene.setGardenInfluence(info);expect(disposed).toBe(4);expect(previous.every(l=>l.removed)).toBe(true);expect(scene.labels).toHaveLength(4);expect(scene.scene.children).toHaveLength(1);scene.setGardenInfluence(null);expect(scene.labels).toHaveLength(0);expect(scene.scene.children).toHaveLength(0);
});
it('separates four projected number labels on a compact screen without stacking additional labels',()=>{
 const scene=Object.create(SliceScene.prototype),camera=new THREE.OrthographicCamera(-12,12,10,-10,.1,100);camera.position.set(0,20,20);camera.lookAt(0,0,0);camera.updateMatrixWorld();Object.assign(scene,{gardenInfo:{},camera,container:{clientWidth:390,clientHeight:330},labels:[0,.1,.2,.3].map(n=>({position:new THREE.Vector3(n,0,n),label:{classList:{contains:()=>true},style:{}}}))});scene.layoutGardenLabels();const points=scene.labels.map(l=>({x:parseFloat(l.label.style.left),y:parseFloat(l.label.style.top)})).sort((a,b)=>a.y-b.y);for(let i=1;i<points.length;i++)expect(points[i].y-points[i-1].y).toBeGreaterThanOrEqual(36);expect(points.every(p=>p.y<=318&&p.y>=30&&p.x>=22&&p.x<=368)).toBe(true);
});
