# openecs-js

If you are an AI agent or automated coder, read `AGENT.md` and `WEBAGENT.md` before making changes.

`openecs-js` is a small JavaScript ECS runtime that exports functions from `openecs-js/dist/index.js`.

If docs and generated code disagree, trust the exported symbols in `openecs-js/src/index.js`.

## Beginner Role

Start here when you want to learn the ECS core. This package shows the engine-agnostic layer: entities, components, resources, events, queries, command buffers, snapshots, and scheduler phases.

Do not look for rendering, Three.js, camera rigs, or game framework behavior in this package. Those examples belong in `openecs-gamekit/` and `openecs-demo/`.

## Quick Truth

- This package exports functions, not a `World` class.
- Primary published entrypoint: `openecs-js/dist/index.js`
- Source of truth: `openecs-js/src/index.js`
- Supported import forms: local package import and direct ESM CDN import
- Not provided: `openecs.js` bundle, Three.js adapter, engine framework, npm-published browser bundle
- Gameplay factory helpers remain compatibility exports in `openecs-js`; new gameplay-facing code should prefer `openecs-gamekit`.

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
  defineQuery,
  defineResource
} from "openecs-js";
```

## Core API Additions

- `defineQuery(config)` creates reusable query descriptors with `all`, `any`, `none`, `optional`, and `resources`.
- `world.queryEntities(query)` returns entity handles for a query descriptor.
- `world.queryData(query)` returns entity handles with matching component/resource data.
- `world.createCommandBuffer()` queues structural changes for scheduler phase flushing.
- `world.snapshot()` and `world.restore(snapshot)` support serializable world state.
- `world.inspect()`, `world.stats()`, `world.hasEntity(entity)`, and `world.componentsOf(entity)` expose diagnostics.
- `scheduler.addSystem(phase, system, metadata)` accepts `name`, `before`, `after`, `runIf`, and `fixedStep`.

## v0.2 Core Direction

- Entity handles are numeric and generation-aware, so stale handles can be rejected after removal and slot reuse.
- Queries use indexed component stores and query plans instead of relying only on full entity scans.
- Command buffers let systems queue structural changes that the scheduler flushes at phase boundaries.
- Events support same-tick delivery, next-tick delivery, manual clearing, and optional history windows.
- Snapshots and diagnostics are core runtime features, not GameKit features.

## Do Not Assume

- No `new World()`
- No `world.createEntity()`
- No `entity.addComponent()`
- No `world.update(dt)`
- No `openecs-js/openecs.js`

## Browser/CDN Usage

Supported now:

- Local package import from `openecs-js`
- Direct ESM import from `openecs-js/dist/index.js`
- GitHub-backed CDN import of that ESM file

Unsupported now:

- Dedicated browser build
- UMD or IIFE bundle
- Official Three.js adapter
- Official game framework layer

## GitHub CDN Import

If you want to use this package from another project without installing it through npm, import the built ESM entry from a GitHub-backed CDN.

Development form:

```js
import {
  createWorld,
  createScheduler,
  defineComponent
} from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/OpenECS@main/openecs-js/dist/index.js";
```

Stable form once releases exist:

Replace `@main` with a Git tag or commit SHA after you publish releases.

Prefer a tagged release or commit SHA instead of `@main` when you need a stable dependency.

## Local NexusArcade Import

NexusArcade serves the local dist file through its Vite vendor bridge while developing games:

```html
<script type="importmap">
  {
    "imports": {
      "openecs-js": "/vendor/openecs-js/dist/index.js"
    }
  }
</script>
```

Run `npm run build` in `openecs-js/` before validating a browser consumer.

## Install and Release Paths

Local workspace consumer:

```json
{
  "dependencies": {
    "openecs-js": "file:../openecs-js"
  }
}
```

Package import:

```js
import { createWorld, createScheduler } from "openecs-js";
```

npm and CDN consumer once published:

```js
import { createWorld, createScheduler } from "openecs-js";
```

Browser ESM validation page:

```text
openecs-js/examples/browser-esm.html
```

## Current Shape

- Entities are numeric ids.
- Components hold entity-scoped state.
- Resources hold world-scoped state.
- Events carry transient tick-scoped facts.
- Systems run in ordered scheduler phases: `input`, `simulate`, `resolve`, `cleanup`.
- Policies let one system builder behave differently across demos or game modes.

## Beginner Mental Model

```text
define data types -> create a world -> add entities -> attach data -> run systems
```

The world stores data. The scheduler decides which systems run and in what order. Systems should read and write data through the world API instead of storing behavior on entities.

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
