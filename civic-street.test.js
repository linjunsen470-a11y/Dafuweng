import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {GRAND_BAY_MAP} from './src/game/GrandMapData.js';
import {isCivicHome,civicStreets} from './src/engine/CivicStreet.js';
import {harborFacility} from './src/engine/HarborFacilities.js';
it('adapts the existing business group without changing commercial plots or the route graph',()=>{
 const before=JSON.stringify(GRAND_BAY_MAP);
 expect(GRAND_BAY_MAP.tiles.filter(t=>isCivicHome(GRAND_BAY_MAP,t)).map(t=>t.id)).toEqual([61,63,66,68,81,83,86,88,91,93,108,111,113,116,118]);
 expect(isCivicHome(GRAND_BAY_MAP,GRAND_BAY_MAP.tiles[61],'CHAIN_STORE')).toBe(false);
 expect(isCivicHome({id:'shanhai-coast'},GRAND_BAY_MAP.tiles[61])).toBe(false);
 expect(civicStreets({id:'other'}).children).toHaveLength(0);civicStreets(GRAND_BAY_MAP);
 expect(JSON.stringify(GRAND_BAY_MAP)).toBe(before);expect(GRAND_BAY_MAP.tiles[60].next).toEqual([61,108]);
});
it('keeps generated facility bounds within their clearance specs and four homes within the plot radius',()=>{
 const manifest=JSON.parse(readFileSync('public/shanhai/models/civic-street.manifest.json'));
 const homes=manifest.models.filter(m=>m.prefab.startsWith('res_civic_'));
 expect(homes).toHaveLength(4);let lastHeight=0;
 for(const m of homes){const [w,d,h]=m.size_xyz_blender;expect(Math.hypot(w,d)/2+1.75).toBeLessThan(4.6);expect(h).toBeGreaterThan(lastHeight);lastHeight=h;}
 for(const id of [57,65,109]){const spec=harborFacility(GRAND_BAY_MAP,GRAND_BAY_MAP.tiles[id]);const [w,d,h]=manifest.models.find(m=>m.prefab===spec.model).size_xyz_blender;expect(w).toBeLessThanOrEqual(spec.width+.001);expect(d).toBeLessThanOrEqual(spec.depth+.001);expect(h).toBeLessThanOrEqual(spec.height);}
});

it('keeps the original return gate within the real mechanism footprint and origin',()=>{
 const manifest=JSON.parse(readFileSync('public/shanhai/models/return-gate.manifest.json'));
 const model=manifest.models[0], spec=harborFacility(GRAND_BAY_MAP,GRAND_BAY_MAP.tiles[79]);
 expect(model.prefab).toBe(spec.model);const [w,d,h]=model.size_xyz_blender;
 expect(w).toBeLessThanOrEqual(spec.width+.001);expect(d).toBeLessThanOrEqual(spec.depth+.001);expect(h).toBeLessThan(spec.height);
 expect(isCivicHome(GRAND_BAY_MAP,GRAND_BAY_MAP.tiles[84])).toBe(false);
 expect(GRAND_BAY_MAP.tiles[83].next).toEqual([0]);
});
