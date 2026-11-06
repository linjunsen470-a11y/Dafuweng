import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createCivicStation} from './src/engine/CivicStation.js';
import {GameState} from './src/game/GameState.js';
import {GameEngine} from './src/game/GameEngine.js';
import {describePresentationEvent} from './src/ui/PresentationUI.js';
import {getArrivalBrief} from './src/game/TurnPresentationRules.js';
import {GRAND_BAY_MAP as map} from './src/game/GrandMapData.js';

it('keeps station below the sign, within original footprint and clear of roads/lots',()=>{
 const model=createCivicStation();model.rotation.y=Math.PI;model.updateMatrixWorld(true);let triangles=0;
 model.traverse(mesh=>{if(!mesh.isMesh)return;triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);expect(Math.hypot(v.x,v.z)).toBeLessThan(1.93);}});
 expect(triangles).toBeLessThan(350);expect(new THREE.Box3().setFromObject(model).max.y).toBeLessThan(2.7);expect(model.userData.isStaticFacility).toBe(true);
 model.position.set(50,.22,-32.3);model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model);
 for(const a of map.tiles){for(const id of a.next){const b=map.tiles[id],line=new THREE.Line3(new THREE.Vector3(a.position.x,0,a.position.z),new THREE.Vector3(b.position.x,0,b.position.z)),anchor=new THREE.Vector3(50,0,-32.3);expect(anchor.distanceTo(line.closestPointToPoint(anchor,true,new THREE.Vector3()))).toBeGreaterThan(1.93+1.75);}
 if(a.lot){const p=a.lot.position;expect(p.x+1.75<bounds.min.x||p.x-1.75>bounds.max.x||p.z+1.75<bounds.min.z||p.z-1.75>bounds.max.z,`lot ${a.id}`).toBe(true);}}
});
for(const ai of [false,true])it(`explains custody without changing ${ai?'AI':'human'} rules or state`,()=>{
 const state=new GameState({seed:64});state.setupGame([{profileIndex:0,name:'体验者',isAI:ai},{profileIndex:1,name:'对手',isAI:true}],20000,{mapId:'grand-bay'});
 const p=state.players[0];p.currentTile=42;state.phase='LANDING_ACTION';const event=new GameEngine(state).execute({type:'RESOLVE_LANDING',playerId:0,payload:{tileId:42}});
 expect(event.type).toBe('JAILED');expect(p.jailTurns).toBe(2);expect(p.cash).toBe(20000);
 const stable=()=>{const s=state.createSnapshot();delete s.savedAt;return JSON.stringify(s);},before=stable();
 const cue=describePresentationEvent(event,state).find(c=>c.kind==='toast');expect(cue.detail).toContain('暂停 2 次行动');expect(cue.detail).toContain('从当前格继续');expect(getArrivalBrief(state,p,42).detail).toContain('通常暂停2次');expect(stable()).toBe(before);
 state.nextTurn();state.nextTurn();expect(state.currentPlayerIndex).toBe(1);expect(p.jailTurns).toBe(1);state.nextTurn();expect(state.currentPlayerIndex).toBe(1);expect(p.jailTurns).toBe(0);state.nextTurn();expect(state.currentPlayerIndex).toBe(0);expect(p.currentTile).toBe(42);
});
it('reports actual remaining custody when a shorter penalty is applied',()=>{
 const cue=describePresentationEvent({type:'JAILED',playerId:1,duration:2},{players:[{id:1,name:'乙',jailTurns:3}]}).find(c=>c.kind==='toast');expect(cue.detail).toContain('乙 暂停 3 次行动');
});
