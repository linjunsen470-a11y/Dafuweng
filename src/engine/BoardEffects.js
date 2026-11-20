import * as THREE from 'three';
import { playEffect, quietMotion, releaseEffect } from './EffectTimeline.js';
import { describeCharacterReactions } from '../game/CharacterReactions.js';

const tau = 2 * Math.PI;
const paint = color => new THREE.MeshBasicMaterial({ color });
const ring = (radius, color) => {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(radius * .89, radius, 32), paint(color));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
};
function particles(group, geometry, color, count) {
  const batch = new THREE.InstancedMesh(geometry, paint(color), count);
  batch.frustumCulled = false;
  group.add(batch);
  const pose = new THREE.Object3D();
  return draw => {
    for (let i = 0; i < count; i++) {
      draw(pose, i);
      pose.updateMatrix();
      batch.setMatrixAt(i, pose.matrix);
    }
    batch.instanceMatrix.needsUpdate = true;
  };
}

export class BoardEffects {
  constructor(view, board, pawns, state) {
    Object.assign(this, { view, board, pawns, state });
    this.active = new Set();
  }

  run(name, group, duration, frame, cleanup = () => {}) {
    group.name = name;
    this.view.scene.add(group);
    const stop = playEffect(duration, frame, () => {
      releaseEffect(group);
      cleanup();
      this.active.delete(stop);
    }, quietMotion);
    this.active.add(stop);
  }

  clear() { for (const stop of this.active) stop(); }

  present(event) {
    if (quietMotion() || event.success === false) return;
    const player = this.state.players[event.playerId] || this.state.getCurrentPlayer();
    const pawn = player && this.pawns.getPawnMesh(player.id);
    if (event.type === 'RENT_PAID' && event.amount > 0) {
      const owner = this.pawns.getPawnMesh(event.ownerId);
      if (pawn && owner) this.rent(event, pawn, owner);
      if (event.chainSize > 1) this.property(event.tileId, true);
    } else if (event.type === 'PROPERTY_PURCHASED' || event.type === 'PROPERTY_UPGRADED') {
      this.property(event.tileId, false);
    } else if (event.type === 'CARD_USED' && ['MISSILE', 'NUKES'].includes(event.cardId)) {
      this.blast(pawn?.position, event.targetId, event.cardId === 'NUKES');
    } else if (event.type === 'MINE_EXPLODED' && !event.avoided) {
      this.blast(null, event.tileId);
    } else if (pawn && (event.type === 'OBSTACLE_CONSUMED' || event.hitEntityType === 'BARRIER' || (event.type === 'CARD_USED' && event.cardId === 'TURN_AROUND'))) {
      const turn = event.type === 'CARD_USED';
      this.roadCue(turn ? this.pawns.getPawnMesh(event.targetId) || pawn : pawn, turn, event.tileId);
    }
  }

  rent(event, payer, owner) {
    const group = new THREE.Group();
    const count = event.amount >= 2000 ? 20 : 9;
    const coins = particles(group, new THREE.CylinderGeometry(.15,.15,.06,12), count > 9 ? '#ffe05d' : '#f6b533', count);
    const cues = describeCharacterReactions(event, this.state);
    const labels = [payer, owner].map((mesh, index) => {
      const bubble = document.createElement('div');
      bubble.className = 'board-speech ' + (index ? 'income' : 'expense');
      const value = document.createElement('b');
      value.textContent = (index ? '+ $' : '− $') + event.amount.toLocaleString();
      const line = document.createElement('span');
      line.textContent = cues[index]?.line || '';
      bubble.append(value, line);
      document.body.append(bubble);
      return bubble;
    });
    const point = new THREE.Vector3();
    this.run('rent-flight', group, 1500, t => {
      coins((pose, i) => {
        const u = THREE.MathUtils.clamp(t * 1.6 - i / count * .6, 0, 1);
        pose.position.lerpVectors(payer.position, owner.position, u);
        pose.position.y += 1.8 + Math.sin(u*Math.PI)*(2.4+i%3*.25);
        pose.position.x += Math.sin(u*Math.PI)*(i%3-1)*.55;
        pose.rotation.set(u*8, i, .5);
        pose.scale.setScalar(u > 0 && u < 1 ? 1 : 0);
      });
      labels.forEach((label, i) => {
        point.copy(i ? owner.position : payer.position);
        point.y += i ? 3.7 : 2.2;
        point.project(this.view.camera);
        label.hidden = Math.abs(point.z)>1 || Math.abs(point.x)>1 || Math.abs(point.y)>1;
        const x = (1+point.x)*innerWidth/2 + (i ? 53 : -53);
        label.style.left = Math.max(62, Math.min(innerWidth-62,x))+'px';
        label.style.top = Math.max(5, Math.min(innerHeight-55,(1-point.y)*innerHeight/2))+'px';
      });
    }, () => labels.forEach(label => label.remove()));
  }

