# openecs-js

If you are an AI agent or automated coder, read `AGENT.md` and `WEBAGENT.md` before making changes.

`openecs-js` is a small JavaScript ECS runtime that exports functions from `openecs-js/src/index.js`.

If docs and generated code disagree, trust the exported symbols in `openecs-js/src/index.js`.

## Quick Truth

- This package exports functions, not a `World` class.
- Primary entrypoint: `openecs-js/src/index.js`
- Supported import forms: local package import and direct ESM CDN import
- Not provided: `openecs.js` bundle, Three.js adapter, engine framework, npm-published browser bundle

## Actual API Surface

```js
import {
  DEFAULT_PHASES,
  createCollisionSystem,
  createDamageSystem,
  createDeathSystem,
  createDespawnSystem,
  createInputSystem,
  createMovementSystem,
  createScheduler,
  createWorld,
  defineComponent,
  defineEvent,
  defineResource
} from "openecs-js";
```

## Do Not Assume

- No `new World()`
- No `world.createEntity()`
- No `entity.addComponent()`
- No `world.update(dt)`
- No `openecs-js/openecs.js`

## Browser/CDN Usage

Supported now:

- Direct ESM import from `openecs-js/src/index.js`
- GitHub-backed CDN import of that ESM file

Unsupported now:

- Dedicated browser build
- UMD or IIFE bundle
- Official Three.js adapter
- Official game framework layer

## GitHub CDN Import

If you want to use this package from another project without installing it through npm, import the ESM source from a GitHub-backed CDN.

Recommended form:

```js
import {
  createWorld,
  createScheduler,
  defineComponent
} from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/OpenECS@main/openecs-js/src/index.js";
```

Prefer a tagged release or commit SHA instead of `@main` when you need a stable dependency.

## Current Shape

- Entities are numeric ids.
- Components hold entity-scoped state.
- Resources hold world-scoped state.
- Events carry transient tick-scoped facts.
- Systems run in ordered scheduler phases.
- Policies let one system builder behave differently across demos or game modes.

## Minimal Complete Example

```js
import {
  createMovementSystem,
  createScheduler,
  createWorld,
  defineComponent,
  defineResource
} from "openecs-js";

const Position = defineComponent("position");
const Velocity = defineComponent("velocity");
const InputIntent = defineComponent("input-intent");
const MovementStats = defineComponent("movement-stats");
const Time = defineResource("time");
const WorldBounds = defineResource("world-bounds");

const world = createWorld();
const scheduler = createScheduler();
const entity = world.addEntity();

world.setComponent(entity, Position, { x: 0, y: 0 });
world.setComponent(entity, Velocity, { x: 0, y: 0 });
world.setComponent(entity, InputIntent, { x: 1, y: 0 });
world.setComponent(entity, MovementStats, { speed: 2 });
world.setResource(Time, { delta: 1 });
world.setResource(WorldBounds, { minX: 0, maxX: 10, minY: 0, maxY: 10 });

const movementSystem = createMovementSystem({
  Position,
  Velocity,
  InputIntent,
  MovementStats,
  Time,
  WorldBounds
});

scheduler.addSystem("simulate", movementSystem);
scheduler.run(world);
```
