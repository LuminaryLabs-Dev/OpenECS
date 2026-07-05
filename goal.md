# Goal

Make OpenECS a beginner-friendly example ECS structure repository.

## Intent

This repo should teach how an ECS project is organized before it tries to act like a large engine. A beginner should be able to open the repo and understand:

- what an entity is
- what a component is
- what a system is
- why the scheduler has phases
- why runtime core, GameKit helpers, and demo code live in separate folders

## Success Criteria

- The root README explains the repo as a learning map.
- `openecs-js/` remains the source of truth for the ECS core.
- `openecs-gamekit/` remains the higher-level example systems layer.
- `openecs-demo/` remains the runnable beginner consumer.
- Docs prefer exact file paths and small examples over marketing language.
- Public examples use real exported symbols and real scheduler phases.
- Beginner docs state what is supported and what is not supported.

## Non-Goals

- Do not turn the core into a full game engine.
- Do not add Rust, Go, Python, or other language ports.
- Do not hide the real API behind fake beginner classes such as `World`.
- Do not claim npm, release, or CDN stability until the release path is actually finished.
