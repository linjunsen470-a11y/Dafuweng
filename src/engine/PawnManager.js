import { harborPawnSlot } from './HarborPawnLayout.js';
import * as THREE from 'three';
import { PLAYER_PROFILES } from '../game/BoardData.js';

export class PawnManager {
  constructor(scene3D, boardBuilder) {
    this.scene3D = scene3D;
    this.boardBuilder = boardBuilder;
    this.pawns = [];
    this.godAuraMeshes = new Map();
    this.boardGodMeshes = new Map();
  }

  createPlayerPawns(playerConfigs) {
    this.clearPawns();
    playerConfigs.forEach((cfg, index) => {
      const profile = PLAYER_PROFILES.find(item => item.id === cfg.profileIndex)
        || PLAYER_PROFILES[index % PLAYER_PROFILES.length];
      const group = new THREE.Group();

      // 创建精致 Q 版 3D 角色模型
      const harbor = this.boardBuilder.activeMapDefinition?.id === 'grand-bay';
      const characterMesh = this.createDetailedCharacter(profile.id, profile);
      if (harbor) characterMesh.scale.setScalar(1.15);
      group.userData.originalHarborPawn = harbor;
      group.add(characterMesh);

      let standee = null;
      if (!harbor && (profile.avatarAtlas || profile.avatarImg)) {
        standee = this.createCharacterStandee(profile, () => {
          characterMesh.visible = false;
        });
        group.add(standee);
      }

      // 角色脚下炫彩 3D 光圈底座
      const ringGeo = new THREE.RingGeometry(harbor ? .48 : .8, harbor ? .66 : 1, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: profile.colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.08;
      group.add(ring);

      // 头顶 3D 悬浮名字标牌
      const namePlate = this.createNamePlate(harbor ? String(index + 1) : cfg.name || profile.name, profile.color, harbor);
      namePlate.position.y = 2.72;
      group.add(namePlate);

      const startPos = this.boardBuilder.tilePositions[0];
      const offset = this.getPawnOffset(index);
      group.position.copy(startPos).add(offset);

      this.scene3D.scene.add(group);

      this.pawns.push({
        id: index,
        mesh: group,
        characterMesh: characterMesh,
        standee,
        namePlate,
        ring,
        currentTile: 0,
        targetPos: group.position.clone()
      });
    });

    // Register once: restores replace pawns, not the animation callback.
    if (this.pawnAnimationRegistered) return;
    this.pawnAnimationRegistered = true;
    // 悬浮 Idle 呼吸动画
    this.scene3D.addUpdatable({
      update: () => {
        this.layoutHarborPawns();
        const time = performance.now() * 0.003;
        this.pawns.forEach((pawn, idx) => {
          if (pawn.characterMesh) {
            pawn.characterMesh.position.y = Math.sin(time + idx * 1.5) * 0.08;
            pawn.characterMesh.rotation.y = (pawn.mesh.userData.originalHarborPawn ? this.harborFacing || 0 : 0) + Math.sin(time * 0.35 + idx) * 0.08;
            if (pawn.standee) {
              pawn.standee.position.y = 1.35 + Math.sin(time + idx * 1.5) * 0.045;
              pawn.standee.material.rotation = Math.sin(time * 0.55 + idx) * 0.025;
            }
            const pulse = 0.78 + Math.sin(time * 1.6 + idx) * 0.18;
            pawn.ring.material.opacity = pulse;
            pawn.ring.rotation.z += 0.006;
          }
        });
        this.boardBuilder.updateHarborPawnVisibility?.(this.pawns);
      }
    });
  }

  clearPawns() {
    this.pawns.forEach(pawn => this.scene3D.scene.remove(pawn.mesh));
    this.boardGodMeshes.forEach(mesh => this.scene3D.scene.remove(mesh));
    this.pawns = [];
    this.godAuraMeshes.clear();
    this.boardGodMeshes.clear();
  }

  createCharacterStandee(profile, onReady) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.y = 1.35;
    sprite.scale.set(1.78, 2.22, 1);

    const drawFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = profile.color;
      ctx.beginPath();
      ctx.roundRect(8, 8, 304, 384, 42);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 10;
      ctx.stroke();
      texture.needsUpdate = true;
    };
    drawFrame();

    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(8, 8, 304, 384, 42);
      ctx.clip();
      if (profile.avatarAtlas) {
        const [xPercent = 0, yPercent = 0] = String(profile.avatarPosition || '0% 0%')
          .split(/\s+/)
          .map(value => Number.parseFloat(value));
        const column = Math.max(0, Math.min(3, Math.round(xPercent / (100 / 3))));
        const row = Math.max(0, Math.min(2, Math.round(yPercent / 50)));
        const sourceWidth = image.naturalWidth / 4;
        const sourceHeight = image.naturalHeight / 3;
        ctx.drawImage(
          image,
          column * sourceWidth,
          row * sourceHeight,
          sourceWidth,
          sourceHeight,
          8,
          8,
          304,
          384
        );
      } else {
        ctx.drawImage(image, 8, 8, 304, 384);
      }
      const gradient = ctx.createLinearGradient(0, 250, 0, 392);
      gradient.addColorStop(0, 'rgba(8,12,30,0)');
      gradient.addColorStop(1, 'rgba(8,12,30,0.34)');
      ctx.fillStyle = gradient;
      ctx.fillRect(8, 8, 304, 384);
      ctx.restore();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.roundRect(8, 8, 304, 384, 42);
      ctx.stroke();
      texture.needsUpdate = true;
      onReady?.();
    };
    image.src = profile.avatarAtlas || profile.avatarImg || '';
    return sprite;
  }

  createDetailedCharacter(index, profile) {
    const charGroup = new THREE.Group();
    const profId = profile.id !== undefined ? profile.id : index;

    if (profId === 0) {
      // 🎀 1. 林小满
      const dressMat = new THREE.MeshStandardMaterial({ color: '#ff4757', roughness: 0.3 });
      const faceMat = new THREE.MeshStandardMaterial({ color: '#ffeaa7', roughness: 0.5 });
      const hairMat = new THREE.MeshStandardMaterial({ color: '#2d3436', roughness: 0.4 });
      const ribbonMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 });

      const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 20), dressMat);
      body.position.y = 0.55;
      body.castShadow = true;
      charGroup.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), faceMat);
      head.position.y = 1.25;
      charGroup.add(head);

      // 双马尾
      [-0.45, 0.45].forEach(x => {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), hairMat);
        bun.position.set(x, 1.4, -0.1);
        charGroup.add(bun);
      });

      // 蝴蝶结
      const bow = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.1), ribbonMat);
      bow.position.set(0, 1.55, 0.25);
      charGroup.add(bow);
    } else if (profId === 1) {
      // 🤠 2. 顾田野
      const shirtMat = new THREE.MeshStandardMaterial({ color: '#ffa502', roughness: 0.5 });
      const hatMat = new THREE.MeshStandardMaterial({ color: '#f5cd79', roughness: 0.7 });
      const faceMat = new THREE.MeshStandardMaterial({ color: '#ffeaa7', roughness: 0.5 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.0, 16), shirtMat);
      body.position.y = 0.5;
      body.castShadow = true;
      charGroup.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), faceMat);
      head.position.y = 1.2;
      charGroup.add(head);

      // 大草帽
      const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 24), hatMat);
      hatBrim.position.y = 1.5;
      charGroup.add(hatBrim);

      const hatTop = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.35, 16), hatMat);
      hatTop.position.y = 1.7;
      charGroup.add(hatTop);
    } else if (profId === 2) {
      // 💎 3. 洛晶晶
      const dressMat = new THREE.MeshStandardMaterial({ color: '#a55eea', roughness: 0.2, metalness: 0.1 });
      const furMat = new THREE.MeshStandardMaterial({ color: '#f1f2f6', roughness: 0.8 });
      const faceMat = new THREE.MeshStandardMaterial({ color: '#ffeaa7', roughness: 0.5 });
      const glassesMat = new THREE.MeshStandardMaterial({ color: '#2f3542', roughness: 0.1 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 1.1, 20), dressMat);
      body.position.y = 0.55;
      body.castShadow = true;
      charGroup.add(body);

      const fur = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.12, 12, 20), furMat);
      fur.rotation.x = Math.PI / 2;
      fur.position.y = 0.95;
      charGroup.add(fur);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), faceMat);
      head.position.y = 1.3;
      charGroup.add(head);

      const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.1), glassesMat);
      glasses.position.set(0, 1.35, 0.38);
      charGroup.add(glasses);
    } else if (profId === 3) {
      // 👳‍♂️ 4. 巴洛克
      const robeMat = new THREE.MeshStandardMaterial({ color: '#2ed573', roughness: 0.4 });
      const scarfMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
      const bandMat = new THREE.MeshStandardMaterial({ color: '#ff4757', roughness: 0.2 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.1, 20), robeMat);
      body.position.y = 0.55;
      body.castShadow = true;
      charGroup.add(body);

      const scarf = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), scarfMat);
      scarf.position.y = 1.3;
      charGroup.add(scarf);

      const band = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 16), bandMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 1.55;
      charGroup.add(band);
    } else if (profId === 4) {
      // 🥷 5. 风间岚
      const suitMat = new THREE.MeshStandardMaterial({ color: '#1e90ff', roughness: 0.3 });
      const maskMat = new THREE.MeshStandardMaterial({ color: '#2f3542', roughness: 0.4 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.0, 0.5), suitMat);
      body.position.y = 0.5;
      body.castShadow = true;
      charGroup.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), suitMat);
      head.position.y = 1.25;
      charGroup.add(head);

      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.2), maskMat);
      mask.position.set(0, 1.2, 0.3);
      charGroup.add(mask);
    } else if (profId === 5) {
      // 🌴 6. 米娅
      const outfitMat = new THREE.MeshStandardMaterial({ color: '#ff7f50', roughness: 0.5 });
      const faceMat = new THREE.MeshStandardMaterial({ color: '#fab1a0', roughness: 0.5 });
      const featherMat = new THREE.MeshStandardMaterial({ color: '#00cec9', roughness: 0.3 });

      const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 16), outfitMat);
      body.position.y = 0.5;
      body.castShadow = true;
      charGroup.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 20), faceMat);
      head.position.y = 1.2;
      charGroup.add(head);

      // 头顶羽毛
      [-0.15, 0, 0.15].forEach((x, i) => {
        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 8), featherMat);
        feather.position.set(x, 1.7, 0);
        feather.rotation.z = (i - 1) * 0.3;
        charGroup.add(feather);
      });
    } else {
      const palettes = {
        6: ['#8b5a2b', '#f6b93b'],
        7: ['#0984e3', '#ffffff'],
        8: ['#e84393', '#ffd700'],
        9: ['#ff7675', '#74b9ff'],
        10: ['#2d3436', '#d63031'],
        11: ['#6c5ce7', '#ffeaa7']
      };
      const [mainColor, accentColor] = palettes[profId] || ['#00b894', '#ffffff'];
      const bodyMat = new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.38 });
      const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.25, metalness: profId === 8 ? 0.45 : 0.05 });
      const faceMat = new THREE.MeshStandardMaterial({ color: '#ffd7b5', roughness: 0.55 });

      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 6, 14), bodyMat);
      body.position.y = 0.65;
      body.castShadow = true;
      charGroup.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), faceMat);
      head.position.y = 1.35;
      head.castShadow = true;
      charGroup.add(head);

      if (profId === 6) {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.07, 24), accentMat);
        brim.position.y = 1.68;
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.36, 18), accentMat);
        crown.position.y = 1.84;
        charGroup.add(brim, crown);
      } else if (profId === 7) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
        cap.position.y = 1.6;
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.25), accentMat);
        visor.position.set(0, 1.56, 0.38);
        charGroup.add(cap, visor);
      } else if (profId === 8) {
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.28, 5), accentMat);
        crown.position.y = 1.78;
        crown.rotation.y = Math.PI / 5;
        const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.8, 20), bodyMat);
        skirt.position.y = 0.42;
        charGroup.add(crown, skirt);
      } else if (profId === 9) {
        [-0.43, 0.43].forEach((x, side) => {
          const candy = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), side ? accentMat : bodyMat);
          candy.position.set(x, 1.48, 0);
          charGroup.add(candy);
        });
      } else if (profId === 10) {
        const helmet = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.42, 6), accentMat);
        helmet.position.y = 1.72;
        const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.08), accentMat);
        sword.position.set(0.55, 0.78, 0);
        sword.rotation.z = -0.28;
        charGroup.add(helmet, sword);
      } else if (profId === 11) {
        const curl = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.06, 8, 18, Math.PI * 1.5), accentMat);
        curl.position.set(0, 1.72, 0.1);
        curl.rotation.x = Math.PI / 2;
        const bib = new THREE.Mesh(new THREE.CircleGeometry(0.24, 18), accentMat);
        bib.position.set(0, 0.75, 0.43);
        charGroup.add(curl, bib);
      }
    }

    const eyeMat = new THREE.MeshBasicMaterial({ color: '#202630' });
    [-0.14, 0.14].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
      eye.position.set(x, 1.34, 0.39);
      charGroup.add(eye);
    });

    return charGroup;
  }

  createNamePlate(nameText, colorHex, compact = false) {
    const canvas = document.createElement('canvas');
    canvas.width = compact ? 96 : 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(16, 20, 40, 0.85)';
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 6;

    // 圆角矩形
    ctx.beginPath();
    ctx.roundRect(6, 6, canvas.width - 12, 52, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = compact ? 'bold 44px sans-serif' : 'bold 28px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nameText, canvas.width / 2, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(compact ? .75 : 2.2, 0.55, 1);
    return sprite;
  }

  layoutHarborPawns() {
    if (this.boardBuilder.activeMapDefinition?.id !== 'grand-bay') return;
    const right = new THREE.Vector3().setFromMatrixColumn(this.scene3D.camera.matrixWorld,0);
    right.y = 0; right.normalize();
    this.harborFacing = Math.atan2(-right.z,right.x);
    const reduced = document.documentElement.classList.contains('reduce-motion')
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const groups = new Map();
    for (const pawn of this.pawns) {
      if (pawn.mesh.userData.isMoving) continue;
      if (!groups.has(pawn.currentTile)) groups.set(pawn.currentTile,[]);
      groups.get(pawn.currentTile).push(pawn);
    }
    for (const [tileId,occupants] of groups) {
      const center = this.boardBuilder.tilePositions[tileId]; if (!center) continue;
      occupants.sort((a,b)=>a.id-b.id).forEach((pawn,rank)=>{
        const slot = occupants.length > 1 ? harborPawnSlot(rank,occupants.length,right) : {...this.getPawnOffset(pawn.id),scale:1.15};
        const destination = center.clone().add(new THREE.Vector3(slot.x,.20,slot.z));
        pawn.mesh.position.lerp(destination,reduced ? 1 : .22);
        pawn.characterMesh.scale.lerp(new THREE.Vector3(slot.scale,slot.scale,slot.scale),reduced ? 1 : .22);
        pawn.namePlate.position.y = 2.72 * slot.scale / 1.15;
        pawn.ring.scale.setScalar(occupants.length > 1 ? .72 : 1);
        pawn.mesh.userData.crowdCount = occupants.length;
      });
    }
  }

  getPawnOffset(playerIndex) {
    const angle = (playerIndex / 4) * Math.PI * 2;
    const dist = 0.95;
    return new THREE.Vector3(Math.cos(angle) * dist, this.boardBuilder.activeMapDefinition?.id === 'grand-bay' ? .20 : 0, Math.sin(angle) * dist);
  }

  // 沿路径跳跃移动动画（支持正向与反向，并实时同步回到 GameState）
  async movePawnAlongPath(playerIndex, steps, direction, gameState, onStepCallback, mapRuntime = null, onRouteChoice = null) {
    const pawn = this.pawns[playerIndex];
    if (!pawn) return;

    let current = pawn.currentTile;

    for (let i = 0; i < steps; i++) {
      if (mapRuntime) {
        const options = mapRuntime.getNextOptions(current, direction);
        if (!options.length) break;
        current = options.length > 1 && onRouteChoice
          ? await onRouteChoice(options, current, steps - i)
          : options[0];
        if (!options.includes(current)) current = options[0];
      } else {
        const boardSize = this.boardBuilder.tilePositions.length;
        current = (current + direction + boardSize) % boardSize;
      }
      pawn.currentTile = current;
      gameState.players[playerIndex].currentTile = current;

      const targetPos = this.boardBuilder.tilePositions[current].clone().add(this.getPawnOffset(playerIndex));

      // 单步跳跃音效与动画
      await this.animateHop(pawn.mesh, targetPos);

      if (onStepCallback) {
        const stopImmediate = onStepCallback(current);
        if (stopImmediate) break; // 如果踩中路障等强制打断
      }
    }
  }

  animateHop(mesh, targetPos) {
    mesh.userData.isMoving = true;
    return new Promise((resolve) => {
      const startPos = mesh.position.clone();
      const duration = this.animateHopDuration || 220; // ms
      const startTime = performance.now();
      let completed = false;
      const finish = () => {
        if (completed) return;
        completed = true;
        mesh.userData.isMoving = false;
        mesh.position.copy(targetPos);
        mesh.rotation.z = 0;
        mesh.scale.set(1, 1, 1);
        resolve();
      };
      const watchdog = setTimeout(finish, duration + 1200);

      const update = () => {
        if (completed) return;
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1.0);

        mesh.position.x = THREE.MathUtils.lerp(startPos.x, targetPos.x, progress);
        mesh.position.z = THREE.MathUtils.lerp(startPos.z, targetPos.z, progress);

        const jumpHeight = 1.3;
        mesh.position.y = startPos.y + Math.sin(progress * Math.PI) * jumpHeight;
        mesh.rotation.z = Math.sin(progress * Math.PI * 2) * 0.08;
        const squash = Math.sin(progress * Math.PI);
        mesh.scale.set(1 + squash * 0.06, 1 - squash * 0.05, 1 + squash * 0.06);

        if (progress < 1.0) {
          requestAnimationFrame(update);
        } else {
          clearTimeout(watchdog);
          finish();
        }
      };

      update();
    });
  }

  async animatePlayerStep(playerIndex, tileId, duration = 220) {
    const pawn = this.pawns[playerIndex];
    const tilePosition = this.boardBuilder.tilePositions[tileId];
    if (!pawn || !tilePosition) return;
    pawn.currentTile = tileId;
    const target = tilePosition.clone().add(this.getPawnOffset(playerIndex));
    const reducedMotion = document.documentElement.classList.contains('reduce-motion')
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const color = pawn.ring?.material?.color?.getHex?.() ?? 0xffd166;
    if (!reducedMotion) this.scene3D.createMovementTrail?.(pawn.mesh.position.clone(), target, color);
    const original = this.animateHopDuration;
    this.animateHopDuration = duration;
    await this.animateHop(pawn.mesh, target);
    this.animateHopDuration = original;
    if (!reducedMotion) this.scene3D.createSparkles?.(target, color, 5);
  }

  getPawnMesh(playerIndex) {
    return this.pawns[playerIndex]?.mesh || null;
  }

  celebrateLanding(playerIndex, intensity = 1) {
    const pawn = this.pawns[playerIndex];
    if (!pawn) return;
    const reducedMotion = document.documentElement.classList.contains('reduce-motion')
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;
    const color = pawn.ring?.material?.color?.getHex?.() ?? 0xffd166;
    this.scene3D.createLandingPulse?.(pawn.mesh.position, color, intensity);
  }

  syncFromGameState(gameState) {
    this.pawns.forEach((pawn) => {
      const player = gameState.players[pawn.id];
      if (!player) return;
      pawn.currentTile = player.currentTile;
      const tilePosition = this.boardBuilder.tilePositions[player.currentTile];
      pawn.mesh.position.copy(tilePosition).add(this.getPawnOffset(player.id));
      this.updateGodAura(player.id, player.godType);
      if (player.isBankrupt) this.setBankrupt(player.id);
    });
    this.syncBoardGods(gameState.boardGods || []);
  }

  syncBoardGods(boardGods) {
    const activeIds = new Set(boardGods.map(god => god.id));
    this.boardGodMeshes.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        this.scene3D.scene.remove(mesh);
        this.boardGodMeshes.delete(id);
      }
    });
    const colors = {
      FORTUNE: 0xffd166, GREAT_FORTUNE: 0xff9f1c, LUCK: 0x22d3ee, EARTH: 0x2ed573,
      MISFORTUNE: 0x2d3436, BAD: 0xd63031, ANGEL: 0xffffff, DEMON: 0x8e44ad
    };
    boardGods.forEach((god, index) => {
      let group = this.boardGodMeshes.get(god.id);
      if (!group) {
        group = new THREE.Group();
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 18, 14),
          new THREE.MeshStandardMaterial({ color: colors[god.type] || 0x74b9ff, emissive: colors[god.type] || 0x74b9ff, emissiveIntensity: 0.42 })
        );
        orb.position.y = 1.25;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.72, 0.07, 12, 28),
          new THREE.MeshBasicMaterial({ color: colors[god.type] || 0x74b9ff })
        );
        ring.position.y = 1.25;
        ring.rotation.x = Math.PI / 2;
        group.add(orb, ring);
        group.userData.phase = index * 1.7;
        this.scene3D.scene.add(group);
        this.boardGodMeshes.set(god.id, group);
      }
      const tilePosition = this.boardBuilder.tilePositions[god.tileId];
      if (tilePosition) group.position.copy(tilePosition).add(new THREE.Vector3(0, 0.2, 0));
    });
  }

  updateGodAura(playerIndex, godType) {
    const pawn = this.pawns[playerIndex];
    if (!pawn) return;

    if (this.godAuraMeshes.has(playerIndex)) {
      const oldMesh = this.godAuraMeshes.get(playerIndex);
      pawn.mesh.remove(oldMesh);
      this.godAuraMeshes.delete(playerIndex);
    }

    if (!godType) return;

    let auraColor = 0xffd700; // 金光 (财神 / 大财神)
    if (godType === 'LUCK' || godType === 'FORTUNE' || godType === 'GREAT_FORTUNE' || godType === 'SMALL_FORTUNE') auraColor = 0xffd700;
    else if (godType === 'ANGEL') auraColor = 0xffffff; // 圣白光 (天使)
    else if (godType === 'DEMON') auraColor = 0x8e44ad; // 紫黑 (恶魔)
    else if (godType === 'MISFORTUNE' || godType === 'GREAT_POOR' || godType === 'SMALL_POOR') auraColor = 0x2d3436; // 幽黑 (穷神)
    else if (godType === 'BAD') auraColor = 0xd63031; // 警红 (衰神)
    else if (godType === 'EARTH') auraColor = 0x00b894; // 碧绿 (土地公)

    const geo = new THREE.TorusGeometry(0.85, 0.09, 16, 32);
    const mat = new THREE.MeshBasicMaterial({ color: auraColor });
    const aura = new THREE.Mesh(geo, mat);
    aura.rotation.x = Math.PI / 2;
    aura.position.y = 2.2;

    pawn.mesh.add(aura);
    this.godAuraMeshes.set(playerIndex, aura);
  }

  setBankrupt(playerIndex) {
    const pawn = this.pawns[playerIndex];
    if (pawn) {
      pawn.mesh.traverse((child) => {
        if (child.isMesh) {
          child.material.transparent = true;
          child.material.opacity = 0.3;
        }
      });
    }
  }
}
