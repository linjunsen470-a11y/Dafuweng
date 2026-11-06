import {it,expect,vi} from 'vitest';
import * as THREE from 'three-modern';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {SliceScene} from '../src/shanhai/SliceScene.js';
import {tacticBoardView} from '../src/shanhai/SliceTactics.js';
const make=mapId=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314});return s;};
const stable=s=>{const snap=s.snapshot();delete snap.savedAt;return snap;};
it.each(['shanhai-highland','shanhai-coast'])('uses exactly current legal targets and does not mutate gameplay for previews on %s',map=>{
 const s=make(map),before=stable(s);const view=tacticBoardView(s,'OBSTACLE');expect(view.selected).toBeNull();expect(view.targets[0].label).toBe(s.state.getTile(view.targets[0].tileId).name);expect(view.targets.map(t=>t.id)).toEqual(s.getTactics()[0].targets.map(t=>t.id));expect(tacticBoardView(s,'OBSTACLE',999).selected).toBeNull();expect(stable(s)).toEqual(before);
 s.state.propertyManager.getProperty(1).hasObstacle=true;expect(tacticBoardView(s,'OBSTACLE').targets.some(t=>t.id===1)).toBe(false);s.buyTactic('CLEAR_ROAD');expect(tacticBoardView(s,'CLEAR_ROAD').targets.map(t=>t.id)).toEqual([1]);s.useTactic('CLEAR_ROAD',1);expect(tacticBoardView(s,'OBSTACLE')).toBeNull();
});
it('separates co-located player markers and previews the selected player’s reversed path',()=>{
 const s=make('shanhai-highland');s.state.players[1].currentTile=0;const before=stable(s),v=tacticBoardView(s,'TURN_AROUND',1);expect(v.targets[0].x).not.toBe(v.targets[1].x);expect(v.selected.id).toBe(1);expect(v.path).toEqual([23,22,21]);expect(stable(s)).toEqual(before);
});
it('disposes temporary target meshes and labels, restoring the camera on cancel',()=>{
 const s=make('shanhai-highland'),scene=Object.create(SliceScene.prototype);Object.assign(scene,{scene:new THREE.Scene(),labels:[],tiles:s.tiles,camera:new THREE.PerspectiveCamera(),selection:{visible:false},container:{parentElement:{classList:{toggle(){}}}},controls:{target:new THREE.Vector3(),update(){}},highlight:vi.fn(),addLabel(text,position){const label={textContent:text,classList:{contains:c=>c==='tactic-label',toggle(){}},remove:vi.fn()};this.labels.push({label,position});return label;}});scene.camera.position.set(8,15,9);scene.camera.zoom=1.4;const initial=scene.camera.position.clone();scene.setTacticTargets(tacticBoardView(s,'OBSTACLE'));expect(scene.tacticPicks.length).toBe(s.getTactics()[0].targets.length);const mesh=scene.tacticPicks[0],dispose=vi.spyOn(mesh.geometry,'dispose'),labels=scene.labels.slice();scene.setTacticTargets(tacticBoardView(s,'TURN_AROUND',1));expect(dispose).toHaveBeenCalledOnce();expect(labels.every(l=>l.label.remove.mock.calls.length===1)).toBe(true);expect(scene.tacticPicks).toHaveLength(2);scene.setTacticTargets(null);expect(scene.tacticMode).toBe(false);expect(scene.tacticGroup).toBeNull();expect(scene.labels).toHaveLength(0);expect(scene.camera.position.equals(initial)).toBe(true);expect(scene.camera.zoom).toBe(1.4);
});
