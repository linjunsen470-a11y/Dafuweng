import { isOldTownView, oldTownOffset } from './OldTownStreet.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Scene3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = new THREE.Scene();
    
    // 渐变天空与雾气（Q版温和色彩）
    this.scene.background = new THREE.Color('#87CEEB');
    this.scene.fog = new THREE.FogExp2('#87CEEB', 0.008);

    // 相机设置
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 32, 38);

    // WebGL 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);

    // 视角轨道控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.1; // 防止掉入地板下方
    this.controls.minDistance = 15;
    this.controls.maxDistance = 75;
    this.controls.target.set(0, 0, 0);
    this.mapCamera = {
      center: new THREE.Vector3(0, 0, 0),
      overviewDistance: 62,
      followHeight: 14,
      followDistance: 18
    };

    // 灯光搭建
    this.setupLighting();

    // 粒子与云朵系统
    this.particles = [];
    this.cinematicEffects = [];
    this.followedObject = null;
    this.followOffset = new THREE.Vector3(0, 12, 15);
    this.cameraShake = null;
    this.setupClouds();
    this.setupWeather();

    // 事件监听
    window.addEventListener('resize', () => this.onWindowResize());

    // 帧回调队列
    this.updatables = [];

    // 目标相机跟瞄位置
    this.targetCameraPos = null;
    this.targetLookAt = null;

    // 启动动画循环
    this.animate();
  }

  setupLighting() {
    // 太阳光（主平行光，带软阴影）
    const sunLight = new THREE.DirectionalLight('#fff8e7', 1.8);
    sunLight.position.set(25, 45, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    const d = 35;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);
    this.sunLight = sunLight;

    // 温暖的环境光
    const ambientLight = new THREE.AmbientLight('#b9e3ff', 0.85);
    this.scene.add(ambientLight);
    this.ambientLight = ambientLight;
    // updateWeather runs before the player ever changes the time of day.
    this.baseAmbientIntensity = ambientLight.intensity;

    // 补光（蓝浅光增加立体感）
    const fillLight = new THREE.DirectionalLight('#70a1ff', 0.5);
    fillLight.position.set(-20, 20, -20);
    this.scene.add(fillLight);
    this.fillLight = fillLight;
  }

  setupClouds() {
    // Q版 Procedural 浮云
    const cloudGeo = new THREE.DodecahedronGeometry(2, 1);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85
    });

    const cloudGroup = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const cloud = new THREE.Group();
      const numPuffs = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < numPuffs; j++) {
        const puff = new THREE.Mesh(cloudGeo, cloudMat);
        puff.position.set(j * 1.5, Math.random() * 0.8, Math.random() * 1.2);
        const scale = 0.8 + Math.random() * 0.8;
        puff.scale.set(scale, scale * 0.6, scale);
        cloud.add(puff);
      }
      const angle = (i / 12) * Math.PI * 2;
      const radius = 35 + Math.random() * 15;
      cloud.position.set(Math.cos(angle) * radius, 18 + Math.random() * 8, Math.sin(angle) * radius);
      cloudGroup.add(cloud);
    }
    this.scene.add(cloudGroup);
    this.clouds = cloudGroup;
  }

  setupWeather() {
    this.weather = 'CLEAR';
    this.timeOfDay = 'DAY';
    this.weatherElapsed = 0;
    this.precipitation = null;
    this.lightningFlash = 0;
  }

  createPrecipitation(kind) {
    if (this.precipitation) {
      this.scene.remove(this.precipitation);
      this.precipitation.geometry.dispose();
      this.precipitation.material.dispose();
      this.precipitation = null;
    }
    if (kind === 'CLEAR') return;

    const count = kind === 'SNOW' ? 650 : 950;
    const positions = new Float32Array(count * 3);
    const drift = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = Math.random() * 35 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 70;
      drift[i] = Math.random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: kind === 'SNOW' ? 0xffffff : 0x9ad8ff,
      size: kind === 'SNOW' ? 0.22 : 0.11,
      transparent: true,
      opacity: kind === 'SNOW' ? 0.9 : 0.7,
      depthWrite: false,
      blending: kind === 'SNOW' ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.precipitation = new THREE.Points(geometry, material);
    this.precipitation.userData = { kind, drift };
    this.scene.add(this.precipitation);
  }

  setWeather(weather) {
    const supported = ['CLEAR', 'RAIN', 'SNOW', 'STORM'];
    this.weather = supported.includes(weather) ? weather : 'CLEAR';
    this.createPrecipitation(this.weather === 'STORM' ? 'RAIN' : this.weather);
    this.applyAtmosphere();
    return this.weather;
  }

  cycleWeather() {
    const modes = ['CLEAR', 'RAIN', 'SNOW', 'STORM'];
    return this.setWeather(modes[(modes.indexOf(this.weather) + 1) % modes.length]);
  }

  setTimeOfDay(timeOfDay) {
    const supported = ['DAY', 'SUNSET', 'NIGHT'];
    this.timeOfDay = supported.includes(timeOfDay) ? timeOfDay : 'DAY';
    this.applyAtmosphere();
    return this.timeOfDay;
  }

  cycleTimeOfDay() {
    const modes = ['DAY', 'SUNSET', 'NIGHT'];
    return this.setTimeOfDay(modes[(modes.indexOf(this.timeOfDay) + 1) % modes.length]);
  }

  applyAtmosphere() {
    const presets = {
      DAY: { sky: '#87ceeb', fog: '#9cdcf2', sun: '#fff4d6', sunPower: 1.8, ambient: '#b9e3ff', ambientPower: 0.85, exposure: 1.1 },
      SUNSET: { sky: '#f59f80', fog: '#df9b87', sun: '#ffb36b', sunPower: 1.35, ambient: '#8f80b8', ambientPower: 0.7, exposure: 1.0 },
      NIGHT: { sky: '#111a3a', fog: '#172447', sun: '#b7caff', sunPower: 0.72, ambient: '#6686bd', ambientPower: 0.82, exposure: 0.94 }
    };
    const preset = presets[this.timeOfDay];
    const stormy = this.weather === 'RAIN' || this.weather === 'STORM';
    const sky = stormy ? '#43566f' : preset.sky;
    const fog = stormy ? '#52677d' : preset.fog;
    this.scene.background.set(sky);
    this.scene.fog.color.set(fog);
    const fogScale = this.mapFogScale || 1;
    this.scene.fog.density = (this.weather === 'STORM' ? 0.018 : this.weather === 'RAIN' ? 0.013 : 0.008) * fogScale;
    this.sunLight.color.set(preset.sun);
    this.sunLight.intensity = stormy ? preset.sunPower * 0.55 : preset.sunPower;
    this.ambientLight.color.set(preset.ambient);
    this.ambientLight.intensity = preset.ambientPower;
    this.baseAmbientIntensity = preset.ambientPower;
    this.fillLight.intensity = this.timeOfDay === 'NIGHT' ? 0.42 : 0.5;
    this.renderer.toneMappingExposure = preset.exposure;
    if (this.clouds) this.clouds.children.forEach(cloud => {
      cloud.visible = this.weather !== 'CLEAR' || this.timeOfDay !== 'DAY';
      cloud.scale.setScalar(this.weather === 'STORM' ? 1.45 : 1);
    });
  }

  updateWeather() {
    this.weatherElapsed += 0.016;
    if (this.precipitation) {
      const positions = this.precipitation.geometry.attributes.position.array;
      const { kind, drift } = this.precipitation.userData;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] -= kind === 'SNOW' ? 0.045 : 0.42;
        positions[i * 3] += kind === 'SNOW' ? Math.sin(this.weatherElapsed * 1.4 + drift[i]) * 0.012 : 0.035;
        if (positions[i * 3 + 1] < 0.5) positions[i * 3 + 1] = 36;
      }
      this.precipitation.geometry.attributes.position.needsUpdate = true;
    }
    if (this.weather === 'STORM' && Math.random() < 0.0025) this.lightningFlash = 1;
    if (this.lightningFlash > 0) {
      this.lightningFlash *= 0.82;
      this.ambientLight.intensity = this.baseAmbientIntensity + this.lightningFlash * 0.9;
    } else {
      this.ambientLight.intensity = this.baseAmbientIntensity;
    }
  }

  addUpdatable(obj) {
    this.updatables.push(obj);
  }

  resetCamera() {
    this.showOverview();
  }

  configureForMap(mapDefinition) {
    this.activeMapId = mapDefinition?.id;
    const config = mapDefinition?.camera || {};
    const center = config.center || { x: 0, z: 0 };
    this.mapCamera = {
      center: new THREE.Vector3(center.x || 0, 0, center.z || 0),
      overviewDistance: config.overviewDistance || 62,
      followHeight: config.followHeight || 14,
      followDistance: config.followDistance || 18
    };
    this.controls.minDistance = mapDefinition?.theme === 'GRAND_BAY' ? 11 : 15;
    this.controls.maxDistance = Math.max(75, this.mapCamera.overviewDistance * 1.25);
    this.mapFogScale = mapDefinition?.theme === 'GRAND_BAY' ? 0.25 : 1;
    this.scene.fog.density = 0.008 * this.mapFogScale;
    this.camera.far = Math.max(1000, this.mapCamera.overviewDistance * 8);
    this.camera.updateProjectionMatrix();
    this.showOverview();
  }

  showOverview() {
    const center = this.mapCamera?.center || new THREE.Vector3();
    const distance = this.mapCamera?.overviewDistance || 62;
    const position = center.clone().add(new THREE.Vector3(distance * 0.4, distance * 0.82, distance * 0.54));
    this.camera.position.copy(position);
    this.controls.target.copy(center);
    this.targetCameraPos = null;
    this.targetLookAt = null;
    this.controls.update();
  }

  showStreetView(position, smooth = false) {
    if (!position) return;
    this.followedObject = null;
    this.targetCameraPos = null;
    this.targetLookAt = null;
    const oldTown = isOldTownView(this.activeMapId,position);
    const compact = this.container.clientWidth < 680;
    // Keep the neighboring supply-shop sign in view on the narrow mountain frontage.
    const supplyCorner = compact && this.activeMapId === 'grand-bay' && position.z === -16 && position.x >= 26 && position.x <= 30;
    const target = position.clone().add(oldTown ? new THREE.Vector3(-1,0,-3) : new THREE.Vector3(supplyCorner ? -1 : 4,0,3));
    const offset = oldTownOffset(this.activeMapId,position,{x:5,y:compact?28:22,z:compact?32:28});
    const cameraPosition = target.clone().add(new THREE.Vector3(offset.x,offset.y,offset.z));
    if (smooth) {
      this.targetLookAt = target;
      this.targetCameraPos = cameraPosition;
    } else {
      this.controls.target.copy(target);
      this.camera.position.copy(cameraPosition);
      this.controls.update();
    }
  }

  rotateView(direction = 1) {
    const target = (this.targetLookAt || this.controls.target).clone();
    const cameraPosition = (this.targetCameraPos || this.camera.position).clone();
    const offset = cameraPosition.sub(target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 4);
    this.targetCameraPos = target.clone().add(offset);
    this.targetLookAt = target;
  }

  panToMapPoint(x, z) {
    const target = new THREE.Vector3(x, 0, z);
    const currentOffset = this.camera.position.clone().sub(this.controls.target);
    this.targetLookAt = target;
    this.targetCameraPos = target.clone().add(currentOffset);
  }

  focusOnPosition(pos, offset = null) {
    const resolvedOffset = offset || new THREE.Vector3(0, this.mapCamera?.followHeight || 14, this.mapCamera?.followDistance || 18);
    this.targetLookAt = pos.clone();
    const oriented = oldTownOffset(this.activeMapId,pos,resolvedOffset);
    this.targetCameraPos = pos.clone().add(new THREE.Vector3(oriented.x,oriented.y,oriented.z));
  }

  followObject(object, offset = null) {
    this.followedObject = object || null;
    if (offset) this.followOffset.copy(offset);
    else this.followOffset.set(0, this.mapCamera?.followHeight || 14, Math.max(13, (this.mapCamera?.followDistance || 18) * 0.82));
    const oriented = oldTownOffset(this.activeMapId,object?.position,this.followOffset);
    this.followOffset.set(oriented.x,oriented.y,oriented.z);
    this.targetCameraPos = null;
    this.targetLookAt = null;
  }

  stopFollowing({ settle = true } = {}) {
    const position = this.followedObject?.position?.clone();
    this.followedObject = null;
    if (settle && position) this.focusOnPosition(position, new THREE.Vector3(0, 11, 13));
  }

  shakeCamera(intensity = 0.35, duration = 260) {
    this.cameraShake = { intensity: Math.max(0, intensity), duration: Math.max(1, duration), startedAt: performance.now() };
  }

  createMovementTrail(from, to, color = 0xffd166) {
    const direction = to.clone().sub(from);
    const length = direction.length();
    if (!length) return;
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending });
    const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.18, length, 8), material);
    trail.position.copy(from).lerp(to, 0.5);
    trail.position.y += 0.2;
    trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    this.scene.add(trail);
    this.cinematicEffects.push({ kind: 'trail', mesh: trail, life: 1, decay: 0.045 });
  }

  createLandingPulse(position, color = 0xffd166, intensity = 1) {
    const group = new THREE.Group();
    const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.92, 36), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.7, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.015;
    group.add(ring, disc);
    group.position.copy(position);
    group.position.y += 0.18;
    group.scale.setScalar(Math.max(0.55, intensity * 0.7));
    this.scene.add(group);
    this.cinematicEffects.push({ kind: 'pulse', mesh: group, life: 1, decay: 0.032, intensity });
    this.createSparkles(position, color, Math.round(10 + intensity * 8));
  }

  createSparkles(position, color = 0xffaa00, count = 20) {
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions.push(position.x, position.y + 1, position.z);
      velocities.push(
        (Math.random() - 0.5) * 6,
        Math.random() * 8 + 3,
        (Math.random() - 0.5) * 6
      );
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: color,
      size: 0.6,
      transparent: true,
      opacity: 1
    });

    const pSystem = new THREE.Points(geo, mat);
    this.scene.add(pSystem);

    this.particles.push({
      mesh: pSystem,
      velocities: velocities,
      life: 1.0
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // 旋转云朵
    if (this.clouds) {
      this.clouds.rotation.y += 0.0003;
    }
    this.updateWeather();

    // 相机平滑插值过渡
    if (this.targetCameraPos) {
      this.camera.position.lerp(this.targetCameraPos, 0.05);
      if (this.camera.position.distanceTo(this.targetCameraPos) < 0.2) {
        this.targetCameraPos = null;
      }
    }

    if (this.targetLookAt) {
      this.controls.target.lerp(this.targetLookAt, 0.05);
      if (this.controls.target.distanceTo(this.targetLookAt) < 0.2) {
        this.targetLookAt = null;
      }
    }

    if (this.followedObject?.position) {
      const target = this.followedObject.position.clone();
      const desired = target.clone().add(this.followOffset);
      this.controls.target.lerp(target, 0.14);
      this.camera.position.lerp(desired, 0.11);
    }

    // 更新可动画物体
    for (const item of this.updatables) {
      if (item.update) item.update();
    }

    // 更新粒子系统
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= 0.025;
      p.mesh.material.opacity = p.life;
      const positions = p.mesh.geometry.attributes.position.array;
      for (let j = 0; j < p.velocities.length / 3; j++) {
        positions[j * 3] += p.velocities[j * 3] * 0.016;
        positions[j * 3 + 1] += p.velocities[j * 3 + 1] * 0.016;
        positions[j * 3 + 2] += p.velocities[j * 3 + 2] * 0.016;
        p.velocities[j * 3 + 1] -= 9.8 * 0.016; // 重力
      }
      p.mesh.geometry.attributes.position.needsUpdate = true;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.cinematicEffects.length - 1; i >= 0; i--) {
      const effect = this.cinematicEffects[i];
      effect.life -= effect.decay;
      effect.mesh.traverse(child => {
        if (child.material?.transparent) child.material.opacity = Math.max(0, effect.life) * (effect.kind === 'trail' ? 0.62 : 0.9);
      });
      if (effect.kind === 'pulse') {
        const scale = 0.7 + (1 - effect.life) * (2.8 + effect.intensity * 0.65);
        effect.mesh.scale.setScalar(scale);
        effect.mesh.rotation.y += 0.025;
      } else {
        effect.mesh.position.y += 0.012;
        effect.mesh.scale.x *= 0.985;
        effect.mesh.scale.z *= 0.985;
      }
      if (effect.life <= 0) {
        this.scene.remove(effect.mesh);
        effect.mesh.traverse(child => { child.geometry?.dispose?.(); child.material?.dispose?.(); });
        this.cinematicEffects.splice(i, 1);
      }
    }

    this.controls.update();
    let shakeOffset = null;
    if (this.cameraShake) {
      const elapsed = performance.now() - this.cameraShake.startedAt;
      const remaining = Math.max(0, 1 - elapsed / this.cameraShake.duration);
      if (remaining <= 0) this.cameraShake = null;
      else {
        const amount = this.cameraShake.intensity * remaining;
        shakeOffset = new THREE.Vector3((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount * 0.45, (Math.random() - 0.5) * amount);
        this.camera.position.add(shakeOffset);
      }
    }
    this.renderer.render(this.scene, this.camera);
    if (shakeOffset) this.camera.position.sub(shakeOffset);
  }
}
