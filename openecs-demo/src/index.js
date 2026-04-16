import {
  createScheduler,
  createWorld,
  defineComponent,
  defineResource
} from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/OpenECS@main/openecs-js/src/index.js";

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

const Position = defineComponent("position");
const Motion = defineComponent("motion");
const MeshRef = defineComponent("mesh-ref");
const Kind = defineComponent("kind");
const Time = defineResource("time");

const world = createWorld();
const scheduler = createScheduler();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08111f);
scene.fog = new THREE.Fog(0x08111f, 10, 28);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 8, 14);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x90a9ff, 0.45));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(6, 10, 4);
scene.add(sun);
scene.add(new THREE.GridHelper(30, 30, 0x335577, 0x1a2f44));

const addMesh = (geo, mat) => {
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
};

const spawn = (kind, x, y, z, motion, mesh) => {
  const entity = world.addEntity();
  world.setComponent(entity, Kind, kind);
  world.setComponent(entity, Position, { x, y, z });
  world.setComponent(entity, Motion, motion);
  world.setComponent(entity, MeshRef, { mesh });
  return entity;
};

world.setResource(Time, { tick: 0, elapsed: 0 });

const player = spawn(
  "player",
  0,
  0.6,
  0,
  { sway: 0, spin: 0.02, radius: 0 },
  addMesh(new THREE.SphereGeometry(0.7, 32, 16), new THREE.MeshStandardMaterial({ color: 0x7cffd6, metalness: 0.2, roughness: 0.2 }))
);

spawn(
  "core",
  0,
  0.25,
  0,
  { sway: 0, spin: 0.01, radius: 0 },
  addMesh(new THREE.CylinderGeometry(1.8, 1.8, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x23385c, roughness: 0.8 }))
);

for (let i = 0; i < 8; i += 1) {
  spawn(
    "satellite",
    Math.cos((i / 8) * Math.PI * 2) * 4,
    1.4 + (i % 2) * 0.4,
    Math.sin((i / 8) * Math.PI * 2) * 4,
    { sway: 0.6 + i * 0.06, spin: 0.02 + i * 0.003, radius: 4, phase: i * 0.7 },
    addMesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: 0.45 }))
  );
}

function motionSystem(world) {
  const time = world.getResource(Time);
  time.tick += 1;
  time.elapsed += 0.016;

  for (const entity of world.query(Position, Motion, Kind)) {
    const position = world.getComponent(entity, Position);
    const motion = world.getComponent(entity, Motion);
    const kind = world.getComponent(entity, Kind);

    if (kind === "player") {
      position.x = Math.sin(time.elapsed * 0.9) * 4.6;
      position.z = Math.cos(time.elapsed * 0.7) * 4.6;
      position.y = 0.8 + Math.sin(time.elapsed * 2) * 0.25;
    } else if (kind === "core") {
      position.y = 0.28;
    } else {
      const angle = time.elapsed * motion.spin + motion.phase;
      position.x = Math.cos(angle) * motion.radius;
      position.z = Math.sin(angle) * motion.radius;
      position.y = 1.3 + Math.sin(time.elapsed * motion.sway + motion.phase) * 0.45;
    }
  }
}

function renderSystem(world) {
  const time = world.getResource(Time).elapsed;
  for (const entity of world.query(Position, MeshRef)) {
    const position = world.getComponent(entity, Position);
    const mesh = world.getComponent(entity, MeshRef).mesh;
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.y = time * 0.4;
  }
  camera.position.x = Math.sin(time * 0.25) * 14;
  camera.position.z = Math.cos(time * 0.25) * 14;
  camera.position.y = 7 + Math.sin(time * 0.5) * 1.2;
  camera.lookAt(0, 1, 0);
  renderer.render(scene, camera);
}

scheduler.addSystem("simulate", motionSystem);
scheduler.addSystem("resolve", renderSystem);

function frame() {
  scheduler.run(world);
  requestAnimationFrame(frame);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

frame();
