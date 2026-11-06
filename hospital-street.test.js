import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createHospitalClinic} from './src/engine/HospitalStreet.js';
import {GameState} from './src/game/GameState.js';
import {GameEngine} from './src/game/GameEngine.js';
import {describePresentationEvent} from './src/ui/PresentationUI.js';
import {getArrivalBrief} from './src/game/TurnPresentationRules.js';
import {GRAND_BAY_MAP} from './src/game/GrandMapData.js';

it('fits the original clinic geometry inside the existing footprint and clear of every road',()=>{
 const group=createHospitalClinic();group.updateMatrixWorld(true);let triangles=0;
 group.traverse(mesh=>{if(!mesh.isMesh)return;const vertices=mesh.geometry.attributes.position;triangles+=(mesh.geometry.index?.count||vertices.count)/3;
  for(let i=0;i<vertices.count;i++){const p=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld);expect(Math.hypot(p.x,p.z)).toBeLessThanOrEqual(1.92);expect(p.y).toBeLessThan(2.7);}
 });
 expect(triangles).toBeLessThan(300);
 const anchor=new THREE.Vector3(-59,0,-16);
 for(const a of GRAND_BAY_MAP.tiles)for(const id of a.next){const b=GRAND_BAY_MAP.tiles[id];const line=new THREE.Line3(new THREE.Vector3(a.position.x,0,a.position.z),new THREE.Vector3(b.position.x,0,b.position.z));expect(anchor.distanceTo(line.closestPointToPoint(anchor,true,new THREE.Vector3()))).toBeGreaterThan(1.92+1.75);}
});
for(const ai of [false,true])it(`explains one skipped action and retains hospital rules for ${ai?'AI':'human'}`,()=>{
 const state=new GameState({seed:64});state.setupGame([{profileIndex:0,name:'体验者',isAI:ai},{profileIndex:1,name:'对手',isAI:true}],20000,{mapId:'grand-bay'});
 const p=state.players[0];p.currentTile=72;state.phase='LANDING_ACTION';const engine=new GameEngine(state),cash=p.cash;
 const event=engine.execute({type:'RESOLVE_LANDING',playerId:0,payload:{tileId:72}});
 expect(event.type).toBe('HOSPITALIZED');expect(p.hospitalTurns).toBe(1);expect(p.cash).toBe(cash);expect(p.currentTile).toBe(72);
 const stable=()=>{const s=state.createSnapshot();delete s.savedAt;return JSON.stringify(s);};
 const before=stable(),cue=describePresentationEvent(event,state).find(c=>c.kind==='toast');
 expect(cue.detail).toContain('暂停 1 次行动');expect(cue.detail).toContain('从当前格继续');expect(cue.fullDetail).toBe(true);expect(getArrivalBrief(state,p,72).detail).toContain('通常暂停1次');expect(stable()).toBe(before);
 // Existing skip logic is unchanged: first return skips player0, second makes them active.
 state.nextTurn();expect(state.currentPlayerIndex).toBe(1);state.nextTurn();expect(state.currentPlayerIndex).toBe(1);expect(p.hospitalTurns).toBe(0);state.nextTurn();expect(state.currentPlayerIndex).toBe(0);expect(p.currentTile).toBe(72);
});
it('reports the redirected patient and their actual remaining stay',()=>{
 const state={players:[{id:0,name:'甲',hospitalTurns:0},{id:1,name:'乙',hospitalTurns:3}]};
 const cue=describePresentationEvent({type:'HOSPITALIZED',playerId:1,duration:1},state).find(c=>c.kind==='toast');
 expect(cue.detail).toContain('乙 暂停 3 次行动');
});
