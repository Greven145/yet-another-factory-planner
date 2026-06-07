# Plan: Balance mode toggle for equal-priority maximize items

## What we're building

A switch in the Production Goals section of the control panel that toggles between:

- **Proportional** *(current behavior)* — each item runs at the same fraction of its individual maximum. E.g. if rods max at 100 and screws at 480, both run at 50% → 50 rods, 240 screws.
- **Equal output** *(new)* — all items run at the same absolute rate, capped by the hardest to produce. E.g. both run at 20/min → 20 rods, 20 screws.

The switch only needs to be visible when two or more production items are set to Maximize Output.

---

## Step 1 — Add the type and constant

**`client/src/contexts/production/consts.ts`**
- Add `export type MaximizeBalanceMode = 'proportional' | 'equal';`
- Add `export const DEFAULT_MAXIMIZE_BALANCE_MODE: MaximizeBalanceMode = 'proportional';`

---

## Step 2 — Add the field to `FactoryOptions`

**`client/src/contexts/production/types.ts`**
- Add `maximizeBalanceMode: MaximizeBalanceMode` to the `FactoryOptions` type

---

## Step 3 — Wire it into the reducer/state

**`client/src/contexts/production/reducer.tsx`**
- Add `maximizeBalanceMode: DEFAULT_MAXIMIZE_BALANCE_MODE` to `getInitialState()`
- Add a `SET_MAXIMIZE_BALANCE_MODE` action that sets `state.options.maximizeBalanceMode`
- Expose a `setMaximizeBalanceMode` dispatcher from `ProductionProvider` (following the existing pattern for other dispatchers)

---

## Step 4 — Solver uses the mode

**`client/src/utilities/production-solver/index.ts`**
- The constructor already receives `FactoryOptions`, so store `this.maximizeBalanceMode = options.maximizeBalanceMode`
- In `exec()`, for the multi-item group path, after finding individual maxima:
  - **Proportional**: pass `maxima` as-is (current behavior)
  - **Equal**: pass a version of `maxima` where every producible item's value is replaced with `1` — this turns the proportionality constraint into a strict equality constraint with no math required, since `1 * net_prod_A = 1 * net_prod_B` → `net_prod_A = net_prod_B`

No changes needed to `productionSolverPass` itself — the constraint logic already handles this correctly.

---

## Step 5 — Add the toggle to the UI

**`client/src/containers/ProductionPlanner/PlannerOptions/ProductionTab/index.tsx`**
- Below the "Production Goals" title/description and above the item rows, conditionally render a toggle (e.g. a two-option segmented control or a `Switch`) when `productionItems.filter(i => i.mode === 'maximize').length >= 2`
- Label: **"Balance mode"** with options **"Proportional"** and **"Equal output"**
- On change: call `setMaximizeBalanceMode`

---

## Step 6 — Handle share/load (serialization)

**`client/src/contexts/production/reducer.tsx`** (wherever the factory URL is decoded)
- `maximizeBalanceMode` needs to be included when saving factory state to the share URL and restored when loading — check what the existing serialization mechanism looks like and include the new field with a sensible default for old URLs that don't have it.

---

## Order of work

Steps 1→2→3→4 can be done in sequence (each builds on the previous), then Steps 5 and 6 in parallel. Step 4 is the only solver change and is a one-liner substitution in `exec()`.
