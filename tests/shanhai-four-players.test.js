import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three-modern/addons/loaders/GLTFLoader.js';
import {SliceSession,SLICE_CHARACTERS} from '../src/shanhai/SliceSession.js';
import {sliceCast} from '../src/shanhai/SliceMap.js';
import {seasonReport} from '../src/shanhai/SliceSeasonReport.js';
import {tacticBoardView} from '../src/shanhai/SliceTactics.js';
import {characterFeedback} from '../src/shanhai/SlicePerformance.js';
import {CARD_CAPACITY} from '../src/game/InventoryManager.js';
const make=(mapId='shanhai-coast',count=4,characterId='ayu')=>{const s=new SliceSession({storage:null,mapId});s.start({seed:314,playerCount:count,characterId});return s;};
const stable=s=>{const r=s.snapshot();delete r.savedAt;return r;};
it('builds four distinct characters for every human/first-AI combination while retaining old cast order',()=>{
 for(const c of SLICE_CHARACTERS)for(const a of SLICE_CHARACTERS){const cast=sliceCast(c.id,a.id,4);expect(cast[0].id).toBe(c.id);expect(new Set(cast.map(x=>x.id)).size).toBe(4);if(c.id!==a.id)expect(cast[1].id).toBe(a.id);}
 expect(sliceCast().map(c=>c.id)).toEqual(['ayu','qinghe']);expect(sliceCast('ayu','qinghe',3).map(c=>c.id)).toEqual(['ayu','qinghe','xingluo']);
});
it.each(['shanhai-coast','shanhai-highland'])('completes all four turns and restores AI3 without replaying on %s',async map=>{
 const s=make(map);expect(s.state.players.map(p=>p.isAI)).toEqual([false,true,true,true]);s.state.players[0].isAI=true;for(let i=0;i<3;i++){expect(s.currentPlayer.id).toBe(i);expect((await s.playAITurn()).success).toBe(true);expect(s.state.round).toBe(1);}s.state.players[0].isAI=false;const r=make(map);expect(r.restore(s.snapshot()).success).toBe(true);await s.playAITurn();await r.playAITurn();expect(r.state.round).toBe(2);expect(r.currentPlayer.id).toBe(0);expect(r.state.players).toEqual(s.state.players);expect(r.state.players[3].characterId).toBe('taoning');
});
it('pays seat-four rent and offers four separate strategy targets',()=>{
 const s=make();Object.assign(s.state.propertyManager.getProperty(1),{owner:3,level:1});const cash=s.state.players[3].cash;s.currentPlayer.currentTile=1;s.state.phase='LANDING_ACTION';s.resolveLanding();expect(s.state.players[3].cash).toBeGreaterThan(cash);const r=make();r.restore(s.snapshot());expect(r.state.propertyManager.getProperty(1).owner).toBe(3);
 const t=make(),v=tacticBoardView(t,'TURN_AROUND');expect(v.targets.map(x=>x.id)).toEqual([0,1,2,3]);expect(new Set(v.targets.map(x=>`${x.x}:${x.z}`)).size).toBe(4);expect(t.useTactic('TURN_AROUND',3).success).toBe(true);expect(t.state.players[3].direction).toBe(-1);
});
it('lets the fourth bidder win a three-survivor bankruptcy auction and transfers only once after restore',()=>{
 const s=make();s.state.currentPlayerIndex=1;s.currentPlayer.cash=0;s.currentPlayer.currentTile=2;Object.assign(s.state.propertyManager.getProperty(2),{owner:2,level:4});Object.assign(s.state.propertyManager.getProperty(3),{owner:1,level:0});s.state.phase='LANDING_ACTION';s.resolveLanding();expect(s.getAuctionView().auction.bidderOrder).toEqual([0,2,3]);const min=s.getAuctionView().minimum,id=s.getAuctionView().auction.id,cash=s.state.players.map(p=>p.cash);
 s.bidAuction(0,min,id);s.bidAuction(2,min+100,id);const r=make();r.restore(s.snapshot());expect(r.getAuctionView().bidder.id).toBe(3);r.bidAuction(3,min+200,id);r.bidAuction(0,0,id);r.bidAuction(2,0,id);expect(r.state.propertyManager.getProperty(3).owner).toBe(3);expect(r.state.players[3].cash).toBe(cash[3]-min-200);expect(r.state.players[2].cash).toBe(cash[2]+min+200);const done=r.snapshot();r.restore(done);expect(r.bidAuction(3,1000,id).success).toBe(false);expect(r.state.players).toEqual(done.players);expect(r.endTurn().success).toBe(true);expect(r.currentPlayer.id).toBe(2);expect(r.state.phase).not.toBe('GAME_OVER');
});
it('keeps four rankings, bankrupt ordering and existing two/three-player save counts',()=>{
 const s=make();s.state.players[1].isBankrupt=true;expect(s.state.checkWinCondition()).toBe(false);s.state.players[3].cash=30000;s.state.round=17;s.state.checkWinCondition();const r=seasonReport(s);expect(r.rankings.map(p=>p.id)).toEqual([3,0,2,1]);for(const n of [2,3,4]){const old=make('shanhai-coast',n);expect(s.restore(old.snapshot()).success).toBe(true);expect(s.state.players.length).toBe(n);}
});
it.each(['shanhai-coast','shanhai-highland'])('crafts one real clear-road card for 20 points with saved cooldown and unchanged strategy rules on %s',map=>{
 const s=make(map,4,'taoning'),p=s.currentPlayer;expect(s.getAbilityPreview()).toMatchObject({id:'TOOL_KIT',cost:20,cashCost:0});const cash=p.cash;expect(s.useAbility().success).toBe(true);expect(p.cash).toBe(cash);expect(p.cardPoints).toBe(100);expect(s.cardUsed).toBe(false);expect(p.cards.filter(c=>c==='CLEAR_ROAD')).toHaveLength(1);s.state.propertyManager.getProperty(1).hasObstacle=true;expect(s.useTactic('CLEAR_ROAD',1).success).toBe(true);expect(s.state.propertyManager.getProperty(1).hasObstacle).toBe(false);expect(s.cardUsed).toBe(true);const r=make(map);r.restore(s.snapshot());expect(r.useAbility().success).toBe(false);expect(r.abilities[0].readyRound).toBe(4);expect(characterFeedback(p,'ability').characterId).toBe('taoning');expect(s.commissionReward('RENEWAL').specialist).toBe(false);
});
it('rejects illegal crafting atomically and gives AI the same card/cost/cooldown',async()=>{
 for(const change of [s=>s.currentPlayer.cardPoints=19,s=>s.currentPlayer.cards.push('CLEAR_ROAD'),s=>s.currentPlayer.cards=Array(CARD_CAPACITY).fill('OBSTACLE'),s=>s.cardUsed=true,s=>s.state.phase='LANDING_ACTION']){const s=make('shanhai-coast',4,'taoning');change(s);const before=stable(s);expect(s.useAbility().success).toBe(false);expect(stable(s)).toEqual(before);}
 const s=make();s.state.currentPlayerIndex=3;s.state.propertyManager.getProperty(1).hasObstacle=true;const p=s.currentPlayer;let craft=0;await s.playAITurn({onAbility:r=>{if(r.abilityId==='TOOL_KIT'){craft++;expect(p.cardPoints).toBe(100);expect(p.cards).toContain('CLEAR_ROAD');expect(s.abilities[3].readyRound).toBe(4);}}});expect(craft).toBe(1);
});
it('loads the fourth original model with six animation clips, facial targets and bounded geometry',async()=>{
 const bytes=await readFile('public/shanhai/models/character-builder.glb'),g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');expect(g.animations.map(a=>a.name).sort()).toEqual(['idle','walk','celebrate','disappointed','ability','notice'].sort());let faces=0;g.scene.traverse(o=>{if(o.isMesh){expect([...o.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);if(o.morphTargetDictionary?.happy!==undefined)faces++;}});expect(faces).toBeGreaterThan(0);const v=JSON.parse(await readFile('art-source/shanhai/builder-validation.json','utf8'));expect(v.triangles).toBeLessThan(22000);expect(v.drawCallsPerNormalPass).toBeLessThan(35);expect(v.clips.every(c=>c.animationSamplesUnchanged&&c.loopSeamMaxError<.001)).toBe(true);
});
