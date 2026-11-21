import * as THREE from 'three';
import { surfaceTime } from './BoardSurfaceArt.js';
import { COAST_WATER_Y } from './IslandCoast.js';

export function createHarborSea() {
  const material = new THREE.MeshStandardMaterial({
    color: '#2396bb', roughness: .28, metalness: .12, transparent: true, opacity: .94
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.tide = surfaceTime;
    shader.vertexShader = 'varying vec2 seaPoint;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nseaPoint = position.xy;'
    );
    // The slow swell changes the turquoise water under shorter, broken foam crests.
    // Fade the narrow crests as their projected spacing approaches a screen pixel.
    shader.fragmentShader = 'varying vec2 seaPoint; uniform float tide;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>', `
        #include <color_fragment>
        float swell = sin(seaPoint.y * .36 + seaPoint.x * .14 + tide * .53);
        float phase = seaPoint.y * 2.65 + 1.3 * sin(seaPoint.x * .36 + tide * .40) + tide * 1.25;
        float crest = smoothstep(.89, .99, sin(phase));
        float shoal = smoothstep(-.1, .82, sin(seaPoint.x * .69 + swell * 1.8));
        float clarity = 1. - smoothstep(.45, 1.65, fwidth(phase));
        diffuseColor.rgb *= vec3(.92, .96, 1.) + vec3(.08, .06, .02) * swell;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.52, .92, .85), crest * shoal * clarity * .47);
      `
    );
  };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), material);
  sea.name = 'island-sea';
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, COAST_WATER_Y, -3);
  return sea;
}

export function createLighthouse() {
  const tower = new THREE.Group();
  tower.position.set(60, 0, 37);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.7, 1.1, 5.2, 16),
    new THREE.MeshBasicMaterial({ color: '#f4f4ea' }));
  body.position.y = 2.6;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.05, 16),
    new THREE.MeshBasicMaterial({ color: '#e65353' }));
  roof.position.y = 6.52;
  // Paint the lamp's directional highlight into the existing silhouette without a spotlight.
  const glass = new THREE.CylinderGeometry(.72, .72, .8, 16, 1, true);
  const colors = [];
  const amber = new THREE.Color('#ba8453'), lit = new THREE.Color('#fff6bc'), tint = new THREE.Color();
  for (let i = 0; i < glass.attributes.normal.count; i++) {
    tint.copy(amber).lerp(lit, Math.max(0, glass.attributes.normal.getZ(i)) ** 3);
    colors.push(tint.r, tint.g, tint.b);
  }
  glass.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const lantern = new THREE.Mesh(glass, new THREE.MeshBasicMaterial({ vertexColors: true }));
  lantern.name = 'lighthouse-lantern';
  lantern.position.y = 5.6;
  tower.add(body, lantern, roof);
  return tower;
}

const dropPose = new THREE.Object3D();
const jets = 6, dropsPerJet = 4;

export function createFountainSpray() {
  const spray = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#d7faff' }),
    jets * dropsPerJet
  );
  spray.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Enclose the whole jet trajectory, including phases between rendered frames.
  spray.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .68, 0), 1.4);
  updateFountainSpray(spray, 0);
  return spray;
}

export function updateFountainSpray(spray, time) {
  for (let jet = 0; jet < jets; jet++) {
    const angle = jet * Math.PI * 2 / jets;
    const x = Math.cos(angle), z = Math.sin(angle);
    for (let bead = 0; bead < dropsPerJet; bead++) {
      const phase = (time * .80 + jet * .13 + bead / dropsPerJet) % 1;
      const radius = .17 + .83 * phase;
      const height = (1 - phase) * (.96 + 2.9 * phase);
      dropPose.position.set(x * radius, height, z * radius);
      dropPose.scale.set(.048, .064 + .037 * phase, .048);
      dropPose.updateMatrix();
      spray.setMatrixAt(jet * dropsPerJet + bead, dropPose.matrix);
    }
  }
  spray.instanceMatrix.needsUpdate = true;
}
