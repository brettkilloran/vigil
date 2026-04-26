# Entity Graph Renderer Pivot

The bake-off is retired. The renderer decision is now final:

- `three.js` is the canonical and only supported renderer for the lab route.
- The HTML renderer path is deprecated and no longer exposed in UI controls.
- The route canonicalizes to `?renderer=three` for stable deep links.
- Blur/bloom effects are canonized on in the lab route (no runtime toggle).

## Canonical route contract

- Primary route: `/dev/entity-graph`
- Canonical query form: `/dev/entity-graph?renderer=three`
- Legacy `renderer=html` links must be treated as backward-compatible inputs that resolve to the Three.js experience.

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
- Assumption that maintaining dual HTML + WebGL renderers is worth ongoing product complexity.

## Validation targets

- 1k scenario: no visible hitching during pan/zoom and stable picks.
- 10k scenario: usable navigation with clear culling/LOD behavior.
- Inspector and edge-hover semantics remain consistent with pre-pivot behavior.
