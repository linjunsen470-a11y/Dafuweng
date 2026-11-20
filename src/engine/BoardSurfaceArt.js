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

// The channels carry stone joints, meadow brushwork and water reflections.
// All are painted once at board scale and reused without extra scene meshes.
let detailAtlas;
function landscapePaper(){
  if(detailAtlas)return detailAtlas;
  const size=256;
  const layer=()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    return canvas.getContext('2d');
  };
  const stone=layer(),grass=layer(),water=layer();
  for(const ctx of [stone,grass,water]){
    ctx.fillStyle='#b2b2b2';ctx.fillRect(0,0,size,size);
  }
  for(let row=-1;row<8;row++)for(let col=-1;col<5;col++){
    const x=col*64+(row&1)*32,y=row*32;
    const shade=164+Math.floor(variation((row+8)%8*11+(col+4)%4)*44);
    stone.fillStyle='rgb('+shade+' '+shade+' '+shade+')';
    stone.fillRect(x+1,y+1,62,30);
    stroke(stone,[[x+1,y+30],[x+62,y+30],[x+62,y+2]],'#666',2.4);
    stroke(stone,[[x+2,y+28],[x+2,y+2],[x+60,y+2]],'#ddd',2);
  }
  for(let i=0;i<98;i++){
    const x=variation(i+77)*size,y=variation(i+189)*size,r=4+variation(i+888)*15;
    for(const dx of [-size,0,size])for(const dy of [-size,0,size]){
      const px=x+dx,py=y+dy;
      if(px+r<0 || py+r<0 || px-r>size || py-r>size)continue;
      const glow=grass.createRadialGradient(px,py,0,px,py,r);
      glow.addColorStop(0,i%3?'#828282':'#e1e1e1');glow.addColorStop(1,'rgba(178,178,178,0)');
      grass.fillStyle=glow;grass.fillRect(px-r,py-r,2*r,2*r);
    }
  }
  for(let i=0;i<710;i++){
    const x=variation(i+21)*size,y=variation(i+97)*size;
    stroke(grass,[[x-2,y-1],[x,y+1],[x+1,y-3]],i%3?'#909090':'#d9d9d9',1.35);
  }
  for(let i=0;i<150;i++){
    const x=variation(i+150)*size,y=variation(i+772)*size,w=3+variation(i+881)*16;
    for(const dx of [0,-size]){
      water.beginPath();water.moveTo(x+dx,y);
      water.bezierCurveTo(x+dx+w*.35,y-3,x+dx+w*.68,y+2,x+dx+w,y-1);
      water.strokeStyle=i%4?'#e4e4e4':'#858585';water.lineWidth=i%3+1;water.stroke();
    }
  }
  const rgb=layer(),data=rgb.createImageData(size,size);
  const layers=[stone,grass,water].map(ctx=>ctx.getImageData(0,0,size,size).data);
  for(let j=0;j<data.data.length;j+=4){
    for(let k=0;k<3;k++)data.data[j+k]=layers[k][j];data.data[j+3]=255;
  }
  rgb.putImageData(data,0,0);
  detailAtlas=new THREE.CanvasTexture(rgb.canvas);
  detailAtlas.wrapS=detailAtlas.wrapT=THREE.RepeatWrapping;detailAtlas.anisotropy=4;
  return detailAtlas;
}

const waterColors=new Set(['73a99b','9cc4ac','52adaa','6ba7a0','77afa0']);
export const surfaceTime={value:0};
function finishMaterial(material,roof,terrain=false){
  if(!material?.isMeshStandardMaterial || material.userData.roofFinish)return;
  material.userData.roofFinish=true;
  const color=material.color;
  const water=waterColors.has(color.getHexString());
  const planted=color.g>color.r*.94 && color.g>color.b*1.30;
  const shaderMode=terrain?'terrain':water?'water':planted?'plant':'stone';
  material.customProgramCacheKey=()=>'board-surface-2-'+shaderMode;
  material.onBeforeCompile=shader=>{
    shader.uniforms.roofPaper={value:roof};
    shader.uniforms.districtPaper={value:landscapePaper()};shader.uniforms.tide=surfaceTime;
    shader.vertexShader='varying vec3 finishPosition; varying vec3 finishNormal;\n'+shader.vertexShader.replace('#include <project_vertex>',
      'finishPosition=(modelMatrix*vec4(transformed,1.0)).xyz;finishNormal=normalize(mat3(modelMatrix)*objectNormal);\n#include <project_vertex>');
    const ground=`
      vec2 groundUV=finishPosition.xz/6.4;
      float brush=texture2D(districtPaper,groundUV).g;
      float broad=texture2D(districtPaper,groundUV*.37+.27).g;
      diffuseColor.rgb*=mix(1.,.42+.77*brush+.24*broad,green);
    `;
    const waterFinish=`
      vec2 p=finishPosition.xz;
      vec2 uv=vec2(p.x*.17+p.y*.06,p.y*.16);
      float ripples=texture2D(districtPaper,uv+vec2(tide*.013,.032*sin(p.x*.46+tide*.14))).b;
      float current=.5+.5*sin(.67*p.y+1.2*sin(p.x*.31)+tide*.28);
      diffuseColor.rgb*=mix(vec3(.53,.81,.88),vec3(1.04,1.10,1.05),current);
      diffuseColor.rgb+=vec3(.28,.45,.40)*smoothstep(.72,.94,ripples);
    `;
    const architecture=`
      vec3 n=normalize(finishNormal);
      vec2 faceUV=vec2(abs(n.x)>abs(n.z)?finishPosition.z:finishPosition.x,finishPosition.y)/3.1;
      float course=texture2D(districtPaper,faceUV).r;
      float contact=mix(.72,1.,smoothstep(.03,1.45,finishPosition.y));
      float vertical=1.-smoothstep(.26,.68,abs(n.y));
      diffuseColor.rgb*=mix(1.,contact*(.70+course*.42),vertical);
      float terrace=(1.-smoothstep(.9,1.9,finishPosition.y))*smoothstep(.6,.93,n.y);
      ${planted?'float green=terrace;'+ground:
        'float paving=texture2D(districtPaper,finishPosition.xz/4.1).r;diffuseColor.rgb*=mix(1.,.54+.62*paving,terrace);'}
      float roofWeight=smoothstep(1.72,2.18,finishPosition.y)*smoothstep(.46,.72,n.y);
      vec3 paper=texture2D(roofPaper,finishPosition.xz/3.65).rgb;
      diffuseColor.rgb*=mix(vec3(1.),paper*1.33,roofWeight*.88);
    `;
    const paint=terrain?'float green=smoothstep(.01,.14,diffuseColor.g-diffuseColor.r)*smoothstep(.02,.13,diffuseColor.g-diffuseColor.b);'+ground:water?waterFinish:architecture;
    shader.fragmentShader='uniform sampler2D roofPaper;uniform sampler2D districtPaper;uniform float tide;varying vec3 finishPosition;varying vec3 finishNormal;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+paint);
  };
}
export function finishLandscape(mesh){
  finishMaterial(mesh.material,null,true);
  return mesh;
}
export function finishRoofs(group,id){
  const sample=surfaceTexture(id,'roof');
  group.traverse(mesh=>{
    if(!mesh.isMesh || mesh.isInstancedMesh)return;
    for(const material of [].concat(mesh.material))if(!material?.map && !material?.transparent)finishMaterial(material,sample);
  });
  return group;
}
