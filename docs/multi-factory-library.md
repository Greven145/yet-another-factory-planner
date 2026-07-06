# Multi-Factory Library (design)

- Status: Proposed
- Date: 2026-06-26

## Problem

Factory configuration is lost when the browser is closed. The active factory lives
in the `production` reducer and is persisted only to **`sessionStorage`**
(`client/src/contexts/production/index.tsx`, keys `state` + `game-version`).
`sessionStorage` survives a refresh within a tab but is wiped on tab/browser close —
hence the lost work. There is also no concept of keeping **multiple** designs around or
switching between them.

## Goal

A named library of factories persisted in `localStorage`, with a switcher/manager in the
UI, such that no work is ever silently lost and multiple designs coexist.

## Decisions

### Core model — autosave, no Save button

- A library of factories stored in `localStorage`. Every edit **autosaves** to the active
  factory's slot. Eliminating "lost my work" is the whole point, so there is no explicit
  Save button.
- Per-factory shape:
  `{ id, nickname?, gameVersion, config: FactoryOptions, sourceKey?, createdAt, updatedAt }`.

### Identity — derived, not typed

- A switcher entry shows an **auto-label derived from production outputs**
  (e.g. "Reinforced Iron Plate ×30, Rotor ×10", from `state.productionItems` joined with
  `gameData.items[].name`), a **"last edited"** line (`updatedAt`), and an **optional
  nickname** that overrides the auto-label. Empty factory → "Empty factory".
- No forced naming. Naming is opt-in polish for the few factories worth labelling.
- Item **icons/thumbnails were rejected** for v1: the client renders items as text names
  and ships no item art, so an icon/graph-thumbnail identity is disproportionately more
  work. Revisit as a possible v2.

### Multi-tab — reuse the existing storage split

- `localStorage` = the **shared library** (the data).
- `sessionStorage` = **this tab's active factory id** (the pointer).
- Two tabs can edit two different factories independently. The same factory open in two
  tabs is **last-write-wins** (rare, accepted).

### Fresh-tab / first-load resolution order

For a tab with no active pointer yet:

1. `?factory=` / `?f=` URL → **import as a new library slot**, make active, strip the URL,
   autosave onward. Re-opening the same link creates a **duplicate** (no dedupe by
   `sourceKey` in v1 — accepted for simplicity).
2. Library non-empty → open the factory with **max(`updatedAt`)**.
3. Library empty → create **"Untitled Factory 1"**.

Migration: on first load after shipping, adopt any existing `sessionStorage` `state` as
the first library factory so current users don't lose in-progress work.

### Control Panel header redesign

- **Remove the Calculate button and the Auto-calculate toggle entirely.** Performance is
  good enough to always auto-solve. Concretely: drop the `auto-calculate` `sessionStorage`
  key; the solve effect (`production/index.tsx`) always runs on state change; keep the
  internal `calculate()` for the forced initial solve.
- The redesigned header hosts: the **factory switcher + "New"**, **Share** (relabeled from
  "Save & Share" — saving is now automatic; the button only POSTs to get a shareable key),
  and factory actions (**Rename, Duplicate, Delete, Reset-to-empty**).
- The **exact visual layout is deferred to a prototyping phase.**

### Durability

- `localStorage` + **Export / Import the library as JSON** (manual backup, and to move
  between browsers/devices). Per-factory share links remain the server-side copy.
- **Server-sync keyed by `engineerId`** (the app already has an `engineerId` in
  `localStorage` and a Cosmos-backed API) is **deferred** as a separate, larger project:
  new endpoints, Cosmos schema, conflict handling, and `engineerId` becoming a losable
  identity.

### Safety net

- **Duplicate** ("clone before you experiment") is the primary answer to autosave
  overwrite fear.
- **Delete** = confirm dialog + a brief "Deleted — Undo" toast.
- **No version/undo history** in v1.

## Implementation notes (no decision required)

- Switching to a factory on a different `gameVersion` reuses the existing
  game-data reload path (`loadGameData(version)` — the static-bundle load, same
  mechanism as loading a shared factory or changing the version selector).
- `localStorage` quota: hundreds of factories fit comfortably; on `QuotaExceededError`,
  surface a toast ("storage full — delete some factories or export the library").

## Open items

- The concrete Control Panel header visual layout (settle during prototyping).

## Alternatives considered

- **Explicit Save + dirty working copy** (document-editor model). Rejected: reintroduces a
  way to lose work and adds an "unsaved changes" concept; autosave is a better fit for the
  stated pain.
- **Icon / graph-thumbnail identity.** Rejected for v1 (no item art shipped; thumbnailing
  the graph is its own project).
- **Ephemeral share-link loading with "Add to library".** Rejected: editing then
  refreshing without adding would lose work — the original problem.
- **Global active-factory pointer in `localStorage`.** Rejected: tabs fight over the active
  factory and autosaves clobber each other.
- **Server-sync to `engineerId`.** Deferred (see Durability) — much larger scope than a
  local-storage feature.
