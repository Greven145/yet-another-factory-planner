# 2. Accessible alternative for the production graph

- Status: Accepted
- Date: 2026-06-30
- Issue: [#92](https://github.com/Greven145/yet-another-factory-planner/issues/92)

## Context

The production graph (`client/src/containers/ProductionPlanner/PlannerResults/ProductionGraphTab/index.tsx`)
renders the solved production chain with `react-cytoscapejs`, which paints to a
`<canvas>`. A canvas is a single opaque element to assistive tech: the nodes carry
text labels and the stylesheet distinguishes item nodes (ellipse) from recipe nodes
(round-rectangle), but those labels and shapes are **rasterized pixels** — invisible
to screen readers and not in the accessibility tree. The graph is therefore excluded
from the automated a11y scans (`.exclude('canvas')` in `client/tests/a11y.spec.ts`),
so the gap is real but untracked by tooling.

Concrete problems:

- **No semantic structure.** Nodes/edges have no roles, accessible names, or
  descriptions; a screen reader sees an empty canvas.
- **Mouse/touch-only interaction.** The hover tooltip fires on `mouseover`/`mouseout`
  (`index.tsx:448,455`), the context menu on `cxttap` (right-click, `:462`), and
  selection/drag on `select`/`grab`/`free` mouse events. There is no `tabIndex`, no
  `keydown` handling, and no focus management anywhere in the canvas.
- **Colour-coded sub-types.** Among item nodes, the five sub-types (resource, input,
  hand-gathered, side-product, final-product) share the ellipse shape and are
  differentiated by `background-color` alone (`:164-200`). Side products do get a
  `Side Product:` label prefix; the others rely on colour. This matters for any
  non-canvas rendering that reuses the encoding, and for colour-blind users reading
  the canvas itself.

What already exists that helps:

- The **Report tab** (`PlannerResults/ReportTab`) computes and renders, from
  `solverResults.report`, the produced-item steps with rates, buildings used with
  per-building material costs, power, and resource scores — accessible DOM, no canvas.
- The **graph** is driven by `solverResults.productionGraph` (`nodes` keyed by id +
  `edges` with `productionRate`). The Report tab does **not** currently surface the
  edge/flow data (which recipe feeds which, at what rate) — that is the part unique to
  the graph and the part an equivalent must add.

## Decision

Provide an **accessible, DOM-based text equivalent of the production graph** rather
than trying to make the canvas itself navigable. Specifically:

1. **Primary — accessible flow table.** Render a non-canvas equivalent of the graph
   from `productionGraph` (nodes + edges), exposing each production step: the recipe,
   its building and count, its inputs (item + rate, and the source node), and its
   outputs (item + rate, and the consuming node). This is the screen-reader and keyboard
   path to the plan's *structure and flow*, which today only the canvas shows. It lives
   in the DOM with real `<table>`/heading semantics, so it is reachable by Tab and
   announced by a screen reader.

   As decided for implementation:
   - **Location:** a new **visible** `Flow` tab in `PlannerResults`, beside Production
     Graph and Factory Report — not a visually-hidden region. A visible surface stays
     maintained (hidden equivalents silently drift out of sync) and also helps
     keyboard-only and low-vision sighted users, not only screen-reader users.
   - **Shape:** a **per-recipe table**. One row per recipe node; columns for the recipe,
     its building × count, its inputs (item + rate + source node), and its outputs
     (item + rate + consuming node).
   - **Data:** a fresh `buildFlowModel(productionGraph, gameData)` view-model derived
     directly from `productionGraph.nodes` + `edges`. The Factory Report tab is left
     untouched (no shared-derivation refactor for now).

2. **Secondary — live-region announcements.** Announce graph-state changes (recompute
   completed, selection changed) via an ARIA live region, so non-visual users get
   feedback equivalent to the visual graph redraw/highlight.

3. **Do not differentiate by colour alone.** Wherever node type is conveyed in the
   accessible equivalent, carry it as text (and/or shape/icon with a text label), never
   colour only.

4. **Explicitly defer in-canvas keyboard navigation.** We will *not* build focusable,
   keyboard-traversable nodes inside the Cytoscape canvas, nor accessible
   reimplementations of the hover tooltip and right-click context menu *on the canvas*.
   Their information (node details, the context-menu actions) must instead be reachable
   through the DOM equivalent.

Record any remaining as-built specifics (exact columns, wiring of the live region) when
implemented.

## Consequences

- Screen-reader and keyboard users can obtain the plan's structure, the per-step
  recipes/buildings/rates, **and the item flow between steps** without the canvas —
  satisfying the issue's acceptance criterion.
- The canvas remains a sighted-user convenience, not the sole source of truth. It can
  stay excluded from axe *as a canvas*, but once the equivalent ships we **remove the
  blanket `.exclude('canvas')`** in favour of positive assertions on the new accessible
  region (and, if needed, a narrower exclusion of just the canvas element).
- Some logic overlaps the Report tab (steps, buildings, rates). We accept a degree of
  duplication, or refactor the shared derivation, rather than overloading the Report tab
  with flow data it wasn't designed for — to be decided at implementation.
- The colour-only sub-type encoding on the canvas is **not** fixed by this decision for
  sighted colour-blind users reading the canvas; that is a separate, smaller follow-up
  (add shape/pattern/label distinctions in the stylesheet) and is noted but out of scope
  here.

## Alternatives considered

- **Keyboard-navigable canvas nodes + accessible tooltip/context-menu.** Make each
  Cytoscape node focusable, handle arrow/Tab traversal, and rebuild the tooltip and
  context menu as accessible popovers driven by focus. Rejected as the primary: high
  effort, fragile against the canvas/Cytoscape internals, and it still leaves the
  *overall structure* hard to perceive non-visually. The DOM equivalent delivers more
  of the value for far less risk. Kept as a possible later enhancement.

- **Reuse the Report tab as-is and call it the equivalent.** Rejected: the Report tab
  omits the edge/flow data that is the graph's whole point, so it is not a faithful
  equivalent on its own.

- **SVG render with inline a11y semantics instead of canvas.** Swap the canvas renderer
  for an SVG one and annotate nodes/edges with roles and names. Rejected for now: a
  large rendering-stack change for the graph, with its own a11y pitfalls (focus order in
  a force-directed layout), when a parallel text equivalent solves the stated problem.

- **Static image with alt text.** Rejected: cannot convey a multi-step variable plan in
  a meaningful `alt` string.
