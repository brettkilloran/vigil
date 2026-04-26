# Entity Graph Renderer Pivot

The bake-off is retired. Active renderer routes are now:

- `/dev/entity-graph?renderer=webgl` (primary path)
- `/dev/entity-graph?renderer=html` (temporary fallback)

## Carry-forward checklist

These non-renderer wins are required to stay intact during the WebGL pivot:

- [x] `graphology` model contract for neighbor/degree/edge lookups.
- [x] Layout worker APIs and incremental/streaming solve path.
- [x] Inspector relation grouping and edge detail semantics.
- [x] Keyboard focus affordances (`J/K`, `Enter`, `Esc`) and camera shortcuts.
- [x] Pin/unpin, re-solve, reset-lab behavior.
- [x] Stress scenarios (`Stress 1k`, `Stress 10k`) and perf HUD instrumentation.

## Stale assumptions retired

- Multi-renderer decision matrix (`pixi`, `sigma`, `rfg`) as day-to-day workflow.
- React-force-graph as a final architecture target.
- Assumption that high-density scale can be solved by DOM-heavy rendering.

## Validation targets

- 1k scenario: no visible hitching during pan/zoom and stable picks.
- 10k scenario: usable navigation with clear culling/LOD behavior.
- Inspector and edge-hover semantics remain consistent with pre-pivot behavior.
