# AGENT.md

This file is for AI agents working anywhere in the OpenECS repository.

## Repo Rules

- Preserve existing behavior unless a change is explicitly requested.
- Prefer additive changes over replacement.
- Keep runtime, demo, and docs boundaries clear.
- Treat this repo as a beginner-friendly ECS structure example before treating it as a large engine.
- Keep `memory.md` updated when a lasting repo purpose, architecture rule, or convention changes.
- Use `goal.md` as the live goal contract when repo direction changes.
- Do not invent build, publish, or CDN support that is not already present.
- Verify generated code against the actual exports in `openecs-js/src/index.js` before claiming an integration works.

## Routing

- If the task is about beginner structure or repo orientation, read `goal.md`, `memory.md`, and `openecs-docs/beginner-ecs-structure.md`.
- If the task is about the JavaScript runtime or web project work, read `openecs-js/README.md` first.
- If the task involves browser, CDN, or web-import consumption, also read `openecs-js/WEBAGENT.md`.
- Keep `openecs-js/AGENT.md` and `openecs-js/WEBAGENT.md` as the package-level rules for that package.

## Validation

- Prefer CLI-based checks and direct file inspection.
- Update docs when public imports, exports, or usage expectations change.
- Do not use smoke tests or unit tests unless explicitly asked.
- If generated code names symbols that are not exported from `openecs-js/src/index.js`, treat the code as incorrect.
