# TODO

## Feature Enhancements

### Initiative Bar UX Improvements

- [x] **US-IE-01: Selection highlight** — Replace invisible white ring with a 2px dashed high-contrast border when an initiative is selected; must be visually distinct from the conflict solid border
  - AC1: Single-click shows a 2px dashed `#1e293b` (slate-800) border on the bar
  - AC2: Clicking elsewhere removes the border
  - AC3: Border style is visually distinct from the solid conflict-detection border

- [x] **US-IE-02: Floating action toolbar** — Show Edit and Link icon buttons in a strip above the selected bar on single-click; replaces the invisible white corner pencil button
  - AC1: Single-click reveals a floating strip above the bar with Edit (pencil) and Link (chain) icons
  - AC2: Edit icon opens InitiativePanel (same as current double-click)
  - AC3: Link icon initiates the drag-to-relate flow
  - AC4: Strip disappears when clicking elsewhere or pressing Escape

- [x] **US-IE-03: Relationship drag discoverability** — Replace orange circle drag handle with a chain-link icon and add a descriptive tooltip
  - AC1: Drag handle uses a chain/link icon
  - AC2: Hovering shows tooltip: "Drag to another initiative to create a dependency"
  - AC3: Handle only visible when bar is selected (not always-on)

- [x] **US-IE-04: Bar content layout** — Restructure initiative bar to give description its own full-width row; move budget to title row; pin owner avatar to corner
  - AC1: Budget label renders as a small pill right-aligned on the title row
  - AC2: Description occupies a full-width row (not shared with budget or owner)
  - AC3: Owner avatar is absolutely positioned in the top-right corner, not inline
  - AC4: Description is capped at 2 lines with ellipsis (`line-clamp-2`)

- [x] Rename "Colour by Status" to "Colour by Progress"
- [x] Add new "Colour by Status" — RAG traffic light (Green / Amber / Red) stored as a field on initiatives, with Colour by Status display mode
- [x] Add "Viewer mode" to templates modal — replaces Mixed template; triggers Excel import flow so users can upload and view a shared file; final four choices: Viewer, NZ Digital Target State, GEANZ Technology Catalogue, Blank

## E2E Test Suite Improvements

### Completed
- [x] Delete `capture-*.spec.ts` screenshot tests
- [x] Add form input validation tests
- [x] Add cascading delete state consistency tests

### Pending

#### P0 — Safety Net
- [x] Add dependency constraint validation tests
- [x] Add import error path tests
- [x] Add undo/redo edge case tests

#### P1 — Fragility
- [x] Replace CSS class assertions with computed style checks
- [x] Replace `waitForTimeout()` with deterministic waits

#### P2 — Organisation
- [x] Consolidate 15 dependency spec files into 3
- [x] Consolidate 17 mobile spec files into 2–3
- [x] Consolidate Data Manager spec files

## Refactoring

### Timeline.tsx — Unified Grouping and Colouring

The `groupBy` feature is currently implemented as four separate rendering branches in `Timeline.tsx`. Each branch independently filters initiatives, calls `layoutAsset()`, and renders initiative bars — meaning a fix or improvement made in one branch (e.g. `asset`) does not automatically apply to the others (`programme`, `strategy`, `dts-phase`, GEANZ). There are also four copies of the colour-selection logic.

The refactor below consolidates all groupBy modes into a single rendering path.

#### Step 1 — Extract `getInitiativeColor()` helper

- Extract the four-way ternary chain (duplicated at lines ~1630, ~1704, ~1910, ~2367) into a standalone function:
  ```ts
  getInitiativeColor(init: Initiative, colorBy: string, programmes: Programme[], strategies: Strategy[]): string
  ```
- Do the same for `getInitiativeSubtitle()` (duplicated at lines ~1637, ~1917).
- This eliminates 4× colour-logic duplication and makes future colour modes a one-line change.

#### Step 2 — Build programme/strategy lookup Maps

