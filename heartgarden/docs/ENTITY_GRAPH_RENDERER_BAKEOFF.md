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

The current `pixi`, `sigma`, and `rfg` implementations are scaffold routes preserving the contract while we complete dedicated renderer internals. This keeps A/B route behavior stable during iteration and prevents integration churn.

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
