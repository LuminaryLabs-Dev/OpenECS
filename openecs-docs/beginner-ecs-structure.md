# Beginner ECS Structure

This repo is a map of one practical way to organize an ECS project in JavaScript.

## The ECS Idea

ECS means Entity, Component, System.

- Entity: an id for one thing in the world.
- Component: data attached to an entity.
- System: logic that reads and writes component data.
- Resource: global data shared by systems.
- Event: short-lived facts from the current tick.
- Scheduler: the ordered list of systems that run each tick.

## Repo Shape

```text
OpenECS/
  openecs-js/       core ECS runtime
  openecs-gamekit/  reusable gameplay and scene systems
  openecs-demo/     browser example that consumes the packages
  openecs-docs/     explanation and planning docs
```

## Learning Path

1. Start with `openecs-js/`.
It shows the smallest core layer: worlds, components, resources, events, queries, and scheduler phases.

2. Then read `openecs-gamekit/`.
It shows how to build reusable systems on top of the core without putting rendering into the core.

3. Then inspect `openecs-demo/`.
It shows how a browser project imports the built files and creates entities with components.

## Runtime Core Boundary

`openecs-js/` should stay engine-agnostic.

It should not know about:

- Three.js
- cameras
- lights
- meshes
- browser input
- asset loading

It should know about:

- entities
- component stores
- resources
- events
- queries
- command buffers
- scheduler phases
- snapshots and diagnostics

## GameKit Boundary

`openecs-gamekit/` is the example layer for reusable systems.

It can include opinionated systems such as:

- `ControlSystem`
- `SpawnSystem`
- `VelocitySystem`
- `CinemaSystem`
- `LightSystem`
- `SkyboxSystem`
- `RenderSyncSystem`

This is where beginner-friendly game structure belongs. It keeps the core clean while still showing how real game code can be organized.

## Demo Boundary

`openecs-demo/` is not the API definition.

It is allowed to be concrete and visual:

- import Three.js
- create meshes
- show browser rendering
- use GameKit helpers
- demonstrate one readable loop

If the demo disagrees with `openecs-js/src/index.js`, the source file wins.

## Tick Flow

```text
input     read controls and spawn requests
simulate  move entities and run world rules
resolve   sync camera, lights, sky, render objects
cleanup   remove expired or dead entities
```

Use these exact phase names:

- `input`
- `simulate`
- `resolve`
- `cleanup`

Do not use a generic `update` phase unless the scheduler is explicitly changed to support it.

## Beginner Rule

Keep examples honest before making them fancy.

Good beginner examples:

- define components first
- create a world
- add entities
- attach components
- register systems into real phases
- call `scheduler.run(world)`

Bad beginner examples:

- invent `new World()`
- invent `world.update(dt)`
- invent `entity.addComponent()`
- import from missing files
- mix rendering into the core package
