# OpenECS JavaScript Gameplay Layer

## Goal

Keep `openecs-js` importable and Node-friendly, but move it past raw entity storage into a gameplay-capable ECS with resources, events, staged scheduling, and policy-injected systems.

## Current architecture

- **Entity**: a numeric id with no behavior attached.
- **Component**: entity-scoped state such as `Position`, `Health`, or `InputIntent`.
- **Resource**: world-scoped state such as `Time`, `InputState`, or bounds configuration.
- **Event**: transient tick-scoped facts such as collisions, damage, and death notifications.
- **System**: a world function registered into a phase and run in a fixed scheduler order.
- **Policy**: an injected rules object that lets one system builder behave differently across game modes or demos.

## Runtime model

```text
world
  entities
  component stores
  resource store
  event queues

scheduler
  input
  simulate
  resolve
  cleanup
```

Events are readable later in the same tick and cleared after the scheduler finishes the full phase list. This follows the common ECS pattern used by modern engines: world data is separated into entity state, global state, and transient events, while a scheduler owns execution order.

## Public API

```js
import {
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

- `defineComponent(name)`
- `defineResource(name)`
- `defineEvent(name)`
- `createWorld()`
- `world.setComponent(entity, component, value)`
- `world.getComponent(entity, component)`
- `world.setResource(resource, value)`
- `world.getResource(resource)`
- `world.emit(event, payload)`
- `world.readEvents(event)`
- `createScheduler()`
- `scheduler.addSystem(phase, system)`
- `scheduler.run(world)`

## Gameplay pattern

Systems should be created through factories plus policy objects, not rewritten per game:

- `createInputSystem(definitions, policy)`
- `createMovementSystem(definitions, policy)`
- `createCollisionSystem(definitions, policy)`
- `createDamageSystem(definitions, policy)`
- `createDeathSystem(definitions, policy)`
- `createDespawnSystem(definitions, policy)`

Keep gameplay variation in two places:

- components for per-entity state and tuning
- policy objects for scenario-wide rules such as movement math, collision filtering, damage rules, and cleanup behavior

Do not store behavior functions on entities in v1. That would make serialization, debugging, and cross-runtime portability harder.

## Demo slice

The runnable demo should prove a top-down gameplay core:

- a player driven by `InputState`
- enemies with their own intent logic
- movement through the scheduler
- collision-generated damage
- death events and cleanup-driven despawn

## Next growth path

1. Add optional component schemas and defaults.
2. Add snapshots and restore support.
3. Add richer schedule control such as run conditions or before/after constraints.
4. Swap storage internals later if archetypes or sparse sets become necessary.
