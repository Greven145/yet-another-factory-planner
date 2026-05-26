# Exploratory Testing — Bug Report

**Date**: May 2, 2026  
**App version**: 1.1 (Current)  
**Environment**: Local Aspire stack — client at `http://localhost:54771`, API at `http://localhost:8000`

---

## Bug 1 — API returns `400 Bad Request` instead of `404 Not Found` for missing factory key

**File**: `api.web/Program.cs` ~line 91

**Steps to reproduce**:
1. Navigate to `http://localhost:54771/?factory=aaaaaaaaaaaaaaaa` (valid format, non-existent key)
2. Observe the HTTP response from `GET /initialize?factoryKey=aaaaaaaaaaaaaaaa`

**Actual result**: API returns `400 Bad Request` with body `{"message":"Invalid factory id"}`

**Expected result**: API should return `404 Not Found` — the request is well-formed, the resource simply does not exist.

---

## Bug 2 — Blank, unrecoverable error screen when API returns an error on load

**Steps to reproduce**:
1. Navigate to `http://localhost:54771/?factory=INVALID_KEY_123`
2. Observe the page

**Actual result**: The entire page renders as a blank black screen with the message "An error occured connecting to the server x_x". There is no "Go back", "Retry", or "Start fresh" button — the user is completely stranded.

**Expected result**: The error screen should include a recovery action (e.g., a "Start a new factory" button that navigates to `/`).

---

## Bug 3 — Typo in server error message

**Steps to reproduce**:
1. Navigate to `http://localhost:54771/?factory=INVALID_KEY_123`
2. Read the error message displayed on screen

**Actual result**: "An error **occured** connecting to the server x_x"

**Expected result**: "An error **occurred** connecting to the server x_x"

---

## Bug 4 — "Link copied!" tooltip never auto-dismisses

**Steps to reproduce**:
1. Open the control panel and configure any production item
2. Click "Save & Share"
3. Observe the "Link copied!" tooltip that appears near the share URL field
4. Switch between tabs (Production, Inputs, Recipes), make changes, wait several minutes

**Actual result**: The "Link copied!" tooltip remains visible indefinitely throughout the entire session. It never auto-dismisses.

**Expected result**: The tooltip should auto-dismiss after 2–3 seconds.

---

## Bug 5 — "Reset ALL Factory Options" destroys all data with no confirmation

**Steps to reproduce**:
1. Configure a factory (add items, adjust recipes, set resource limits)
2. Click the red "Reset ALL Factory Options" button at the bottom of the control panel

**Actual result**: All factory settings are immediately and permanently cleared with no confirmation dialog.

**Expected result**: A confirmation dialog should appear (e.g., "Are you sure? This will clear all production goals, inputs, and recipe settings.") before the reset is applied.

---

## Bug 6 — "Save & Share" creates a new CosmosDB entry on every click (no deduplication)

**Steps to reproduce**:
1. Configure a factory
2. Click "Save & Share" — note the factory key in the URL (e.g., `?factory=033e789496154cf0`)
3. Click "Save & Share" again without changing anything
4. Note the new factory key (e.g., `?factory=56a4c98e24304862`)

**Actual result**: Every click of "Save & Share" issues a new `POST /share-factory` and returns a new unique key. The same factory configuration is saved to CosmosDB multiple times.

**Expected result**: Clicking "Save & Share" on an already-shared factory (where nothing has changed) should either reuse the existing key, or at minimum require a configuration change before a new share link is created.

---

## Bug 7 — Graph component remounts on every recalculation (react-flow wheel sensitivity warning)

**Steps to reproduce**:
1. Open the browser console
2. Configure any production item and observe the graph render
3. Make a change (e.g., toggle a recipe, adjust an amount)
4. Repeat step 3 several times

**Actual result**: The console warning `"You have set a custom wheel sensitivity..."` (from react-flow) fires once per recalculation. After several interactions it had fired 6 times in a single session. This warning only fires on component mount, indicating the entire graph is being unmounted and remounted on each recalculation cycle rather than re-rendered.

**Expected result**: The react-flow graph component should be mounted once and updated via props/state changes on recalculation. The wheel sensitivity warning should appear at most once per page load.

---

## Bug 8 — Item search field appends text instead of replacing selected value

**Steps to reproduce**:
1. Add a production item and select "Iron Ingot"
2. Click the Item field again (which now displays "Iron Ingot")
3. Type "Computer"

**Actual result**: The field displays "Iron IngotComputer" — the new text is appended to the existing value.

**Expected result**: Clicking an already-populated item field should select all existing text so that typing immediately replaces it. Alternatively, the field should clear on focus when it has a committed value.

---

## ✅ RESOLVED — Stale FICSIT tip text

**Location**: Home screen tip at the bottom of the welcome section

**Previous text**: "FICSIT Tip #2: Update 6 now available!"

**Resolution**: Updated the TIPS array with fresh, fun Satisfactory-themed taglines including:
- 'Conveyor belts go brrr!'
- 'Spaghetti is a valid strategy.'
- 'Overclocking intensifies...'
- 'ONE. MORE. EXPANSION.'
- 'Space Elevator go whoosh!'
- And 5 more fun tips!

**Date Fixed**: May 4, 2026

---

## Items Verified as Working Correctly

- Zero production amount → shows "ERROR: NO OUTPUTS SET" ✓
- Zero raw resources ("Set All To 0") → shows "ERROR: NO SOLUTION" with helpful explanatory text ✓
- Enabling alternate recipes → solver correctly picks optimal alternate paths ✓
- Save & Share round-trip → shared factory loads correctly from a valid key ✓
- Factory Report "No data available" state → shown appropriately when no solution exists ✓
- "Set All To Maximum" / "Set All To 0" resource controls → function correctly ✓
- "Reset All Weights" button in Weighting Options → available and functional ✓
