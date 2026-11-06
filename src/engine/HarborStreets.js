import { hillStreets } from './HillStreet.js';
import { isOldTownHome } from './OldTownStreet.js';
import { isCivicHome, civicStreets } from './CivicStreet.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { harborFacility, facilityFacing } from './HarborFacilities.js';

// A presentation adapter for the existing grand-bay graph. No new tiles or rules.
export const isHarborHome = (map, tile, type) => Boolean(map?.id === 'grand-bay'
  && tile?.group?.startsWith('BAY_') && !tile.large
  && (!type || type === 'RESIDENTIAL'));

export function facingRoad(tile) {
  return Math.atan2(tile.position.x - tile.lot.position.x, tile.position.z - tile.lot.position.z);
}

export class HarborStreets {
  async load() {
    const loader = new GLTFLoader();
    const packs = await Promise.all(['residences', 'neighborhoods', 'harbor-facilities', 'old-town', 'civic-street', 'return-gate', 'company-court', 'summit-yard', 'hill-supply'].map(name =>
      loader.loadAsync(`${import.meta.env.BASE_URL}shanhai/models/${name}.glb`)));
    this.prefabs = new THREE.Group();
    packs.forEach(pack => this.prefabs.add(...pack.scene.children.slice()));
  }

  clone(name) {
    const source = this.prefabs?.getObjectByName(name);
    if (!source) return null;
    const model = source.clone(true);
    // BoardBuilder disposes removed objects. Own each instance's resources so
    // upgrading one house cannot dispose another house or the source prefab.
    model.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.geometry = mesh.geometry.clone();
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return model;
  }

  residence(level, district = 'harbor') {
    const model = this.clone(`res_${district}_${level}`);
    if (district === 'market') model?.traverse(mesh=>{
      for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
        if (!material) continue;
        if (material.name === 'coral') material.color.set('#566b65');
        if (material.name === 'cream') material.color.set('#e4cfa9');
      }
    });
    return model;
  }

  streets(map) {
    const group = new THREE.Group();
    group.name = 'original-harbor-streets';
    const stone = new THREE.MeshStandardMaterial({ color: '#e2d1ae', roughness: 1 });
    const promenade = new THREE.Mesh(new THREE.BoxGeometry(104, .1, .85), stone);
    promenade.position.set(0, .22, 30);
    group.add(promenade);
    for (const tile of map.tiles.filter(t => isHarborHome(map, t) || isOldTownHome(map,t) || isCivicHome(map,t))) {
      const a = tile.position, b = tile.lot.position;
      const length = Math.hypot(a.x - b.x, a.z - b.z);
      const path = new THREE.Mesh(new THREE.BoxGeometry(.65, .08, length), stone);
      path.position.set((a.x + b.x) / 2, .23, (a.z + b.z) / 2);
      path.rotation.y = facingRoad(tile);
      path.userData.frontageTile = tile.id;
      group.add(path);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(3.5, .12, 3.5), stone);
      pad.position.set(b.x, .16, b.z);
      group.add(pad);
    }
    for (const tile of map.tiles) {
      const spec = harborFacility(map, tile);
      if (!spec) continue;
      const length = Math.hypot(tile.position.x - spec.x, tile.position.z - spec.z);
      const path = new THREE.Mesh(new THREE.BoxGeometry(.85, .06, length - 1.5), stone);
      // Stop at the road shoulder, keeping the numbered tile unobstructed.
      const ratio = (length - 1.5) / length / 2;
      path.position.set(spec.x + (tile.position.x - spec.x) * ratio, .23, spec.z + (tile.position.z - spec.z) * ratio);
      path.rotation.y = facilityFacing(tile, spec);
      path.userData.serviceTile = tile.id;
      group.add(path);
    }
    // A low service pavement and waterfront walk join the existing frontage.
    // Their light paving is scenery, visually distinct from playable road tiles.
    for (const [x,z,width,depth] of [[-14.5,25.25,24,1],[0,35.7,104,1.3],[-22,32.6,.8,6],[-14,32.6,.8,6],[-2,32.6,.8,6]]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(width,.08,depth),stone);
      walk.position.set(x,.17,z); walk.receiveShadow=true; group.add(walk);
    }
    // The existing east-side OLD_1 plots share a narrow stone arcade walk.
    if (map.id === 'grand-bay') {
      const brick = new THREE.MeshStandardMaterial({color:'#c2ad91',roughness:1});
      const arcade = new THREE.Mesh(new THREE.BoxGeometry(.8,.08,38),brick);
      arcade.position.set(56.25,.17,-10); arcade.receiveShadow=true; group.add(arcade);
      const court = new THREE.Mesh(new THREE.BoxGeometry(4,.08,8),brick);
      court.position.set(48.6,.16,0); court.receiveShadow=true; group.add(court);
      // Continue the east arcade around the existing corner into OLD_2/OLD_3.
      // This pavement stays outside the road and does not add graph connections.
      for (const [x,z,w,d] of [[56.25,-33.625,.8,9.25],[23.125,-38.25,66.25,1.1],[30,-41.5,3.6,3]]) {
        const walk = new THREE.Mesh(new THREE.BoxGeometry(w,.08,d),brick);
        walk.position.set(x,.17,z); walk.receiveShadow=true; group.add(walk);
      }
    }
    group.add(civicStreets(map),hillStreets(map));
    // An inhabited frontage behind the first street, clear of the playable
    // road and property plots. These are scenery, not additional facilities.
    for (const [name,x,z,rotation] of [
      ['harbor_boathouse',-38,20,0], ['harbor_fishing_rack',-34,20,0],
      ['market_cafe_set',-18,20,0]
    ]) {
      const model = this.clone(name);
      if (model) { model.position.set(x,.22,z); model.rotation.y = rotation; group.add(model); }
    }
    return group;
  }
}
