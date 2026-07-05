# openecs-demo

`openecs-demo` is the beginner browser example for OpenECS.

It is a consumer of the repo packages, not the API source of truth.

## What It Teaches

- Use an import map to load `openecs-js` and `openecs-gamekit`.
- Create visible Three.js objects outside the ECS core.
- Store game state in ECS components.
- Step the runtime each animation frame.
- Render from ECS-driven state through the GameKit adapter.

## Run

From the repo root:

```sh
cd /Users/crimsonwheeler/Documents/GitHub/OpenECS/openecs-demo && npm start
```

Then open:

```text
http://localhost:4173/openecs-demo/
```

## Important Boundary

- `openecs-js/` defines the ECS API.
- `openecs-gamekit/` defines reusable example systems.
- `openecs-demo/` only shows one way to consume them.

If this demo and `openecs-js/src/index.js` disagree, trust `openecs-js/src/index.js`.