- Replace the `programmes.find(p => p.id === init.programmeId)` O(N×M) lookups inside every `.map()` callback with two `useMemo` Maps built once:
  ```ts
  const programmeMap = useMemo(() => new Map(programmes.map(p => [p.id, p])), [programmes]);
  const strategyMap  = useMemo(() => new Map(strategies.map(s => [s.id, s])), [strategies]);
  ```
- Update all four rendering branches to use the maps.

#### Step 3 — Normalise groupBy into a uniform `groups` array

- Add a `useMemo` that produces `GroupRow[]` regardless of `groupBy` mode:
  ```ts
  interface GroupRow {
    id: string;
    label: string;
    initiatives: Initiative[];
    // asset-mode extras:
    asset?: Asset;
    categoryId?: string;
  }
  ```
- For `programme` / `strategy` / `dts-phase`: each group maps directly to one `GroupRow`.
- For `asset`: each asset under each category becomes a `GroupRow` (preserving the existing category-header structure as a separate pass).
- The GEANZ catalogue rows become `GroupRow` entries with `isGeanz: true`.

#### Step 4 — Extract `<InitiativeSwimLane>` component

- Extract the per-group rendering (header + sidebar + bar loop) into a single component parameterised by:
  - `group: GroupRow`
  - `showMilestones?: boolean` (asset mode only)
  - `showConflicts?: boolean` (asset mode only)
  - `showApplications?: boolean` (asset mode only)
  - `showGroupBoxes?: boolean` (asset mode only)
  - `sidebarContent?: ReactNode` (asset mode has drag handles, DTS badges; swimlane modes show "N initiatives")
- The component calls `layoutAsset()` (or `getAssetLayout()` for drag stability) internally.
- The main JSX becomes a single `{groups.map(group => <InitiativeSwimLane ... />)}`.

#### Step 5 — Fix GEANZ initiative bars to use `<InitiativeBar>`

- The GEANZ branch (lines ~2376–2387) renders initiative bars as raw `<div>` elements, bypassing `<InitiativeBar>` entirely.
- Replace with `<InitiativeBar>` — the same component used in every other branch.
- This brings GEANZ bars into parity: resize handles, drag-to-relate, budget height, description display, critical path highlighting, and owner badges all start working for GEANZ initiatives automatically.

---

**Why this matters:** Any future fix to initiative bar rendering (e.g. a layout bug, a new display toggle, a new colour mode) currently needs to be applied in up to four places. After this refactor it is applied once.

## Bug Fixes

### Completed
- [x] Fix newly-created initiative showing "Create Initiative" title and no Delete button when re-opened (US-BUG-01)
- [x] Fix Data Manager initiatives table not scrollable with many rows (missing min-h-0)
- [x] Scenia review bug: mobile card view hides overlapping initiatives (PR #61)
- [x] Scenia review bug: viewer file input is not reset after selection (PR #62)
- [x] Scenia review bug: dependency rendering silently deduplicates/truncates records (PR #51)
- [x] Scenia review bug: arrow corridor click reliability / brittle selection test (PR #63)
- [x] Scenia review bug: shared link decryption message clarity (PR #64)
- [x] Scenia review bug: Playwright tests using hard-coded localhost URLs (PR #65)
- [x] Scenia review bug: timeline sidebar resize + persistence (PR #66)
- [x] Scenia review bug: DataManager deletes cascade application records and applicationSegments
- [x] Scenia review bug: save race in App.tsx no longer allows stale IndexedDB writes to win during rapid edits
- [x] Scenia review bug: empty-workspace detection is too narrow and can show the first-run picker incorrectly

### Remaining Scenia review bugs
- [ ] Import validation accepts structurally broken initiatives as warnings instead of errors
- [ ] Version diffing misses major categories of workspace changes
- [ ] Explicit timeline rows can still collide in layout
- [ ] Auto-row placement gives up after row 20
- [ ] Disambiguation popover can render off-screen on narrow viewports
- [ ] Clipboard copy failure still shows success
- [ ] Keyboard shortcuts modal reads navigator.userAgent at module scope

#### P2 — Coverage
- [x] Add search & filter edge case tests
