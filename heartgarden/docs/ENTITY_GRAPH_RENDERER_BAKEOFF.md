# Entity Graph Renderer Bake-off

This document compares directional renderer options wired at:

- `/dev/entity-graph?renderer=html`
- `/dev/entity-graph?renderer=pixi`
- `/dev/entity-graph?renderer=sigma`
- `/dev/entity-graph?renderer=rfg`

## Rubric

- Visual fidelity for pill-driven graph language.
- Customization friction for relation-aware edges, type tinting, and inspector coupling.
- Runtime performance at stress scenarios.
- Bundle and dependency footprint.

## Current status

All four routes share one chrome/inspector contract and a common synthetic stress dataset (`Stress 1k`, `Stress 10k`).

Current prototypes are live implementations:

- `html`: existing pill canvas renderer.
- `pixi`: dedicated Pixi stage with WebGL edges/nodes and close-zoom HTML pill overlay.
- `sigma`: dedicated Sigma graph renderer with selection/dimming and camera framing actions.
- `rfg`: dedicated react-force-graph canvas renderer with custom pill drawing and relation-aware edge styling.

## Metrics template

Fill this once dedicated renderers are complete:

| Renderer | 1k idle FPS | 1k pan FPS | 10k idle FPS | Layout warmup ms | Bundle delta |
| --- | --- | --- | --- | --- | --- |
| html |  |  |  |  |  |
| pixi |  |  |  |  |  |
| sigma |  |  |  |  |  |
| rfg |  |  |  |  |  |

## Dependency note

During bake-off, dependencies are intentionally installed locally and not committed to baseline branch history until one renderer wins.
