# openecs-gamekit

`openecs-gamekit` is a higher-level GameKit module built on top of `openecs-js`.

It is intentionally separate from the core runtime. `openecs-js` stays small and stable as the ECS foundation. `openecs-gamekit` adds opinionated defaults for camera, lighting, sky, render sync, and common gameplay scaffolding.

## Positioning

- `openecs-js/` is the core runtime.
- `openecs-gamekit/` is the default gameplay and scene toolkit.
- `openecs-demo/` is an example consumer.

## Public API

```js
import {
  GAMEKIT_SYSTEM_SPECS,
  createAnchorSystem,
  createBillboardSystem,
  createCinemaSystem,
  createControlSystem,
  createGameKitDefinitions,
  createLifetimeSystem,
  createLightSystem,
  createRenderSyncSystem,
  createSkyboxSystem,
  createSpawnSystem,
  createVelocitySystem,
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
- AI, quests, dialogue, save/load, and narrative systems are not default systems.
- Those higher-order systems should be optional extension modules, not part of the baseline 10.
