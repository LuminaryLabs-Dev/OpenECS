# AGENT.md

This file is for AI agents working anywhere in the OpenECS repository.

## Repo Rules

- Preserve existing behavior unless a change is explicitly requested.
- Prefer additive changes over replacement.
- Keep runtime, demo, and docs boundaries clear.
- Do not invent build, publish, or CDN support that is not already present.

## Routing

- If the task is about the JavaScript runtime or web project work, read `openecs-js/README.md` first.
- If the task involves browser, CDN, or web-import consumption, also read `openecs-js/WEBAGENT.md`.
- Keep `openecs-js/AGENT.md` and `openecs-js/WEBAGENT.md` as the package-level rules for that package.

## Validation

- Prefer CLI-based checks and direct file inspection.
- Update docs when public imports, exports, or usage expectations change.
- Do not use smoke tests or unit tests unless explicitly asked.

