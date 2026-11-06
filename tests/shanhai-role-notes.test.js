import {it,expect} from 'vitest';
import {ROLE_GUIDES,roleGuide} from '../src/shanhai/SliceRoleGuide.js';
import {mountainMapNote} from '../src/shanhai/SliceMapNote.js';
import {SliceSession,SLICE_CHARACTERS} from '../src/shanhai/SliceSession.js';
const make=(id='ayu',mapId='shanhai-highland')=>{const s=new SliceSession({storage:null,mapId});s.start({characterId:id,seed:314});return s;};
const stable=s=>{const snap=s.snapshot();delete snap.savedAt;return snap;};
it('covers all selectable roles and quotes actual active-resource costs and commission differences',()=>{
 expect(Object.keys(ROLE_GUIDES).sort()).toEqual(SLICE_CHARACTERS.map(c=>c.id).sort());
 for(const id of Object.keys(ROLE_GUIDES)){const s=make(id),g=roleGuide(id),a=s.getAbilityPreview();expect(g.ability).toContain(a.name);expect(g.ability).toContain(String(a.cashCost||a.cost));expect(g.opening.length).toBeGreaterThan(15);if(['xingluo','taoning'].includes(id))expect([s.commissionReward('DELIVERY').specialist,s.commissionReward('RENEWAL').specialist]).toEqual([false,false]);else expect(s.commissionReward(id==='ayu'?'DELIVERY':'RENEWAL').specialist).toBe(true);}
});
it('reads three-step directions through the existing map runtime without mutating saves or RNG',()=>{
 const s=make();s.currentPlayer.currentTile=23;const before=stable(s),forward=mountainMapNote(s),reverse=mountainMapNote(s,true);
 expect(forward.route.map(t=>t.id)).toEqual([0,1,2]);expect(forward.target).toBe(2);expect(reverse.route.map(t=>t.id)).toEqual([22,21,20]);expect(reverse.target).toBe(20);expect(stable(s)).toEqual(before);
 expect(new Set(forward.choices.map(c=>c.id)).size).toBe(3);expect(forward.choices.some(c=>c.id===forward.target)).toBe(true);
});
it('uses the actual reversed direction and the first stopping fence, like the ordinary travel preview',()=>{
 const s=make();s.currentPlayer.currentTile=5;s.currentPlayer.direction=-1;s.state.propertyManager.getProperty(4).hasObstacle=true;const before=stable(s),note=mountainMapNote(s);expect(note.fence).toBe(true);expect(note.route.map(t=>t.id)).toEqual([4]);expect(note.target).toBe(s.getTravelOptions().find(o=>o.steps===3).tileId);expect(mountainMapNote(s,true).target).toBe(8);expect(stable(s)).toEqual(before);
});
it('has original responses for each role, grants no extra benefit to either control type, and leaves the coast alone',()=>{
 for(const id of SLICE_CHARACTERS.map(c=>c.id)){const s=make(id),before=stable(s);expect(mountainMapNote(s).reply).toContain(s.currentPlayer.name);for(let i=0;i<5;i++)mountainMapNote(s,Boolean(i%2));expect(stable(s)).toEqual(before);s.currentPlayer.isAI=true;const ai=stable(s);expect(mountainMapNote(s).target).toBe(3);expect(stable(s)).toEqual(ai);}
 expect(mountainMapNote(make('ayu','shanhai-coast'))).toBe(null);
});
it('works after an unmodified old snapshot is restored without adding progress fields',()=>{
 const s=make('xingluo');s.acceptCommission('DELIVERY');const before=s.snapshot(),r=make();expect(r.restore(before).success).toBe(true);const restored=stable(r);mountainMapNote(r,true);expect(stable(r)).toEqual(restored);expect(r.snapshot().slice).toEqual(before.slice);
});
