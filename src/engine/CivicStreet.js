import * as THREE from 'three';

export const isCivicHome = (map, tile, type) => Boolean(map?.id === 'grand-bay'
  && (tile?.group === 'CBD_1' || (tile?.group === 'CBD_3' && tile.id < 84) || [86,88,91,93,108,111,113,116,118].includes(tile?.id)) && !tile.large && (!type || type === 'RESIDENTIAL'));

// Pavement sits below the playable road. Keep the branch at 60 clear.
export function civicStreets(map) {
  const group = new THREE.Group();
  group.name = 'civic-street-frontage';
  if (map.id !== 'grand-bay') return group;
  const paving = new THREE.MeshStandardMaterial({color:'#c5cec8',roughness:1});
  const planter = new THREE.MeshStandardMaterial({color:'#6b8d7b',roughness:1});
  const bench = new THREE.MeshStandardMaterial({color:'#a87852',roughness:1});
  const slab = (x,y,z,w,h,d,mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z); mesh.receiveShadow=true; group.add(mesh);
  };
  for (const [x,z,w,d] of [[-32,-38.25,44,.85],[-55.2,-38.25,2.4,.85],[-56.25,-34.25,.85,8],[-14.5,-33.65,9,1],[-38,-33.65,26,1],[-10,-30.8,5,4],[-42,-30.8,4,3.2],[-17,-27,4.4,3.4],[-13.5,-29.7,3.4,.7],[-15.1,-29.1,.7,1.5]]) {
    slab(x,.17,z,w,.08,d,paving);
  }
  // West return promenade joins the original harbor pavement, clear of 83→0.
  for (const [x,z,w,d] of [[-56.25,21,.85,18],[-54.15,30,4.2,.85],[-51.7,18.6,.8,13.3],[-39.1,25.25,26,.8],[-48.3,12,4.2,3.8],[-47.8,22,4.8,3.6]]) {
    slab(x,.17,z,w,.08,d,paving);
  }
  for (const z of [15.5,18]) {
    slab(-47.4,.35,z,.65,.5,1.5,planter);
    slab(-48.2,.57,z,.5,.14,1.5,bench);
  }
  // A narrow pedestrian edge follows the existing 12→84…95→24 branch.
  // Off-road paving, not new graph edges; existing lot paths still meet the tiles.
  const edge = [[-3.6,26.4],[16.4,6.4],[18,5.8],[30,5.8],[31.6,6.4],[47.6,22.4],[47.6,25.25],[44,25.25]];
  for (let i=1;i<edge.length;i++) {
    const [ax,az]=edge[i-1], [bx,bz]=edge[i];
    const walk=new THREE.Mesh(new THREE.BoxGeometry(.65,.08,Math.hypot(bx-ax,bz-az)),paving);
    walk.position.set((ax+bx)/2,.17,(az+bz)/2);walk.rotation.y=Math.atan2(bx-ax,bz-az);walk.receiveShadow=true;group.add(walk);
  }
  slab(22,.17,2.5,4.6,.08,3.8,paving);
  for(const x of [18.5,25.5]) {
    slab(x,.35,1.2,1.2,.5,.65,planter);
    slab(x,.57,2.0,1.2,.14,.5,bench);
  }
  // Arcade-to-bank walkway stays beside the existing diagonal, not on its tiles.
  for (const [ax,az,bx,bz] of [[-17,-27,-20.4,-26.4],[-20.4,-26.4,-40.4,-6.4]]) {
    const walk=new THREE.Mesh(new THREE.BoxGeometry(.75,.08,Math.hypot(bx-ax,bz-az)),paving);
    walk.position.set((ax+bx)/2,.17,(az+bz)/2);walk.rotation.y=Math.atan2(bx-ax,bz-az);walk.receiveShadow=true;group.add(walk);
  }
  slab(-29.8,.17,-11.8,5,.08,4,paving);
  // Low garden terraces make the bank a recognizable halfway stop without a wall across the route.
  slab(-26.9,.40,-11.8,.3,.45,5,paving);
  for (const z of [-14.1,-9.5]) {
    slab(-28.1,.35,z,2.4,.5,.6,planter);
    slab(-28.1,.57,z+.5,2.2,.14,.45,bench);
  }
  // Materials showroom promenade links the existing old-town fork to the company.
  slab(44.7,.17,-13.7,18.6,.08,.7,paving);
  slab(36.5,.17,-10.5,4.4,.08,3.8,paving);
  for (const x of [33.9,39.1]) {
    slab(x,.35,-9.5,.65,.5,1.8,planter);
    slab(x,.57,-11.2,.65,.14,1.4,bench);
  }
  // Cleared return-bend frontages; leave the numbered branch and main road exposed.
  slab(-47.4,.17,-15,.65,.08,8,paving);
  slab(-45.4,.17,-.9,4.2,.08,.7,paving);
  slab(-43.3,.35,-19.5,1.6,.5,.65,planter);
  slab(-43.3,.57,-20.2,1.6,.14,.45,bench);
  slab(-57.375,.17,-16,3.25,.08,.65,paving);
  // Clinic forecourt links its entrance to the existing hospital tile, between lots71/73.
  slab(-57.25,.17,-16,.7,.08,3,paving);
  for (const z of [-17.35,-14.65]) {
    slab(-58,.35,z,.65,.5,.45,planter);
    slab(-57.25,.4,z,.65,.16,.35,bench);
  }
  // Three low seating bays flank real services, never compete with tile markers.
  for (const x of [-16,-34,-48]) {
    slab(x,.35,-31.8,1.9,.5,.65,planter);
    slab(x,.57,-32.55,1.8,.14,.5,bench);
  }
  return group;
}
