import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three-modern/addons/loaders/GLTFLoader.js';
import {SliceSession} from '../src/shanhai/SliceSession.js';
import {characterFeedback} from '../src/shanhai/SlicePerformance.js';
import {CARD_CAPACITY} from '../src/game/InventoryManager.js';
const make=(mapId='shanhai-coast',characterId='xingluo',opponentId='qinghe')=>{const s=new SliceSession({mapId,storage:null});s.start({characterId,opponentId,seed:314});return s;};
const stable=s=>{const snap=s.snapshot();delete snap.savedAt;return snap;};
const useStarter=s=>{s.currentPlayer.cards=s.currentPlayer.cards.filter(c=>c!=='REMOTE_DICE');};
it('starts as player or opponent on both maps and preserves both roles and old save identity',()=>{
 for(const map of ['shanhai-coast','shanhai-highland'])for(const [human,opponent] of [['xingluo','qinghe'],['ayu','xingluo']]){const s=make(map,human,opponent);expect(s.state.players.map(p=>p.characterId)).toEqual([human,opponent]);const r=make(map);expect(r.restore(s.snapshot()).success).toBe(true);expect(r.state.players.map(p=>p.characterId)).toEqual([human,opponent]);expect(r.state.players.map(p=>p.cash)).toEqual([16000,16000]);}
 const old=make('shanhai-coast','ayu','qinghe');const snapshot=old.snapshot();delete snapshot.slice.abilities;const r=make();r.restore(snapshot);expect(r.state.players.map(p=>p.characterId)).toEqual(['ayu','qinghe']);expect(r.abilities[0].readyRound).toBe(1);
 const s=make('shanhai-coast','xingluo','xingluo');expect(s.state.players[1].characterId).toBe('ayu');
});
it('crafts one real remote card for 500 cash, preserves points/position/RNG and allows ordinary legal use',()=>{
 const s=make();expect(s.useAbility().success).toBe(false);useStarter(s);const p=s.currentPlayer,before={cash:p.cash,points:p.cardPoints,tile:p.currentTile,rng:s.state.rng.state};
 expect(s.getAbilityPreview()).toMatchObject({cashCost:500,cost:0,blockedReason:''});expect(s.useAbility()).toMatchObject({success:true,abilityId:'CHART_DICE',cash:-500});expect(p.cards.filter(c=>c==='REMOTE_DICE')).toHaveLength(1);expect(p.cash).toBe(before.cash-500);expect(p.cardPoints).toBe(before.points);expect(p.currentTile).toBe(before.tile);expect(s.state.rng.state).toBe(before.rng);expect(s.cardUsed).toBe(false);expect(s.useRemoteDice(3).success).toBe(true);s.resolveMovement();expect(p.currentTile).toBe(3);expect(s.cardUsed).toBe(true);
});
it('persists cooldown and rejects repeat, capacity, insufficient cash, wrong timing and spent strategy atomically',()=>{
 const s=make();useStarter(s);s.useAbility();const restored=make();restored.restore(s.snapshot());expect(restored.abilities[0].readyRound).toBe(4);useStarter(restored);expect(restored.useAbility().success).toBe(false);restored.state.round=4;expect(restored.useAbility().success).toBe(true);
 for(const change of [s=>s.currentPlayer.cash=499,s=>s.currentPlayer.cards=Array(CARD_CAPACITY).fill('OBSTACLE'),s=>s.state.phase='LANDING_ACTION',s=>s.cardUsed=true,s=>s.currentPlayer.isBankrupt=true]){const s=make();useStarter(s);change(s);const before=stable(s);expect(s.useAbility().success).toBe(false);expect(stable(s)).toEqual(before);}
});
it('has no hidden commission bonus and independent feedback/portrait identity',()=>{
 const s=make();expect(s.commissionReward('DELIVERY')).toMatchObject({cash:600,specialist:false});expect(s.commissionReward('RENEWAL')).toMatchObject({cash:400,specialist:false});expect(characterFeedback(s.currentPlayer,'ability')).toMatchObject({characterId:'xingluo',speaker:'星罗'});expect(characterFeedback(s.currentPlayer,'ability').line).toContain('路线');
});
it('AI pays the same fee when points are scarce, then uses its real card; keeps a cash reserve',async()=>{
 for(const map of ['shanhai-coast','shanhai-highland']){const s=make(map,'ayu','xingluo');s.state.currentPlayerIndex=1;useStarter(s);s.currentPlayer.cardPoints=0;const ai=s.currentPlayer,cash=ai.cash;let craft=0;await s.playAITurn({onAbility:r=>{if(r.abilityId==='CHART_DICE'){craft++;expect(ai.cash).toBe(cash-500);expect(ai.cards).toContain('REMOTE_DICE');expect(s.abilities[1].readyRound).toBe(4);}},onRoll:r=>expect(r.remote).toBe(true)});expect(craft).toBe(1);expect(ai.cards).not.toContain('REMOTE_DICE');}
 const s=make('shanhai-coast','ayu','xingluo');s.state.currentPlayerIndex=1;useStarter(s);s.currentPlayer.cardPoints=0;s.currentPlayer.cash=2200;expect((await s.playAITurn()).success).toBe(true);expect(s.abilities[1].readyRound).toBe(1);
});
it('ships compact original animated geometry, new accessories, and unchanged motion samples after batching',async()=>{
 const bytes=await readFile('public/shanhai/models/character-cartographer.glb');expect(bytes.length).toBeLessThan(2000000);const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');expect(gltf.animations.map(a=>a.name).sort()).toEqual(['idle','walk','celebrate','disappointed','ability','notice'].sort());let tris=0;gltf.scene.traverse(o=>{if(o.isMesh){expect([...o.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);tris+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});expect(tris).toBeLessThan(22000);
 const validation=JSON.parse(await readFile('art-source/shanhai/cartographer-validation.json','utf8'))[0];expect(validation.drawCallsPerNormalPass).toBeLessThan(35);expect(validation.clips.every(c=>c.animationSamplesUnchanged&&c.loopSeamMaxError<.001)).toBe(true);
 const raw=await readFile('art-source/shanhai/character-cartographer-unmerged.glb');const json=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)).toString());for(const part of ['hat_brim','glasses_bridge','chart_case','compass_case'])expect(json.nodes.some(n=>n.name?.includes(part))).toBe(true);
});
