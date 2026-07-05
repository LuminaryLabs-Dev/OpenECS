# openecs-gamekit

`openecs-gamekit` is a higher-level GameKit module built on top of `openecs-js`.

It is intentionally separate from the core runtime. `openecs-js` stays small and stable as the ECS foundation. `openecs-gamekit` adds opinionated defaults for camera, lighting, sky, render sync, and common gameplay scaffolding.

## Beginner Role

Read this after `openecs-js/README.md`.

`openecs-gamekit` shows how to layer reusable systems on top of a pure ECS core. It is where camera, light, sky, render sync, collision, movement, and arcade loop examples can live without making the core runtime depend on Three.js or browser APIs.

## Positioning

- `openecs-js/` is the core runtime.
- `openecs-gamekit/` is the default gameplay and scene toolkit.
- `openecs-demo/` is an example consumer.

## Public API

```js
import {
  ARCADE_SYSTEM_SPECS,
  GAMEKIT_SYSTEM_SPECS,
  createAnchorSystem,
  createArcadeDefinitions,
  createArcadeManifest,
  createArcadeRuntime,
  createBillboardSystem,
  createCinemaSystem,
  createCollisionSystem,
  createControlSystem,
  createDamageSystem,
  createDeathSystem,
  createDespawnSystem,
  createGameKitDefinitions,
  createInputSystem,
  createLifetimeSystem,
  createLightSystem,
  createMovementSystem,
  createRenderSyncSystem,
  createSkyboxSystem,
  createSpawnSystem,
  createThreeSceneAdapter,
  createVelocitySystem,
  registerArcadeSystems,
  registerDefaultGameKitSystems
} from "openecs-gamekit";
```

## Default Systems

These are the 10 default systems included in GameKit:

1. `ControlSystem`
Maps `InputState` into per-entity `ControlIntent` so player and AI control can share the same downstream movement path.

2. `SpawnSystem`
Consumes `SpawnQueue` requests and turns them into world entities through a spawn policy.

3. `VelocitySystem`
Applies `Velocity` to `Transform` during `simulate`, acting as the default kinematic movement layer.

4. `AnchorSystem`
Keeps entities attached to other entities through offsets. Useful for follow rigs, child attachments, and mount points.

5. `CinemaSystem`
Composes active camera framing, blend, offsets, and FOV into a resource-driven camera rig.

6. `LightSystem`
Synchronizes ECS light data into real light objects and keeps lighting state data-driven.

7. `SkyboxSystem`
Re-centers or updates sky presentation against the active camera so the scene remains spatially coherent.

8. `BillboardSystem`
Faces billboarded elements toward the camera for sprites, markers, and effect planes.

9. `RenderSyncSystem`
Pushes `Transform` state into render objects. This is the main bridge from ECS state to Three.js objects.

10. `LifetimeSystem`
Expires temporary entities during cleanup and removes them after their timers run out.

## Default Phase Layout

```js
[
  { name: "ControlSystem", phase: "input" },
  { name: "SpawnSystem", phase: "input" },
  { name: "VelocitySystem", phase: "simulate" },
  { name: "AnchorSystem", phase: "simulate" },
  { name: "CinemaSystem", phase: "resolve" },
  { name: "LightSystem", phase: "resolve" },
  { name: "SkyboxSystem", phase: "resolve" },
  { name: "BillboardSystem", phase: "resolve" },
  { name: "RenderSyncSystem", phase: "resolve" },
  { name: "LifetimeSystem", phase: "cleanup" }
]
```

## Minimal Usage

```js
import { createScheduler, createWorld } from "openecs-js";
import {
  createGameKitDefinitions,
  registerDefaultGameKitSystems
} from "openecs-gamekit";

const world = createWorld();
const scheduler = createScheduler();
const defs = createGameKitDefinitions();

world.setResource(defs.Time, { delta: 1 / 60 });
world.setResource(defs.InputState, {});
world.setResource(defs.SpawnQueue, []);
world.setResource(defs.ActiveCamera, {
  position: { x: 0, y: 0, z: 0 },
  fov: 60
});

registerDefaultGameKitSystems(scheduler, defs);
scheduler.run(world);
```

## Design Notes

- `GameKit` is mixed render plus gameplay, with render-heavy bias.
- Gameplay factory helpers such as `createMovementSystem` and `createCollisionSystem` are exported here as the long-term gameplay-layer home.
- AI, quests, dialogue, save/load, and narrative systems are not default systems.
- Those higher-order systems should be optional extension modules, not part of the baseline 10.

## Arcade Layer

The arcade layer is additive on top of the baseline GameKit systems. It is intended for small longform browser arcade games that need a 10-minute loop with little per-game code.

Main entrypoints:

```js
import {
  createArcadeRuntime,
  createThreeSceneAdapter,
  createArcadeManifest
} from "openecs-gamekit";
```

The arcade runtime provides definitions and systems for input, kinematic movement, collision, collection, health/damage, objectives, scoring, spawn pressure, difficulty, camera, render sync, UI state, audio cues, lifetime, and despawn.

Local browser import map:

```html
<script type="importmap">
  {
    "imports": {
      "openecs-js": "/vendor/openecs-js/dist/index.js",
      "openecs-gamekit": "/vendor/openecs-gamekit/dist/index.js",
      "three": "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js"
    }
  }
</script>
```