  blast(origin, tileId, large = false) {
    const target = this.board.tilePositions[tileId];
    const launch = origin?.clone();
    if (!target || quietMotion()) return;
    const group = new THREE.Group(), rocket = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.22,.7,3,8),paint('#f27852'));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(.27,.48,8),paint('#ffe56d'));
    nose.position.y=.67;
    rocket.add(body,nose);
    group.add(rocket);
    const waves = [ring(1.5, '#ffe174'),ring(1.1,'#fb7052')];
    waves.forEach(mesh => { mesh.position.copy(target); mesh.position.y+=.16; group.add(mesh); });
    const smoke = particles(group, new THREE.IcosahedronGeometry(.3,0), '#ddacc7', 12);
    const chips = particles(group, new THREE.BoxGeometry(.16,.23,.18), '#bd8152', 12);
    let impact = false;
    const path = (point,u) => {
      point.lerpVectors(launch || target,target,u);
      point.y += .55 + Math.sin(Math.PI*u)*5;
    };
    this.run('cartoon-blast', group, origin ? 1300 : 720, t => {
      const u = Math.min(1,t/.48);
      const burst = origin ? Math.max(0,(t-.48)/.52) : t;
      rocket.visible = Boolean(origin) && u < 1;
      path(rocket.position,u);
      if (rocket.visible) {
        const tangent = new THREE.Vector3().subVectors(target,launch);
        tangent.y += Math.PI*5*Math.cos(Math.PI*u);
        rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent.normalize());
      }
      if (burst > 0 && !impact) { this.view.shakeCamera(large ? .36 : .16, 180); impact=true; }
      waves.forEach((mesh,i) => {mesh.visible = burst>0; mesh.scale.setScalar((large?3:2)*burst*(1+i*.25));});
      smoke((pose,i) => {
        if (rocket.visible) {
          path(pose.position,Math.max(0,u-i*.025));
          pose.scale.setScalar(.8-i*.047);
        } else {
          const a = i*tau/12;
          pose.position.copy(target);
          pose.position.x += Math.cos(a)*burst*(large?4:2.3);
          pose.position.z += Math.sin(a)*burst*(large?4:2.3);
          pose.position.y += .4+burst*(1+i%3);
          pose.scale.setScalar(2*Math.sin(Math.PI*burst));
        }
      });
      chips((pose,i) => {
        const a = i*2.4;
        pose.position.copy(target);
        pose.position.x += burst*3*Math.cos(a);
        pose.position.z += burst*3*Math.sin(a);
        pose.position.y += .2+Math.sin(Math.PI*burst)*(1+i%3);
        pose.rotation.set(burst*6,a,burst*4);
        pose.scale.setScalar(burst>0 ? 1-burst : 0);
      });
    });
  }

  property(id, chainOnly) {
    const positions = this.board.tilePositions;
    if (!positions[id]) return;
    const group = new THREE.Group();
    const chain = [...this.state.propertyManager.streetChain(id)];
    const waves = chain.length > 1 ? chain.map(tile => {
      const wave = ring(1.6,'#ffcc46');
      wave.position.copy(positions[tile]);
      wave.position.y += .14;
      group.add(wave);
      return wave;
    }) : [];
    const stars = !chainOnly && particles(group,new THREE.OctahedronGeometry(.15), '#ffcd37', 14);
    this.run('property-celebration',group,1100,t => {
      if (stars) stars((pose,i) => {
        pose.position.copy(this.board.buildingMeshes.get(id)?.position || positions[id]);
        pose.position.x += t*2.8*Math.cos(i*2.4);
        pose.position.z += t*2.8*Math.sin(i*2.4);
        pose.position.y += 1+Math.sin(t*Math.PI)*(1+i%3);
        pose.scale.set(1-t,2*(1-t),1-t);
        pose.rotation.z=t*5;
      });
      waves.forEach((wave,i) => {
        const u = t*2-i/waves.length;
        wave.visible=u>0 && u<1;
        wave.scale.setScalar(.6+u*.85);
      });
    });
  }

  roadCue(pawn, turn, tileId) {
    const group = new THREE.Group();
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(.28,.65,3),paint(turn?'#61bbbe':'#e47542'));
    const halo = ring(.65,turn?'#ffda66':'#ef9653');
    arrow.rotation.z=-Math.PI/2;
    arrow.position.set(0,0,.65);
    group.add(arrow,halo);
    const figure = turn ? null : pawn;
    const initial = figure?.rotation.z || 0;
    this.run(turn?'direction-arrow':'barrier-brake',group,640,t => {
      group.position.copy(turn ? pawn.position : this.board.tilePositions[tileId] || pawn.position);
      group.position.y += turn ? 2.6 : .3;
      group.rotation.y=turn ? t*tau : 0;
      halo.scale.setScalar(1+.4*Math.sin(Math.PI*t));
      if (!turn && figure) figure.rotation.z=initial+.22*Math.sin(t*tau)*(1-t);
    }, () => { if (figure) figure.rotation.z=initial; });
  }
}
