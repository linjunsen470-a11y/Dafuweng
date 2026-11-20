import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Low, removable street furniture leaves the road-facing half and the ownership flag visible.
export function streetYard(tile,style){
  const parts=[],variant=tile.id%3;
  function add(geometry,color,x,y,z,scale=null,turn=0){
    if(scale)geometry.scale(...scale);
    geometry.rotateY(turn);geometry.translate(x,y,z);
    if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}
    const tint=new THREE.Color(color),colors=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3)tint.toArray(colors,i);
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(geometry);
  }
  const box=(x,y,z,w,h,d,c)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z);
  const pot=(x,z,r,h)=>add(new THREE.CylinderGeometry(r,r*.77,h,12),'#aa684d',x,.08+h/2,z);
  const leaf=(x,y,z,w,h,d,c,bend=0)=>add(new THREE.IcosahedronGeometry(1,1),c,x,y,z,[w,h,d],bend);
  function flowers(x,z,width,stem){
    for(let i=0;i<5;i++){
      const a=i*2.4,px=x+Math.cos(a)*width*.57,pz=z+Math.sin(a)*width*.42;
      leaf(px,stem,pz,width*.48,.24,width*.35,i%2?'#51814b':'#386850',a);
      if(i%2===0)leaf(px+.04,stem+.18,pz,.115,.085,.105,variant===1?'#f0ba5d':'#e68a83');
    }
  }
  if(style==='dock'){
    // A coil on a bollard, a lobster trap, or buoys waiting to be strung.
    if(variant===0){
      pot(-.65,-.51,.28,.63);
      for(let k=0;k<3;k++)add(new THREE.TorusGeometry(.34+k*.055,.055,5,16).rotateX(Math.PI/2),'#e0b878',-.65,.16+k*.078,-.51);
    }else if(variant===1){
      box(-.51,.22,-.42,1.17,.23,.87,'#8c6541');
      for(let i=0;i<=4;i++)add(new THREE.TorusGeometry(.41,.038,4,12,Math.PI).rotateY(Math.PI/2),'#cb995e',-.98+i*.24,.30,-.42);
      for(const dx of [-.32,0,.32])box(-.48,.54+(.32-Math.abs(dx))*.46,-.42+dx,1.22,.08,.08,'#836345');
    }else{
      for(let i=0;i<3;i++){
        const x=-.90+i*.34,z=-.67+(i%2)*.41;
        leaf(x,.33,z,.23,.26,.22,'#d86b48');box(x,.36,z,.43,.09,.28,'#f6d6a0');
      }
    }
  }else if(style==='station'){
    if(variant===0){
      for(const z of [-.78,-.2,.38])add(new THREE.TorusGeometry(.36,.06,6,14,Math.PI).rotateY(Math.PI/2),'#477371',-.69,.14,z);
      box(-.68,.10,-.22,.91,.09,1.64,'#a9a496');
    }else{
      pot(-.8,-.64,.43,.45);flowers(-.8,-.64,.47,.69);
      if(variant===1){
        box(.13,.44,-.71,1.05,.13,.43,'#98704a');
        for(const x of [-.24,.48])box(x,.27,-.71,.10,.36,.36,'#3e6765');
      }else{pot(.09,-.91,.30,.29);flowers(.09,-.91,.32,.47);}
    }
  }else{
    if(variant===1){
      for(const z of [-.90,.38])box(-.86,.58,z,.09,1.04,.09,'#9b7044');
      for(const y of [.43,.77,1.03])box(-.86,y,-.26,.09,.07,1.44,'#b29559');
      for(let i=0;i<8;i++)leaf(-.86,.36+i*.097,-.68+(i%3)*.36,.23,.16,.27,i%2?'#568452':'#87aa5c',i);
    }else if(variant===2){
      pot(-.78,-.67,.51,.41);flowers(-.78,-.67,.55,.64);
      pot(.19,-.79,.31,.28);flowers(.19,-.79,.32,.44);
    }else{
      box(-.56,.22,-.44,.99,.28,1.54,'#aa8769');
      for(let i=0;i<3;i++)flowers(-.56,-.93+i*.45,.43,.45);
    }
  }
  const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.90}));
  mesh.castShadow=mesh.receiveShadow=true;return mesh;
}
