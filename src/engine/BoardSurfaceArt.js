import * as THREE from 'three';

// Each original 256px painted sample is reused across its whole district.
const styles={
  'grand-bay': {roof:'slate',pave:'setts',plot:'wharf',stone:'#bdb3a0',road:'#687977'},
  'island-fork': {roof:'metal',pave:'coral',plot:'wharf',stone:'#d6b58c',road:'#668483'},
  'taiwan-loop': {roof:'pan',pave:'brick',plot:'tea',stone:'#d2ad89',road:'#838079'},
  'fortune-crossroads': {roof:'shake',pave:'setts',plot:'meadow',stone:'#c2b495',road:'#748070'},
  'city-loop': {roof:'metal',pave:'metro',plot:'plaza',stone:'#c9c6bd',road:'#637782'}
};
const textures=new Map();
export const streetArt=id=>styles[id]||styles['grand-bay'];
function variation(seed){const n=Math.sin(seed*72.13+1.73)*9271.41;return n-Math.floor(n);}
function wash(ctx,x,y,w,h,light,alpha){
  ctx.fillStyle=light?'rgba(255,244,212,'+alpha+')':'rgba(64,46,40,'+alpha+')';
  ctx.fillRect(x,y,w,h);
}
function stroke(ctx,points,color,width){
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
export function surfaceTexture(id,kind){
  const key=id+'/'+kind;
  if(textures.has(key))return textures.get(key);
  const style=streetArt(id),canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const c=canvas.getContext('2d');
  c.fillStyle=kind==='pave'?style.stone:kind==='road'?style.road:'#e5e1d5';c.fillRect(0,0,256,256);
  if(kind==='roof'){
    const metal=style.roof==='metal',pan=style.roof==='pan',shake=style.roof==='shake';
    const w=metal?64:32,h=metal?128:32;
    for(let row=-1;row<256/h;row++)for(let col=-1;col<=256/w;col++){
      const x=col*w+(metal?0:(row&1)*w/2),y=row*h;
      const v=variation(((col+8)%8)+((row+8)%8)*11);
      const shade=c.createLinearGradient(x,y,metal?x+w:x,metal?y:y+h);
      shade.addColorStop(0,metal?'#bac9c6':'#abaaa4');shade.addColorStop(.22,'#dddcd4');shade.addColorStop(.82,'#fbf2df');shade.addColorStop(1,'#bfb6a8');
      c.fillStyle=shade;c.fillRect(x,y,w,h);
      wash(c,x,y,w,h,false,v*.15);
      if(pan){
        c.beginPath();c.moveTo(x+1,y+h-6);c.quadraticCurveTo(x+w/2,y+h+2,x+w-1,y+h-6);
        c.strokeStyle='#958b80';c.lineWidth=3;c.stroke();
      }else stroke(c,[[x+1,y+2],[x+1,y+h-1],[x+w,y+h-1]],metal?'#98a9a6':'#aa9d8d',metal?2:2.5);
      if(shake || metal)stroke(c,[[x+w*.25,y+4],[x+w*.26,y+h*(.48+v*.4)]],'rgba(99,83,62,.27)',1.2);
      if(metal)wash(c,x+3,y,2,h,true,.84);
    }
  }else if(kind==='pave' || kind==='road'){
    const road=kind==='road',setts=style.pave==='setts',metro=style.pave==='metro';
    const h=metro?64:setts?32:32,w=metro?64:setts?32:64;
    for(let row=0;row<256/h;row++)for(let col=-1;col<=256/w;col++){
      const x=col*w+(metro?0:(row&1)*w/2),y=row*h,v=variation(row*9+(col+9)%8);
      wash(c,x+1,y+1,w-2,h-2,v>.43,.06+v*.12);
      stroke(c,[[x+1,y+h-1],[x+1,y+1],[x+w,y+1]],road?'rgba(31,42,46,.26)':'rgba(90,69,56,.43)',road?2:2.7);
      stroke(c,[[x+4,y+4],[x+w-3,y+4]],'rgba(254,242,205,.48)',road?1:2);
      if(!road && (setts || style.pave==='coral'))stroke(c,[[x+w-8,y+2],[x+w-2,y+7]],'rgba(112,93,77,.34)',1.7);
    }
  }else{
    const wharf=style.plot==='wharf',plaza=style.plot==='plaza';
    for(let k=0;k<8;k++){
      if(wharf){
        wash(c,0,k*32,256,2,false,.34);
        for(let j=0;j<3;j++)stroke(c,[[j*83,k*32+9],[j*83+34,k*32+7],[j*83+58,k*32+11]],'rgba(102,78,56,.34)',1.6);
      }else if(plaza){
        wash(c,k*32,0,2,256,false,.27);wash(c,0,k*32,256,2,false,.27);
      }else for(let j=0;j<10;j++){
        const x=(j+variation(k*14+j)) *26,y=(k+variation(j*13+k))*32;
        stroke(c,[[x-2,y-3],[x,y],[x+2,y-4]],'rgba(92,104,61,.35)',1.6);
      }
    }
    // A light cap and dark joint give the outer survey kerb depth without hiding ownership colours.
    c.strokeStyle='#9e9684';c.lineWidth=12;c.strokeRect(5,5,246,246);
    c.strokeStyle='#f4e7c6';c.lineWidth=3;c.strokeRect(11,11,234,234);
    for(let k=0;k<256;k+=32){wash(c,k,0,2,10,false,.46);wash(c,k,246,2,10,false,.46);wash(c,0,k,10,2,false,.46);wash(c,246,k,10,2,false,.46);}
  }
  for(let i=0;i<1550;i++)wash(c,variation(i)*256,variation(i+2381)*256,1.6,1,i%2,.12);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.userData.sharedBoardTexture=true;
  textures.set(key,texture);return texture;
}

// The architecture is already batched by colour. Apply relief only to elevated,
// upward-facing surfaces so the same mesh can keep its windows and walls clean.
export function finishRoofs(group,id){
  const sample=surfaceTexture(id,'roof');
  group.traverse(mesh=>{
    if(!mesh.isMesh || mesh.isInstancedMesh)return;
    for(const material of [].concat(mesh.material)){
      if(!material?.isMeshStandardMaterial || material.map || material.transparent || material.userData.roofFinish)continue;
      material.userData.roofFinish=true;
      material.onBeforeCompile=shader=>{
        shader.uniforms.roofPaper={value:sample};
        shader.vertexShader='varying vec3 finishPosition;\nvarying float finishUp;\n'+shader.vertexShader.replace('#include <project_vertex>',
          'finishPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\nfinishUp=normalize(mat3(modelMatrix)*objectNormal).y;\n#include <project_vertex>');
        shader.fragmentShader='uniform sampler2D roofPaper;\nvarying vec3 finishPosition;\nvarying float finishUp;\n'+shader.fragmentShader.replace('#include <color_fragment>',
          '#include <color_fragment>\nfloat finishWeight=smoothstep(1.72,2.18,finishPosition.y)*smoothstep(.46,.72,finishUp);\nvec3 paper=texture2D(roofPaper,finishPosition.xz/3.65).rgb;\ndiffuseColor.rgb*=mix(vec3(1.0),paper*1.33,finishWeight*.88);');
      };
    }
  });
  return group;
}
