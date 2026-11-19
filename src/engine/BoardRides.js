import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

let models;
function loadModels() {
  models ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/board-rides.glb`).then(pack=>pack.scene);
  return models;
}

export function syncBoardRide(pawn, vehicle) {
  const kind = vehicle === 'MOTOR' || vehicle === 'CAR' ? vehicle : null;
  if (pawn.rideKind === kind) return;
  pawn.rideKind = kind;
  if (pawn.ride) {
    pawn.characterMesh.position.set(0,0,0);
    for(const leg of pawn.characterMesh.cityRig.legs) leg.rotation.z=0;
    pawn.lastRidePosition=null;
  }
  pawn.ride?.removeFromParent();
  pawn.ride = null;
  pawn.wheels = [];
  pawn.characterMesh.userData.seatHeight = 0;
  if (!kind || !pawn.characterMesh.cityRig) return;
  loadModels().then(source => {
    if (pawn.rideKind !== kind || !pawn.mesh.parent || pawn.ride) return;
    const model = source.getObjectByName(kind)?.clone(true);
    if (!model) return;
    model.traverse(part => {
      if (part.name.startsWith('wheel_')) pawn.wheels.push(part);
      if (part.isMesh) part.castShadow = true;
    });
    pawn.ride = model;
    pawn.mesh.add(model);
    pawn.characterMesh.userData.seatHeight = kind==='MOTOR' ? .50 : .23;
  }).catch(()=>{ /* Walking model remains visible when the local asset is unavailable. */ });
}

export function poseBoardRide(pawn, facing, scale) {
  const model = pawn.characterMesh;
  const seat = model.userData.seatHeight;
  pawn.ride.rotation.y = facing;
  pawn.ride.scale.setScalar(scale);
  model.rotation.y = facing;
  const rear = pawn.rideKind==='MOTOR' ? -.35 : -.20;
  model.position.set(Math.sin(facing)*rear*scale,seat*scale,Math.cos(facing)*rear*scale);
  model.cityRig.legs.forEach((leg,i)=>{
    leg.rotation.x=-.93;
    leg.rotation.z=(i?1:-1)*.17;
  });
  model.cityRig.arms.forEach(arm=>{arm.rotation.x=-.90;});
}
