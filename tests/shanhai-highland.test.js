import {it,expect} from 'vitest';
import {SliceSession,SLICE_SAVE_KEY} from '../src/shanhai/SliceSession.js';
import {SHANHAI_COAST_MAP,SHANHAI_HIGHLAND_MAP,sliceSaveKey} from '../src/shanhai/SliceMap.js';
import {getMapDefinition} from '../src/game/MapData.js';
const make=(mapId='shanhai-highland',storage=null)=>{const s=new SliceSession({mapId,storage});s.start({seed:314});return s;};
const land=(s,id)=>{s.currentPlayer.currentTile=id;s.state.phase='LANDING_ACTION';s.resetPresentation();s.resolveLanding();};
it('registers a distinct closed playable route with original names, positions and economy',()=>{
 const m=getMapDefinition('shanhai-highland');expect(m).toBe(SHANHAI_HIGHLAND_MAP);expect(m.tiles).toHaveLength(24);let id=0,visited=new Set();for(let i=0;i<24;i++){visited.add(id);id=m.tiles[id].next[0];}expect(id).toBe(0);expect(visited.size).toBe(24);expect(m.tiles.every(t=>t.position!==SHANHAI_COAST_MAP.tiles[t.id].position)).toBe(true);expect(m.tiles[1].price).toBe(1000);expect(m.tiles[17].price).toBe(2200);expect(m.tiles[12].buildCost).toBe(1400);expect(getMapDefinition('shanhai-coast')).toBe(SHANHAI_COAST_MAP);
});
it('plays mountain events, ordinary property, commissions and AI through the existing commands',async()=>{
 const s=make();expect(s.getTransportOptions()).toEqual([]);expect(s.advanceStory('accept').success).toBe(true);s.acceptCommission('RENEWAL');s.useRemoteDice(1);s.resolveMovement();s.resolveLanding();expect(s.focus.title).toBe('茶农小院');expect(s.purchase().success).toBe(true);expect(s.careers[0].completed).toBe(1);expect(s.endTurn().success).toBe(true);expect((await s.playAITurn()).success).toBe(true);expect(s.currentPlayer.id).toBe(0);expect(s.stories[1].stage).toBeGreaterThanOrEqual(1);
 land(s,4);expect(s.focus.title).toBe('驿路上的收茶车');const cash=s.currentPlayer.cash;expect(s.chooseIslandEvent('sort').success).toBe(true);expect(s.currentPlayer.cash).toBe(cash+250);expect(s.chooseIslandEvent('sort').success).toBe(false);
});
it('keeps the coast save key unchanged and both map saves independently recoverable',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const coast=make('shanhai-coast',storage);coast.advanceStory('accept');coast.currentPlayer.cash=14567;expect(coast.save().success).toBe(true);const coastBytes=values.get(SLICE_SAVE_KEY);
 const valley=make('shanhai-highland',storage);land(valley,10);expect(valley.save().success).toBe(true);expect(values.get(SLICE_SAVE_KEY)).toBe(coastBytes);const resumed=make('shanhai-highland',storage);expect(resumed.load().success).toBe(true);expect(resumed.pendingEvent.tileId).toBe(10);expect(resumed.focus.title).toBe('柴窑试烧');expect(resumed.chooseIslandEvent('pack').success).toBe(true);expect(resumed.restore(coast.snapshot()).success).toBe(false);
 const original=make('shanhai-coast',storage);expect(original.load().success).toBe(true);expect(original.currentPlayer.cash).toBe(14567);expect(original.stories[0].stage).toBe(1);expect(sliceSaveKey('shanhai-coast')).toBe(SLICE_SAVE_KEY);
});
it('completes a deterministic short mountain season without hidden coastal transports or lantern endings',async()=>{
 const s=make();for(let i=0;i<40&&s.state.phase!=='GAME_OVER';i++){
 if(s.currentPlayer.isAI){expect((await s.playAITurn()).success).toBe(true);continue;}
 expect(s.roll().success).toBe(true);s.resolveMovement();s.resolveLanding();if(s.pendingEvent){const c=s.getIslandChoices().find(c=>!c.blockedReason&&!c.cost&&!c.pointCost);expect(s.chooseIslandEvent(c.id).success).toBe(true);}
 if(s.focus.kind==='PURCHASE'&&!s.getPropertyBlockReason()&&s.currentPlayer.cash-s.focus.cost>1800)s.purchase();else if(s.focus.kind==='UPGRADE'&&!s.getPropertyBlockReason()&&s.currentPlayer.cash-s.focus.cost>1800)s.upgrade();
 expect(s.endTurn().success).toBe(true);
 }expect(s.state.phase).toBe('GAME_OVER');expect(s.state.winner).toBeTruthy();expect(s.state.mapId).toBe('shanhai-highland');expect(s.stories[1].stage).toBeGreaterThanOrEqual(1);
});
