import {isPropertyTile} from '../game/BoardData.js';

const classicMaps=new Set(['taiwan-loop','city-loop','island-fork','fortune-crossroads']);
export const hasClassicFrontages=map=>classicMaps.has(map?.id);

function edgeDistance(x,z,a,b){
  const dx=b.x-a.x,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
}

// Keep all gameplay tiles intact. Land, sidewalks and entrances live in the renderer's map copy.
export function planClassicFrontages(map){
  if(!hasClassicFrontages(map))return map;
  const edges=map.tiles.flatMap(t=>t.next.map(id=>[t.position,map.tiles[id].position]));
  const lots=map.tiles.flatMap(t=>t.lot?.position?[t.lot.position]:[]);
  const services=new Set(['CARD_SHOP','BANK','PRISON','HOSPITAL','STOCK','COMPANY','MAGIC_HOUSE','MINIGAME','LOTTERY']);
  const tiles=map.tiles.map(tile=>{
    if(tile.lot || (!isPropertyTile(tile) && !services.has(tile.type)))return tile;
    const p=tile.position,b=map.tiles[tile.next[0]].position,angle=Math.atan2(b.z-p.z,b.x-p.x)+Math.PI/2;
    let best=null,score=-Infinity;
    for(const side of [0,Math.PI])for(const twist of [0,-.34,.34])for(const dist of [4.2,5.25]){
      const a=angle+side+twist,x=p.x+Math.cos(a)*dist,z=p.z+Math.sin(a)*dist;
      const clearance=Math.min(...edges.map(([a,b])=>edgeDistance(x,z,a,b)-1.75),...lots.map(l=>Math.hypot(x-l.x,z-l.z)-1.65));
      const rank=Math.min(clearance,2.15)*9-dist*.5-Math.abs(twist)+.05*(Math.hypot(x,z)-Math.hypot(p.x,p.z));
      if(rank>score){score=rank;best={x,z};}
    }
    lots.push(best);
    const frontage={position:best,rotation:Math.atan2(p.x-best.x,p.z-best.z)};
    return isPropertyTile(tile)?{...tile,lot:frontage}:{...tile,serviceFrontage:frontage};
  });
  return {...map,tiles};
}

// Sequences use the actual road tangent. Each pair opens onto the same continuous pedestrian strip.
export function classicStreetRows(map){
  if(!hasClassicFrontages(map))return [];
  const starts={
    'taiwan-loop':[12,15,22,25,32,35],
    'city-loop':[10,13,18,22,26],
    'island-fork':[13,16,20,24,28],
    'fortune-crossroads':[9,17,25]
  };
  const rows=[];
  for(const id of starts[map.id]){
    const a=map.tiles[id].position,b=map.tiles[map.tiles[id].next[0]].position;
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
    let nx=-dz/len,nz=dx/len;
    if(nx*a.x+nz*a.z<0){nx=-nx;nz=-nz;}
    // On the near bank keep the foreground low; face entrances toward the road and camera.
    if(nz>.48 || (nx>.75 && Math.abs(nz)<.25)){nx=-nx;nz=-nz;}
    for(const distance of [8.25,10.5,12,-9,-12]){
      const x=(a.x+b.x)/2+nx*distance,z=(a.z+b.z)/2+nz*distance;
      const occupied=map.tiles.some(tile=>{
        const site=tile.lot?.position||tile.serviceFrontage?.position;
        if(site){
          const u=(site.x-x)*nz-(site.z-z)*nx,v=(site.x-x)*nx+(site.z-z)*nz;
          if(Math.abs(u)<6 && Math.abs(v)<3.8)return true;
        }
        return tile.next.some(n=>edgeDistance(x,z,tile.position,map.tiles[n].position)<6.2);
      });
      if(occupied)continue;
      const facing=Math.atan2(-nx*Math.sign(distance),-nz*Math.sign(distance));
      rows.push([x,z,.91,(id+rows.length)%3,facing]);
      break;
    }
  }
  return rows;
}
