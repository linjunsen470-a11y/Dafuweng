import * as THREE from 'three';

// Conservative screen bounds: when the box crosses the near/far plane, protect
// the viewport rather than allowing foreground atmosphere to cover the board.
export function projectedBox(box,camera,matrix=null) {
  const rect={left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity};
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const p=new THREE.Vector3(x,y,z);if(matrix)p.applyMatrix4(matrix);p.project(camera);
    if(!Number.isFinite(p.x)||p.z < -1||p.z > 1)return {left:-1,right:1,bottom:-1,top:1};
    rect.left=Math.min(rect.left,p.x);rect.right=Math.max(rect.right,p.x);rect.bottom=Math.min(rect.bottom,p.y);rect.top=Math.max(rect.top,p.y);
  }
  return rect;
}
export function overlapsBoard(cloud,board){
  return cloud.right>=board.left&&cloud.left<=board.right&&cloud.top>=board.bottom&&cloud.bottom<=board.top;
}
