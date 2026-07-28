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

    // 灯光搭建
    this.setupLighting();

    // 粒子与云朵系统
    this.particles = [];
    this.setupClouds();

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

    // 温暖的环境光
    const ambientLight = new THREE.AmbientLight('#b9e3ff', 0.85);
    this.scene.add(ambientLight);

    // 补光（蓝浅光增加立体感）
    const fillLight = new THREE.DirectionalLight('#70a1ff', 0.5);
    fillLight.position.set(-20, 20, -20);
    this.scene.add(fillLight);
  }

  setupClouds() {
    // Q版 Procedural 浮云
    const cloudGeo = new THREE.DodecahedronGeometry(2, 1);
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
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

  addUpdatable(obj) {
    this.updatables.push(obj);
  }

  resetCamera() {
    this.targetCameraPos = new THREE.Vector3(0, 32, 38);
    this.targetLookAt = new THREE.Vector3(0, 0, 0);
  }

  focusOnPosition(pos, offset = new THREE.Vector3(0, 14, 18)) {
    this.targetLookAt = pos.clone();
    this.targetCameraPos = pos.clone().add(offset);
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

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
