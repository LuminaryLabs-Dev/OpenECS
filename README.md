# OpenECS

If you are an AI agent or automated coder, read `AGENT.md` first.

OpenECS is a beginner-friendly JavaScript ECS structure example repo. It shows how to separate a pure ECS core, reusable gameplay systems, and a browser demo without inventing unsupported APIs.

## Start Here

Read in this order:

1. `goal.md` - current repo intent and success criteria
2. `openecs-docs/beginner-ecs-structure.md` - beginner ECS map
3. `openecs-js/README.md` - the real ECS runtime API
4. `openecs-gamekit/README.md` - reusable example systems
5. `openecs-demo/README.md` - browser demo consumer

## What This Repo Teaches

- Entities are ids, not objects with methods.
- Components are data attached to entities.
- Systems are functions scheduled into phases.
- Resources hold world-level state.
- Events carry short-lived tick facts.
- Rendering belongs in the demo or GameKit layer, not the core runtime.

## Repo Map for Tools

- `openecs-js/` is the only public runtime package and the runtime source of truth.
- `openecs-gamekit/` is the opinionated gameplay and scene toolkit built on top of `openecs-js`.
- `openecs-demo/` is an example consumer, not the API definition.
- `openecs-docs/` contains supporting documentation and notes.

## Beginner Folder Map

```text
OpenECS/
  openecs-js/       learn the ECS primitives
  openecs-gamekit/  learn reusable systems and phase layout
  openecs-demo/     learn browser consumption and visual output
  openecs-docs/     learn the architecture notes
```

## Run The Demo

Build the local package entrypoints first:

```sh
cd /Users/crimsonwheeler/Documents/GitHub/OpenECS/openecs-js && npm run build
cd /Users/crimsonwheeler/Documents/GitHub/OpenECS/openecs-gamekit && npm run build
```

Start the static server:

```sh
cd /Users/crimsonwheeler/Documents/GitHub/OpenECS/openecs-demo && npm start
```

Open:

```text
http://localhost:4173/openecs-demo/
```

## Local Browser Consumption

The current browser-ready local paths are plain ESM files:

- `/openecs-js/dist/index.js`
- `/openecs-gamekit/dist/index.js`

Sibling consumers such as NexusArcade should serve those files through an import map:

```html
<script type="importmap">
  {
    "imports": {
      "openecs-js": "/vendor/openecs-js/dist/index.js",
      "openecs-gamekit": "/vendor/openecs-gamekit/dist/index.js"
    }
  }
</script>
```

Future public CDN usage should pin a tag or commit SHA with jsDelivr instead of importing from `@main`.

## For AI and Codegen Tools

- Read `AGENT.md` first.
- Preserve the beginner learning path when changing docs or examples.
- Then read `openecs-js/README.md`.
- For browser or CDN tasks, also read `openecs-js/WEBAGENT.md`.
- If docs and generated code disagree, trust the exported symbols in `openecs-js/src/index.js`.

## Repo Layout

- `openecs-js/` - the importable ECS runtime package
- `openecs-gamekit/` - the higher-level GameKit package with default gameplay and scene systems
- `openecs-demo/` - the browser demo that uses the runtime
- `openecs-docs/` - repo documentation and notes
