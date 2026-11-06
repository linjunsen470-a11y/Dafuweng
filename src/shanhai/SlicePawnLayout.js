/** Presentation only. Logical tile ids, movement paths and save data never change. */
export function pawnPlacement(tile,pawns,playerId,camera={x:0,z:1},target={x:0,z:0},roadAligned=false){
 const ids=pawns.filter(p=>p.playerId!==playerId&&((p.tileId===tile.id&&!p.inTransit)||(p.inTransit&&p.destinationTile===tile.id))).map(p=>p.playerId).concat(playerId).sort((a,b)=>a-b);
 const count=ids.length,scale=count===1?1.4:count===4?1.05:1.15,spacing=count===4?1.25:1.4;
 const dx=camera.x-target.x,dz=camera.z-target.z,length=Math.hypot(dx,dz)||1,offset=(ids.indexOf(playerId)-(count-1)/2)*spacing;
 const radius=Math.hypot(tile.position.x,tile.position.z)||1;
 const right=roadAligned?{x:tile.position.z/radius,z:-tile.position.x/radius}:{x:dz/length,z:-dx/length};
 return {x:tile.position.x+offset*right.x,y:.22,z:tile.position.z+offset*right.z,scale,count};
}
export function crowdGroups(pawns){
 const groups=new Map();for(const p of pawns){if(p.inTransit)continue;const group=groups.get(p.tileId)||[];group.push(p);groups.set(p.tileId,group);}
 return [...groups].filter(([,members])=>members.length>1);
}
export function avoidBadgeOverlap(box,obstacles,height){
 const overlaps=(a,b)=>a.left<b.right+5&&a.right>b.left-5&&a.top<b.bottom+5&&a.bottom>b.top-5;
 const size=box.bottom-box.top;let result={...box};
 // Prefer a clear spot above the crowd; then below, always inside the canvas.
 for(let i=0;i<=obstacles.length;i++){
  const hit=obstacles.find(o=>overlaps(result,o));if(!hit)return result;
  const top=hit.top-size-7;if(top>=4){result={...result,top,bottom:top+size};continue;}
  break;
 }
 result={...box};
 for(let i=0;i<=obstacles.length;i++){
  const hit=obstacles.find(o=>overlaps(result,o));if(!hit)return result;
  const bottom=hit.bottom+size+7;if(bottom>height-4)break;result={...result,top:bottom-size,bottom};
 }
 return result;
}
