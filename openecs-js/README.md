# openecs-js

If you are an AI agent or automated coder, read `AGENT.md` and `WEBAGENT.md` before making changes.

`openecs-js` is a small JavaScript ECS runtime with enough runtime structure to build gameplay slices directly in Node.

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

## Current shape

- Entities are numeric ids.
- Components hold entity-scoped state.
- Resources hold world-scoped state.
- Events carry transient tick-scoped facts.
- Systems run in ordered scheduler phases.
- Policies let one system builder behave differently across demos or game modes.

## Example

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
