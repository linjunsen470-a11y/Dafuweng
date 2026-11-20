import { quietMotion } from './EffectTimeline.js';
import { projectedBox, overlapsBoard } from './CloudVisibility.js';
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
    this.controls.addEventListener('start', () => {
      this.followedObject = null;
      this.targetCameraPos = null;
      this.targetLookAt = null;
    });
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.rotateSpeed = .75;
    this.controls.zoomSpeed = .85;
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
    this.setupSky();
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

  setupSky() {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(490,32,16), new THREE.ShaderMaterial({
      side:THREE.BackSide, depthWrite:false,
      uniforms:{zenith:{value:this.scene.background}, horizon:{value:this.scene.fog.color}},
      vertexShader:`varying float altitude;
        void main(){ altitude=position.y/490.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`uniform vec3 zenith; uniform vec3 horizon; varying float altitude;
        void main(){
          gl_FragColor=vec4(mix(horizon*1.12,zenith*.82,smoothstep(-.1,.75,altitude)),1.);
          #include <colorspace_fragment>
        }`
    }));
    sky.renderOrder=-10;
    this.scene.add(sky);
  }

  setupLighting() {
    // 太阳光（主平行光，带软阴影）
    const sunLight = new THREE.DirectionalLight('#fff8e7', 1.8);
    sunLight.position.set(-32, 56, 30);
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
    const ambientLight = new THREE.HemisphereLight('#fff2d1', '#a5c6ac', 0.85);
    this.scene.add(ambientLight);
    this.ambientLight = ambientLight;
    // updateWeather runs before the player ever changes the time of day.
    this.baseAmbientIntensity = ambientLight.intensity;

    // 补光（蓝浅光增加立体感）
    const fillLight = new THREE.DirectionalLight('#b9e8ff', 0.5);
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
      cloud.userData.cloudBounds = new THREE.Box3().setFromObject(cloud);
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
      size: kind === 'SNOW' ? 0.15 : 0.10,
      transparent: true,
      opacity: kind === 'SNOW' ? 0.7 : 0.58,
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
      DAY: { sky: '#87ceeb', fog: '#9cdcf2', sun: '#fff4d6', sunPower: 1.8, ambient: '#fff2d1', ambientPower: 0.85, exposure: 1.1 },
      SUNSET: { sky: '#f59f80', fog: '#df9b87', sun: '#ffb36b', sunPower: 1.35, ambient: '#8f80b8', ambientPower: 0.7, exposure: 1.0 },
      NIGHT: { sky: '#111a3a', fog: '#172447', sun: '#b7caff', sunPower: 1.02, ambient: '#9faecb', ambientPower: 1.05, exposure: 1.07 }
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

  updateCloudVisibility() {
    if (!this.clouds) return;
    const weatherVisible = this.weather !== 'CLEAR' || this.timeOfDay !== 'DAY';
    this.camera.updateMatrixWorld();
    this.clouds.updateMatrixWorld(true);
    const board = weatherVisible && this.cloudBoardBounds ? projectedBox(this.cloudBoardBounds,this.camera) : null;
    for (const cloud of this.clouds.children) {
      const coversBoard = board && overlapsBoard(projectedBox(cloud.userData.cloudBounds,this.camera,cloud.matrixWorld),board);
      cloud.visible = weatherVisible && !coversBoard;
    }
  }

  updateWeather() {
    this.weatherElapsed += 0.016;
    if (this.precipitation) {
      this.precipitation.position.set(this.controls.target.x,0,this.controls.target.z);
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
    this.cloudBoardBounds = null;
    if (mapDefinition?.theme === 'GRAND_BAY') {
      this.cloudBoardBounds = new THREE.Box3();
      for (const tile of mapDefinition.tiles) for (const p of [tile.position,tile.lot?.position].filter(Boolean)) {
        this.cloudBoardBounds.expandByPoint(new THREE.Vector3(p.x,0,p.z));
        this.cloudBoardBounds.expandByPoint(new THREE.Vector3(p.x,10,p.z));
      }
      this.cloudBoardBounds.expandByVector(new THREE.Vector3(4,0,4));
    }
    const config = mapDefinition?.camera || {};
    const outerDistrict=({'city-loop':{x:7,z:10,distance:88},'taiwan-loop':{x:2,z:1,distance:88}})[mapDefinition?.id];
    const center = config.center || outerDistrict || { x: 0, z: 0 };
    this.mapCamera = {
      center: new THREE.Vector3(center.x || 0, 0, center.z || 0),
      overviewDistance: config.overviewDistance || outerDistrict?.distance || 62,
      followHeight: config.followHeight || 14,
      followDistance: config.followDistance || 18
    };
    this.controls.minDistance = mapDefinition?.theme === 'GRAND_BAY' ? 11 : 15;
    this.controls.maxDistance = Math.max(75, this.mapCamera.overviewDistance * 1.25);
    const shadowRadius=mapDefinition?.theme==='GRAND_BAY'?76:40;
    const shadowCamera=this.sunLight.shadow.camera;
    Object.assign(shadowCamera,{left:-shadowRadius,right:shadowRadius,top:shadowRadius,bottom:-shadowRadius,far:195});
    shadowCamera.updateProjectionMatrix();
    this.mapFogScale = mapDefinition?.theme === 'GRAND_BAY' ? 0.25 : outerDistrict ? .56 : 1;
    this.scene.fog.density = 0.008 * this.mapFogScale;
    this.camera.far = Math.max(1000, this.mapCamera.overviewDistance * 8);
    this.camera.updateProjectionMatrix();
    this.showOverview();
  }

  showOverview() {
    this.followedObject = null;
    const center = this.mapCamera?.center || new THREE.Vector3();
    const distance = this.mapCamera?.overviewDistance || 62;
    const position = center.clone().add(new THREE.Vector3(distance * 0.4, distance * 0.82, distance * 0.54));
    this.camera.position.copy(position);
    this.controls.target.copy(center);
    this.targetCameraPos = null;
    this.targetLookAt = null;
    this.controls.update();
  }

  showStreetView(position, smooth = false, tallLot = null) {
    if (!position) return;
    this.followedObject = null;
    this.targetCameraPos = null;
    this.targetLookAt = null;
    const oldTown = isOldTownView(this.activeMapId,position);
    const compact = this.container.clientWidth < 680;
    // Keep the neighboring supply-shop sign in view on the narrow mountain frontage.
    const supplyCorner = compact && this.activeMapId === 'grand-bay' && position.z === -16 && position.x >= 26 && position.x <= 30;
    const preserveStreet = this.activeMapId==='grand-bay' && (oldTown || position.z<=-16);
    const lead = preserveStreet ? new THREE.Vector3(supplyCorner?-1:4,0,3) : new THREE.Vector3(compact?.8:2,0,-.65);
    const target = position.clone().add(oldTown ? new THREE.Vector3(-1,0,-3) : lead);
    const offset = oldTownOffset(this.activeMapId,position,preserveStreet ? {x:5,y:compact?28:22,z:compact?32:28}
      : this.activeMapId==='grand-bay' && position.z>=25 ? {x:compact?6:8,y:compact?21:14,z:compact?21:14}
      : {x:compact?5:8,y:compact?23:16,z:compact?23:19});
    const cameraPosition = target.clone().add(new THREE.Vector3(offset.x,offset.y,offset.z));
    if (compact && tallLot && position.distanceToSquared(tallLot) > 1) {
      // Frame the owner and tower side by side from the road side of the plot.
      const street = position.clone().sub(tallLot).setY(0).normalize();
      const tangent = new THREE.Vector3(-street.z,0,street.x);
      target.copy(position).lerp(tallLot,.5).y += 1.1;
      cameraPosition.copy(target).addScaledVector(tangent,14).addScaledVector(street,17);
      cameraPosition.y += 24;
    }
    if (smooth) {
      this.targetLookAt = target;
      this.targetCameraPos = cameraPosition;
    } else {
      this.controls.target.copy(target);
      this.camera.position.copy(cameraPosition);
      this.controls.update();
    }
  }

  frameRouteChoice(origin, destinations) {
    const forward = new THREE.Vector3();
    for (const destination of destinations) forward.add(destination.clone().sub(origin).setY(0).normalize());
    if (forward.lengthSq() < .25) return;
    forward.normalize();
    this.stopFollowing({settle:false});
    this.targetCameraPos = this.targetLookAt = null;
    const compact = this.container.clientWidth < 680;
    this.controls.target.copy(origin).addScaledVector(forward, compact ? 6.7 : 11.2);
    this.controls.target.y += compact ? 1.5 : 2.65;
    this.camera.position.copy(origin).addScaledVector(forward, compact ? -17.4 : -18.4);
    this.camera.position.y += compact ? 13.8 : 11.6;
    this.controls.update();
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
    this.lastFollowTime = performance.now();
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

  createMovementTrail(from,to,color=0xffd166,riding=false) {
    const dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz);
    if(length<.4)return;
    const forwardX=dx/length,forwardZ=dz/length,vertices=[];
    const add=(along,side)=>{
      vertices.push(from.x+forwardX*along+forwardZ*side,.49,from.z+forwardZ*along-forwardX*side);
    };
    // A single flat mesh holds all impressions from this step.
    const sole=[[.19,0],[.13,.105],[-.06,.095],[-.12,.035],[-.105,-.065],[.09,-.105]];
    const tread=[[.13,.08],[.07,.14],[-.12,-.07],[-.08,-.14]];
    const count=Math.min(6,Math.max(2,Math.round(length/.8)));
    for(let i=0;i<count;i++){
      const along=length*(i+.4)/count;
      for(const offset of riding?[-.34,.34]:[i%2?.18:-.18]){
        const outline=riding?tread:sole;
        for(let j=0;j<outline.length;j++){
          add(along,offset);
          for(const [a,b] of [outline[j],outline[(j+1)%outline.length]])add(along+a,offset+b);
        }
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    const trail=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
      color:new THREE.Color(color).lerp(new THREE.Color('#59432e'),.55),side:THREE.DoubleSide,transparent:true,opacity:.62,depthWrite:false
    }));
    this.scene.add(trail);
    this.cinematicEffects.push({kind:'trail',mesh:trail,life:1,decay:.045});
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
    if (this.clouds && !quietMotion()) {
      this.clouds.rotation.y += 0.0003;
    }
    this.updateWeather();

    const frameTime = performance.now();
    const elapsed = (frameTime - (this.cameraFrame ?? frameTime - 16)) / 1000;
    this.cameraFrame = frameTime;
    const blend = quietMotion() ? 1 : 1 - Math.exp(-5 * elapsed);
    for (const [key, point] of [['targetCameraPos',this.camera.position],['targetLookAt',this.controls.target]]) {
      const goal = this[key];
      if (!goal) continue;
      point.lerp(goal,blend);
      if (point.distanceToSquared(goal) < .0025) { point.copy(goal); this[key]=null; }
    }

    if (this.followedObject?.position) {
      const target = this.followedObject.position.clone();
      const desired = target.clone().add(this.followOffset);
      // The pawn advances in real time, so follow in real time even on slow GPUs.
      const now = performance.now();
      const seconds = Math.min(.5, (now - this.lastFollowTime) / 1000);
      this.lastFollowTime = now;
      this.controls.target.lerp(target, 1 - Math.exp(-9 * seconds));
      this.camera.position.lerp(desired, 1 - Math.exp(-7 * seconds));
    }

    // Visibility and pawn layout must use the camera that will draw this frame.
    this.controls.update();
    this.camera.updateMatrixWorld();

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
      }
      if (effect.life <= 0) {
        this.scene.remove(effect.mesh);
        effect.mesh.traverse(child => { child.geometry?.dispose?.(); child.material?.dispose?.(); });
        this.cinematicEffects.splice(i, 1);
      }
    }

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
    this.updateCloudVisibility();
    this.renderer.render(this.scene, this.camera);
    if (shakeOffset) this.camera.position.sub(shakeOffset);
  }
}
