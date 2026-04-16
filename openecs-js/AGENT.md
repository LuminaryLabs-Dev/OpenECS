# AGENT.md

This file is for AI coding agents working in `openecs-js`.

## Goals
- Preserve existing behavior unless a change is explicitly requested.
- Prefer additive changes over replacement.
- Keep the package importable as a plain ESM module.
- Update docs when public imports, exports, or usage expectations change.

## Package Boundaries
- `openecs-js` is the importable runtime package.
- `openecs-demo` is the demo app and should not be treated as the package API.
- Keep package-level guidance aligned with `package.json` and the README.

## Working Rules
- Read the current files before editing.
- Do not invent build, publish, or CDN support that is not already present.
- If public imports or exports change, update the README example and package metadata together.
- Prefer small, composable changes that preserve current consumers.

## Validation
- Prefer CLI-based checks and direct file inspection.
- Confirm package entrypoints and export targets when packaging behavior changes.
- Do not use smoke tests or unit tests unless explicitly asked.

## Documentation Rule
- If the package becomes browser-ready or CDN-ready later, document the exact supported path instead of implying one.
