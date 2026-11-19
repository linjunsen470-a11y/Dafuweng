import {AnimationMixer, LoopOnce} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';

const models=['xiaoman','tianye','jingjing','baroque','lan','miya','hawk','afei',
  'audela','tangguo','kurosawa','milo','danny','sarah','miyamoto','babyjin'];
const packs=new Map();
export async function attachSkinnedPawn(pawn,profileId) {
  const model=models[profileId];
  if(!model)return;
  try {
    if(!packs.has(model)) packs.set(model,new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/${model}.glb`));
    const pack=await packs.get(model);
    if (!pawn.mesh.parent) return;
    const figure=clone(pack.scene);
    figure.scale.setScalar(1.15);
    const mixer=new AnimationMixer(figure);
    const actions=new Map(pack.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
    for(const part of pawn.characterMesh.children) part.visible=false;
    pawn.characterMesh.add(figure);
    pawn.skin={model,figure,mixer,actions,last:performance.now(),name:null,reaction:null};
    mixer.addEventListener('finished',()=>{if(pawn.skin) pawn.skin.reaction=null;});
  } catch {
    packs.delete(model);
    // The original procedural figure remains playable if the asset fails to load.
  }
}

export function animateSkin(pawn,reduced) {
  const skin=pawn.skin;
  if (!skin) return;
  const name=skin.reaction || (pawn.ride?'Ride':pawn.mesh.userData.isMoving?'Walk':'Idle');
  const action=skin.actions.get(name);
  if (name!==skin.name) {
    skin.actions.get(skin.name)?.fadeOut(.10);
    action.reset().fadeIn(.10).play();
    skin.name=name;
  }
  const now=performance.now();
  if(reduced){
    action.time=action.getClip().duration*.35;
    skin.mixer.update(0);
    skin.reaction=null;
  } else skin.mixer.update(Math.min(.12,(now-skin.last)/1000));
  skin.last=now;
}

export function reactSkin(pawn,name) {
  if (!pawn?.skin) return;
  const action=pawn.skin.actions.get(name);
  action.setLoop(LoopOnce,1);action.clampWhenFinished=true;
  action.reset();
  pawn.skin.reaction=name;
}

export function detachSkin(pawn) {
  if (!pawn.skin) return;
  const {figure,mixer}=pawn.skin;
  mixer.stopAllAction();mixer.uncacheRoot(figure);
  figure.removeFromParent();
  figure.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.dispose();});
  pawn.skin=null;
}
