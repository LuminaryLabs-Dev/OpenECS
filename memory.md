# Memory

## Purpose

OpenECS is now positioned as a beginner-friendly JavaScript ECS structure example repo.

The repo should teach ECS architecture through a small real runtime, a higher-level GameKit layer, and a runnable browser demo. It should stay honest about what is implemented, what is only local, and what still needs release work.

## Architecture Shape

- `openecs-js/` is the pure ECS runtime and source of truth.
- `openecs-gamekit/` is the opinionated gameplay and scene systems layer.
- `openecs-demo/` is the beginner-facing browser consumer.
- `openecs-docs/` contains explanatory and planning docs.
- `goal.md` stores the current live repo goal.

## Conventions

- Keep the core function-based API. Do not introduce fake class APIs for beginner familiarity.
- Use the scheduler phases `input`, `simulate`, `resolve`, and `cleanup`.
- Keep rendering and Three.js assumptions outside `openecs-js`.
- Prefer small copy-pasteable examples that match `openecs-js/src/index.js`.
- If docs and generated code disagree, trust source exports from `openecs-js/src/index.js`.
- When public behavior changes, update README docs and beginner docs in the same pass.

## Current Beginner Path

1. Read `README.md`.
2. Read `openecs-docs/beginner-ecs-structure.md`.
3. Read `openecs-js/README.md`.
4. Read `openecs-gamekit/README.md`.
5. Run or inspect `openecs-demo/`.
