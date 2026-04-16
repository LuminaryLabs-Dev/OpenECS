# OpenECS

If you are an AI agent or automated coder, read `AGENT.md` first.

## Repo Map for Tools

- `openecs-js/` is the runtime source of truth.
- `openecs-demo/` is an example consumer, not the API definition.
- `openecs-docs/` contains supporting documentation and notes.

## For AI and Codegen Tools

- Read `AGENT.md` first.
- Then read `openecs-js/README.md`.
- For browser or CDN tasks, also read `openecs-js/WEBAGENT.md`.
- If docs and generated code disagree, trust the exported symbols in `openecs-js/src/index.js`.

## Repo Layout

- `openecs-js/` - the importable ECS runtime package
- `openecs-demo/` - the browser demo that uses the runtime
- `openecs-docs/` - repo documentation and notes
