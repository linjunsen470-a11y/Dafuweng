import {it,expect} from 'vitest';import {readFileSync} from 'node:fs';import {GRAND_BAY_MAP as map} from './src/game/GrandMapData.js';import {harborFacility} from './src/engine/HarborFacilities.js';
it('fits the original low-poly material showroom in the exact existing company frontage',()=>{
 const pack=JSON.parse(readFileSync('public/shanhai/models/summit-yard.manifest.json')),m=pack.models[0],spec=harborFacility(map,map.tiles[99]);expect(map.tiles[99].companyId).toBe('SUMMIT_MATERIAL');expect(spec.model).toBe(m.prefab);expect(m.triangles).toBeLessThan(400);const [w,d,h]=m.size_xyz_blender;expect(w).toBeLessThanOrEqual(spec.width+.001);expect(d).toBeLessThanOrEqual(spec.depth+.001);expect(h).toBeLessThan(spec.height);expect(pack.license).toContain('No external assets');
 for(const id of [96,98]){const lot=map.tiles[id].lot;expect(Math.abs(lot.position.x-spec.x)).toBeGreaterThan((lot.size.x+spec.width)/2);}
});
