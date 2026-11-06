import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three-modern/addons/loaders/GLTFLoader.js';
import {clone} from 'three-modern/addons/utils/SkeletonUtils.js';
import {applyExpression,expressionFor} from '../src/shanhai/SliceExpressions.js';
import {characterFeedback} from '../src/shanhai/SlicePerformance.js';
const load=async kind=>{const b=readFileSync(`public/shanhai/models/character-${kind}.glb`);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
it.each(['courier','botanist','cartographer'])('loads valid independent expressions on the real %s asset while keeping body clips',async kind=>{
 const asset=await load(kind),copy=clone(asset.scene),faces=[];copy.traverse(o=>{if(o.morphTargetInfluences)faces.push(o);});expect(faces.length).toBeGreaterThan(0);expect(asset.animations.map(c=>c.name).sort()).toEqual(['ability','celebrate','disappointed','idle','notice','walk']);
 for(const face of faces){expect(Object.keys(face.morphTargetDictionary)).toEqual(['happy','concern','surprise']);for(const attr of face.geometry.morphAttributes.position){expect(attr.count).toBe(face.geometry.attributes.position.count);expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);}}
 for(const mood of ['happy','concern','surprise']){expect(applyExpression(copy,mood)).toBe(faces.length);for(const face of faces)expect(face.morphTargetInfluences).toEqual(['happy','concern','surprise'].map(m=>Number(m===mood)));}
 asset.scene.traverse(o=>{if(o.morphTargetInfluences)expect(o.morphTargetInfluences.every(v=>v===0)).toBe(true);});applyExpression(copy,'neutral');expect(faces.every(f=>f.morphTargetInfluences.every(v=>v===0))).toBe(true);
});
it('maps actual event feedback to matching faces and keeps each original identity',()=>{
 for(const [kind,mood] of [['success','happy'],['setback','concern'],['rent','concern'],['event','surprise'],['ability','happy'],['sailing','neutral']]){expect(expressionFor(kind)).toBe(mood);for(const id of ['ayu','qinghe','xingluo']){const f=characterFeedback({name:id,characterId:id},kind);expect(f.characterId).toBe(id);expect(f.mood).toBe(mood);expect(f.line.length).toBeGreaterThan(5);const file=`public/shanhai/portraits/${id}${mood==='neutral'?'':`-${mood}`}.png`;expect(readFileSync(file).subarray(1,4).toString()).toBe('PNG');}}
});
