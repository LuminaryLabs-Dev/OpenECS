import * as THREE from "three";
import {
  createArcadeRuntime,
  createThreeSceneAdapter
} from "openecs-gamekit";

const runtime = createArcadeRuntime({
  loopMinutes: 10,
  policy: {
    ArcadeUIStateSystem: {
      updateUI({ uiState }) {
        document.querySelector("#status").textContent = `score ${uiState.score.score} | goal ${uiState.objectives.objectives?.[0]?.current ?? 0}/${uiState.objectives.objectives?.[0]?.target ?? 0}`;
      }
    }
  }
});
const defs = runtime.definitions;
const adapter = createThreeSceneAdapter(THREE, { far: 600 });

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.appendChild(adapter.renderer.domElement);

const status = document.createElement("div");
status.id = "status";
status.style.cssText = "position:fixed;left:16px;top:16px;color:white;font:700 16px system-ui;background:rgba(0,0,0,.45);padding:8px 10px;border-radius:8px";
document.body.appendChild(status);

adapter.scene.background = new THREE.Color(0x08111f);
adapter.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(10, 18, 8);
adapter.scene.add(sun);
const grid = new THREE.GridHelper(80, 20, 0x4ad6ff, 0x1d3444);
adapter.scene.add(grid);

function addMesh(geometry, color) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
  adapter.scene.add(mesh);
  return mesh;
}

runtime.addEntity([
  [defs.Transform, { position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }],
  [defs.Velocity, { x: 0, y: 0, z: 0 }],
  [defs.ControlIntent, { x: 1, z: 0 }],
  [defs.KinematicBody, { acceleration: 16, maxSpeed: 10, drag: 0.04, bounds: { minX: -36, maxX: 36, minZ: -36, maxZ: 36 } }],
  [defs.Collider, { radius: 2.4, layer: "player" }],
  [defs.Health, { current: 100, max: 100 }],
  [defs.Renderable, { object3d: addMesh(new THREE.SphereGeometry(1.2, 24, 12), 0x7cffd6) }],
  [defs.PlayerTag, {}]
]);

runtime.addEntity([
  [defs.Objective, { kind: "demo-orb", label: "Demo Orbs", current: 0, target: 8 }]
]);

for (let i = 0; i < 8; i += 1) {
  const angle = (i / 8) * Math.PI * 2;
  runtime.addEntity([
    [defs.Transform, { position: { x: Math.cos(angle) * 18, y: 1, z: Math.sin(angle) * 18 }, rotation: { x: 0, y: 0, z: 0 } }],
    [defs.Collider, { radius: 2.2, layer: "collectible", isSensor: true }],
    [defs.Collectible, { kind: "demo-orb", score: 100 }],
    [defs.ScoreValue, { amount: 100 }],
    [defs.Renderable, { object3d: addMesh(new THREE.OctahedronGeometry(1.3, 0), 0xffc857) }]
  ]);
}

let last = performance.now();
function frame(now) {
  const delta = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  const elapsed = now / 1000;
  runtime.step(delta, { x: Math.sin(elapsed * 0.7), z: Math.cos(elapsed * 0.9) });
  adapter.render(runtime.world.getResource(defs.CameraState));
  requestAnimationFrame(frame);
}

addEventListener("resize", () => adapter.resize());
frame(performance.now());
