import * as THREE from 'three';
import { playEffect, quietMotion, releaseEffect } from './EffectTimeline.js';
import { describeCharacterReactions } from '../game/CharacterReactions.js';
import { createVFXSprite } from './CartoonVFX.js';
import { cityPortrait } from '../ui/CityPortrait.js';

const tau = 2 * Math.PI;
const paint = color => new THREE.MeshBasicMaterial({ color });
const gloss = (color, metalness = 0.25, roughness = 0.35) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });

const ring = (radius, color) => {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.85, radius, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
};

function particles(group, geometry, material, count) {
  const batch = new THREE.InstancedMesh(geometry, material, count);
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

function flashScreen(color = 'rgba(255, 224, 118, 0.38)', duration = 260) {
  if (typeof document === 'undefined' || quietMotion()) return;
  const flash = document.createElement('div');
  flash.className = 'vfx-comic-flash';
  flash.style.background = color;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), duration);
}

function portraitUrl(player, mapId) {
  if (!player) return null;
  return cityPortrait(player, mapId) || player.avatarImg || null;
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
    } else if (event.type === 'ITEM_USED' && ['MISSILE_ITEM', 'NUCLEAR_MISSILE'].includes(event.itemId)) {
      this.blast(pawn?.position, event.targetId, event.itemId === 'NUCLEAR_MISSILE');
    } else if (event.type === 'MINE_EXPLODED' && !event.avoided) {
      this.blast(null, event.tileId);
    } else if (pawn && ['BOARD_GOD_COLLECTED', 'STATUS_APPLIED', 'STATUS_CHANGED'].includes(event.type)) {
      const type = event.godType || event.status;
      const bad = ['MISFORTUNE', 'BAD', 'DEMON', 'GREAT_POOR', 'SMALL_POOR'].includes(type);
      this.spiritBurst(pawn.position, !bad);
    } else if (pawn && (event.type === 'OBSTACLE_CONSUMED' || event.hitEntityType === 'BARRIER' || (event.type === 'CARD_USED' && event.cardId === 'TURN_AROUND'))) {
      const turn = event.type === 'CARD_USED';
      this.roadCue(turn ? this.pawns.getPawnMesh(event.targetId) || pawn : pawn, turn, event.tileId);
    }
  }

  rent(event, payer, owner) {
    const group = new THREE.Group();
    const big = event.amount >= 2000;
    const count = big ? 20 : 9;
    // Keep InstancedMesh as children[0] for contract & GPU instancing efficiency
    const coins = particles(
      group,
      new THREE.CylinderGeometry(0.18, 0.18, 0.065, 14),
      gloss(big ? '#ffe04d' : '#f7b933', 0.65, 0.22),
      count
    );
    const sparkle = createVFXSprite('star', { scale: big ? 2.8 : 1.9, additive: true, opacity: 0 });
    sparkle.position.copy(owner.position).add(new THREE.Vector3(0, 2.2, 0));
    const coinFlash = createVFXSprite('coin', { scale: big ? 1.8 : 1.3, opacity: 0 });
    coinFlash.position.copy(owner.position).add(new THREE.Vector3(0, 2.5, 0));
    group.add(sparkle, coinFlash);

    const cues = describeCharacterReactions(event, this.state);
    const actors = [this.state.players[event.playerId], this.state.players[event.ownerId]];
    const labels = [payer, owner].map((mesh, index) => {
      const bubble = document.createElement('div');
      bubble.className = 'board-speech ' + (index ? 'income' : 'expense') + (big ? ' is-major' : '');
      const actor = actors[index];
      const pic = portraitUrl(actor, this.state.mapId);
      if (pic) {
        const avatar = document.createElement('img');
        avatar.className = 'board-speech-avatar';
        avatar.src = pic;
        avatar.alt = '';
        bubble.append(avatar);
      }
      const copy = document.createElement('div');
      const value = document.createElement('b');
      value.textContent = (index ? '+ $' : '− $') + event.amount.toLocaleString();
      const line = document.createElement('span');
      line.textContent = cues[index]?.line || '';
      copy.append(value, line);
      bubble.append(copy);
      document.body.append(bubble);
      return bubble;
    });

    const point = new THREE.Vector3();
    if (big) this.view.shakeCamera?.(0.14, 180);
    this.run('rent-flight', group, 1650, t => {
      coins((pose, i) => {
        const u = THREE.MathUtils.clamp(t * 1.55 - (i / count) * 0.55, 0, 1);
        pose.position.lerpVectors(payer.position, owner.position, u);
        pose.position.y += 1.6 + Math.sin(u * Math.PI) * (2.6 + (i % 3) * 0.35);
        pose.position.x += Math.sin(u * Math.PI) * ((i % 3) - 1) * 0.65;
        pose.rotation.set(u * 10, i, 0.5);
        pose.scale.setScalar(u > 0 && u < 1 ? (big ? 1.2 : 1) : 0);
      });
      const hit = THREE.MathUtils.clamp((t - 0.45) / 0.45, 0, 1);
      sparkle.material.opacity = Math.sin(hit * Math.PI) * 0.95;
      sparkle.scale.setScalar((big ? 2.8 : 1.9) * (0.65 + hit * 0.7));
      coinFlash.material.opacity = Math.sin(hit * Math.PI);
      coinFlash.position.y = owner.position.y + 2.3 + hit * 1.4;

      labels.forEach((label, i) => {
        point.copy(i ? owner.position : payer.position);
        point.y += i ? 3.8 : 2.3;
        point.project(this.view.camera);
        label.hidden = Math.abs(point.z) > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1;
        const x = (1 + point.x) * innerWidth / 2 + (i ? 68 : -68);
        label.style.left = Math.max(82, Math.min(innerWidth - 82, x)) + 'px';
        label.style.top = Math.max(8, Math.min(innerHeight - 66, (1 - point.y) * innerHeight / 2)) + 'px';
      });
    }, () => labels.forEach(label => label.remove()));
  }

  blast(origin, tileId, large = false) {
    const target = this.board.tilePositions[tileId];
    const launch = origin?.clone();
    if (!target || quietMotion()) return;
    const group = new THREE.Group();
    const rocket = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.82, 4, 10), gloss('#f15a42', 0.2, 0.3));
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.22, 10), gloss('#ffe158', 0.2, 0.3));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.54, 10), gloss('#ffcf3d', 0.25, 0.25));
    nose.position.y = 0.72;
    const flame = createVFXSprite('explosion', { scale: 1.2, additive: true });
    flame.position.y = -0.68;
    rocket.add(body, stripe, nose, flame);
    group.add(rocket);

    // Comic sprite explosion layers
    const burstSprite = createVFXSprite('explosion', { scale: 0.1, additive: true, opacity: 0 });
    burstSprite.position.copy(target).add(new THREE.Vector3(0, 1.4, 0));
    const shockSprite = createVFXSprite('shockwave', { scale: 0.1, additive: true, opacity: 0 });
    shockSprite.position.copy(target).add(new THREE.Vector3(0, 0.7, 0));
    group.add(burstSprite, shockSprite);

    const puffs = Array.from({ length: large ? 8 : 5 }, (_, i) => {
      const s = createVFXSprite('smoke', { scale: 1.2, opacity: 0 });
      s.userData = { angle: (i / (large ? 8 : 5)) * tau, speed: 1.4 + (i % 3) * 0.5 };
      s.position.copy(target);
      group.add(s);
      return s;
    });

    const waves = [ring(1.6, '#ffe174'), ring(1.15, '#ff5f43')];
    waves.forEach(mesh => { mesh.position.copy(target); mesh.position.y += 0.16; group.add(mesh); });
    const chips = particles(group, new THREE.BoxGeometry(0.18, 0.24, 0.18), gloss('#c8824b'), 14);

    let impact = false;
    const path = (point, u) => {
      point.lerpVectors(launch || target, target, u);
      point.y += 0.65 + Math.sin(Math.PI * u) * (large ? 7.2 : 5.4);
    };

    this.run('cartoon-blast', group, origin ? 1480 : 920, t => {
      const u = Math.min(1, t / 0.45);
      const burst = origin ? Math.max(0, (t - 0.45) / 0.55) : t;
      rocket.visible = Boolean(origin) && u < 1;
      path(rocket.position, u);
      if (rocket.visible) {
        const tangent = new THREE.Vector3().subVectors(target, launch);
        tangent.y += Math.PI * (large ? 7.2 : 5.4) * Math.cos(Math.PI * u);
        rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.normalize());
        flame.scale.setScalar(0.95 + Math.sin(t * 90) * 0.28);
      }
      if (burst > 0 && !impact) {
        this.view.shakeCamera?.(large ? 0.52 : 0.28, large ? 320 : 220);
        flashScreen(large ? 'rgba(255, 240, 160, 0.52)' : 'rgba(255, 196, 120, 0.34)', 240);
        impact = true;
      }
      waves.forEach((mesh, i) => {
        mesh.visible = burst > 0;
        mesh.scale.setScalar((large ? 3.8 : 2.5) * burst * (1 + i * 0.28));
        mesh.material.opacity = Math.max(0, 1 - burst);
      });
      if (burst > 0) {
        const pop = Math.sin(Math.min(1, burst * 1.45) * Math.PI);
        burstSprite.material.opacity = pop;
        burstSprite.scale.setScalar((large ? 7.2 : 4.6) * (0.4 + burst * 0.9));
        shockSprite.material.opacity = Math.max(0, 1 - burst * 1.3);
        shockSprite.scale.setScalar((large ? 8.0 : 5.2) * burst);
        puffs.forEach((puff, i) => {
          const a = puff.userData.angle;
          const dist = burst * (large ? 4.2 : 2.6) * (0.65 + (i % 2) * 0.35);
          puff.position.set(
            target.x + Math.cos(a) * dist,
            target.y + 0.6 + burst * (large ? 4.6 : 3.0) + (i % 3) * 0.4,
            target.z + Math.sin(a) * dist
          );
          puff.scale.setScalar((large ? 3.2 : 2.2) * (0.5 + Math.sin(burst * Math.PI) * 0.75));
          puff.material.opacity = Math.sin(burst * Math.PI) * 0.92;
        });
      }
      chips((pose, i) => {
        const a = i * 2.4;
        pose.position.copy(target);
        pose.position.x += burst * (large ? 4.4 : 3.1) * Math.cos(a);
        pose.position.z += burst * (large ? 4.4 : 3.1) * Math.sin(a);
        pose.position.y += 0.2 + Math.sin(Math.PI * burst) * (1.4 + (i % 3) * 0.9);
        pose.rotation.set(burst * 7, a, burst * 5);
        pose.scale.setScalar(burst > 0 ? 1 - burst : 0);
      });
    });
  }

  property(id, chainOnly) {
    const positions = this.board.tilePositions;
    if (!positions[id]) return;
    const group = new THREE.Group();
    const chain = [...this.state.propertyManager.streetChain(id)];
    const waves = chain.length > 1 ? chain.map(tile => {
      const wave = ring(1.85, '#ffd046');
      wave.position.copy(positions[tile]);
      wave.position.y += 0.16;
      group.add(wave);
      return wave;
    }) : [];
    const anchor = this.board.buildingMeshes.get(id)?.position || positions[id];
    const stars = !chainOnly && particles(group, new THREE.OctahedronGeometry(0.16), paint('#ffcd37'), 14);
    const confetti = !chainOnly ? createVFXSprite('confetti', { scale: 0.4, opacity: 0 }) : null;
    const aura = !chainOnly ? createVFXSprite('aura', { scale: 0.6, additive: true, opacity: 0 }) : null;
    if (confetti) {
      confetti.position.copy(anchor).add(new THREE.Vector3(0, 1.8, 0));
      group.add(confetti);
    }
    if (aura) {
      aura.position.copy(anchor).add(new THREE.Vector3(0, 1.2, 0));
      group.add(aura);
    }
    this.run('property-celebration', group, 1200, t => {
      if (stars) stars((pose, i) => {
        pose.position.copy(anchor);
        pose.position.x += t * 3.1 * Math.cos(i * 2.4);
        pose.position.z += t * 3.1 * Math.sin(i * 2.4);
        pose.position.y += 1.1 + Math.sin(t * Math.PI) * (1.3 + (i % 3));
        pose.scale.set(1 - t, 2 * (1 - t), 1 - t);
        pose.rotation.z = t * 5;
      });
      if (confetti) {
        confetti.position.y = anchor.y + 1.6 + Math.sin(t * Math.PI) * 2.2;
        confetti.scale.setScalar(2.4 + t * 2.4);
        confetti.material.opacity = Math.sin(t * Math.PI);
      }
      if (aura) {
        aura.scale.setScalar(1.8 + t * 3.2);
        aura.material.opacity = Math.sin(t * Math.PI) * 0.9;
      }
      waves.forEach((wave, i) => {
        const u = t * 2 - i / waves.length;
        wave.visible = u > 0 && u < 1;
        wave.scale.setScalar(0.65 + u * 0.95);
        wave.material.opacity = Math.max(0, 1 - u);
      });
    });
  }

  spiritBurst(position, good = true) {
    if (!position || quietMotion()) return;
    const group = new THREE.Group();
    const main = createVFXSprite(good ? 'angel_wings' : 'storm_cloud', { scale: 1.4, opacity: 0 });
    const glow = createVFXSprite(good ? 'aura' : 'shockwave', { scale: 1.6, additive: true, opacity: 0, color: good ? 0xffe27a : 0xb388ff });
    main.position.copy(position).add(new THREE.Vector3(0, 2.2, 0));
    glow.position.copy(position).add(new THREE.Vector3(0, 1.5, 0));
    group.add(main, glow);
    this.run('spirit-arrival', group, 1150, t => {
      const pulse = Math.sin(t * Math.PI);
      main.position.y = position.y + 2.1 + t * 1.3;
      main.scale.setScalar(1.8 + pulse * 1.5);
      main.material.opacity = pulse;
      glow.scale.setScalar(1.5 + t * 3.2);
      glow.material.opacity = pulse * 0.85;
    });
  }

  roadCue(pawn, turn, tileId) {
    const group = new THREE.Group();
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.72, 3), gloss(turn ? '#4ac7cf' : '#ef6b3b'));
    const halo = ring(0.75, turn ? '#ffda66' : '#ef9653');
    const spark = createVFXSprite(turn ? 'star' : 'smoke', { scale: 1.4, opacity: 0.9 });
    spark.position.y = 0.5;
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(0, 0, 0.65);
    group.add(arrow, halo, spark);
    const figure = turn ? null : pawn;
    const initial = figure?.rotation.z || 0;
    this.run(turn ? 'direction-arrow' : 'barrier-brake', group, 720, t => {
      group.position.copy(turn ? pawn.position : this.board.tilePositions[tileId] || pawn.position);
      group.position.y += turn ? 2.65 : 0.35;
      group.rotation.y = turn ? t * tau * 1.5 : 0;
      halo.scale.setScalar(1 + 0.5 * Math.sin(Math.PI * t));
      spark.scale.setScalar(1.1 + t * 1.4);
      spark.material.opacity = 1 - t;
      if (!turn && figure) figure.rotation.z = initial + 0.28 * Math.sin(t * tau * 1.5) * (1 - t);
    }, () => { if (figure) figure.rotation.z = initial; });
  }
}
