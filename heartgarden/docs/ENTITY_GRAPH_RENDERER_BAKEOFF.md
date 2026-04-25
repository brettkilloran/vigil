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

Fill these with hands-on numbers during Phase 2.0 pick:

| Renderer | 1k idle FPS | 1k pan FPS | 10k idle FPS | Layout warmup ms | Bundle delta |
| --- | --- | --- | --- | --- | --- |
| html |  |  |  |  |  |
| pixi |  |  |  |  |  |
| sigma |  |  |  |  |  |
| rfg |  |  |  |  |  |

## Decision prep (qualitative, current state)

| Renderer | Control over visuals | Scale headroom | Integration complexity | Current parity notes |
| --- | --- | --- | --- | --- |
| html | Highest | Lowest | Lowest | Most complete interaction model, but DOM-bound for large N |
| pixi | Very high | Very high | Medium-high | Best current path for bespoke visual treatment at 10k+ |
| sigma | Medium | Very high | Medium | Fastest route to high scale; custom pill language is harder |
| rfg | Medium-high | Medium-high | Medium | Quick canvas customization; less deterministic camera/runtime behavior |

### Working recommendation before final pick

- If primary goal is **10k+ with strict control of the visual language**, favor **Pixi**.
- If primary goal is **speed to scalable graph with less custom rendering work**, favor **Sigma**.
- If primary goal is **fast custom canvas experimentation**, favor **RFG**.

## Package versions under test

- `pixi.js@8.18.1`
- `sigma@3.0.2`
- `graphology@0.26.0`
- `graphology-types@0.24.8`
- `react-force-graph-2d@1.29.1`

## Phase 2.0 readiness checklist

- [x] Shared lab chrome and inspector contract across all renderer modes.
- [x] Real directional implementations for `pixi`, `sigma`, and `rfg`.
- [x] Synthetic stress scenarios (`Stress 1k`, `Stress 10k`) available to all renderers.
- [x] Shared interaction baseline (selection, edge selection, focus/dim behavior).
- [x] Shared camera actions (`reset`, `frame-all`, `frame-selection`).
- [x] Build passes with all four renderer modes available behind query flags.

## Dependency note

Dependencies are currently committed on `entity-graph-scale` by request for safe checkpointing while work continues. Final pruning still happens at Phase 2.2 once a winner is chosen.
