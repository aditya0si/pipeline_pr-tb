# PLAN — UI Overhaul: Buttons, OCR Text, Analysis Panels, Feature-Packed Additions

---

## SECTION A — GOAL DEFINITION

### 1. What is being built or changed?
A comprehensive visual and functional upgrade to the MedVault React frontend. No backend logic changes. The work spans:
- Global design tokens / CSS (buttons, cards, typography, colour ramp)
- OCR result display: structured, human-readable output with confidence heat-mapping and side-by-side diff view
- Analysis panels: the `PipelineAccordion` in `DoctorPortal.tsx` and `LabInterpretation.tsx` get dedicated, scannable layouts for each diagnosis stage (A–D)
- New features: Diagnosis Timeline, Lab Sparkline Dashboard, Confidence Inspector, OCR Diff mode, Differential Diagnosis Cards, Quick-Action Command Palette

### 2. What does "done" look like?
- All buttons have consistent, purposeful styles with hover animations and clear visual hierarchy (primary / secondary / ghost / danger / success)
- OCR text panel shows colour-coded confidence tokens, a structured table view (for tabular OCR), a raw-text/table toggle, and a "copy JSON" export
- The analysis accordion shows Stage A–D results in cards: pattern chips, MELD/Child-Pugh/FIB-4 score gauges, differential probability bars, Stage C clinical brief in pill-badge format, Stage D report in a collapsible physician summary
- Three new standalone feature panels are added: (a) Diagnosis Timeline, (b) Lab Trend Dashboard mini-charts, (c) Quick-Action Command Palette (Ctrl+K)
- Dark mode is fully polished across every new component

### 3. Explicitly out of scope
- No backend changes
- No new API endpoints (all data driven from existing `PipelineResult` shape)
- No changes to routing in `App.tsx` (except registering the Command Palette overlay)
- No changes to OCRWorkbench pipeline configuration tab (already functional)

---

## SECTION B — TECH STACK

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 + TypeScript (existing) | In-place, no migration |
| Styling | Vanilla CSS in `styles.css` (existing) | User rule: no Tailwind |
| Charts | Inline SVG sparklines (existing pattern) | Zero deps added |
| Icons | Inline SVG (existing `Icon` map pattern) | Zero deps |
| Fonts | Google Inter (already loaded) | Consistent |
| Animation | CSS keyframes + `transition` | No library needed |

**Files touched:**
- `frontend/src/styles.css` — design token additions, new component classes
- `frontend/src/pages/DoctorPortal.tsx` — `PipelineAccordion`, new Diagnosis cards, Command Palette trigger
- `frontend/src/pages/LabInterpretation.tsx` — Diagnosis Timeline, Trend Dashboard
- `frontend/src/pages/OCRWorkbench.tsx` — OCR confidence panel rewrite
- `frontend/src/App.tsx` — Register `CommandPalette` overlay, keyboard listener

**New files:**
- `frontend/src/components/CommandPalette.tsx` — Ctrl+K quick-action palette
- `frontend/src/components/DiagnosisCard.tsx` — Reusable Stage A–D card set
- `frontend/src/components/ConfidenceBar.tsx` — Animated probability bar for differentials

---

## SECTION C — SESSION MODULARIZATION

---

### Session 1: Design System Refresh (CSS)
**OBJECTIVE:** Upgrade the global CSS to add richer button variants, card hover states, and component-level classes for all new features. No React changes.

**SCOPE:** `styles.css` only

**Changes:**
- Add `--accent-2` (teal `#0d9488`), `--accent-danger` (red gradient), `--accent-success` (green gradient) tokens
- Add `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-success`, `.btn-icon` with micro-animations (lift on hover, ripple on click via `::after` pseudo-element)
- Add `.score-gauge` — circular SVG-based gauge for MELD/FIB-4 display (CSS-only)
- Add `.confidence-token` — inline span with gradient background keyed to confidence %
- Add `.diff-bar` — animated horizontal probability bar for differentials
- Add `.stage-card` — gradient-bordered card for each pipeline stage (A/B/C/D)
- Add `.cmd-palette-overlay`, `.cmd-palette-box`, `.cmd-item` for Command Palette
- Add `.timeline-line`, `.timeline-node`, `.timeline-entry` for Diagnosis Timeline
- Add `.ocr-token` colour classes: `high`, `med`, `low` mapped to green/amber/red
- Polish dark-mode variables for every new class

**OUTPUT:** Fully updated `styles.css` with ~200 new lines.

**CONNECTS TO:** Session 2 uses `.btn-*`, `.stage-card`, `.confidence-token` etc.

**FAILURE SURFACE:** CSS variable naming collisions with existing classes; test both light and dark mode.

---

### Session 2: OCR Panel Rewrite
**OBJECTIVE:** Replace the bare `<pre>` OCR text dump with a rich, interactive confidence-tokenised display.

**SCOPE:** `OCRWorkbench.tsx` (Results tab), `DoctorPortal.tsx` (`PipelineAccordion` left column)

**What changes:**

#### OCR Workbench — Results Tab
- **Toggle bar:** "Token View" / "Raw" / "Table" — three-way toggle instead of a single pre block
- **Token View:** Each word rendered as `<span class="ocr-token high|med|low">word</span>` with a tooltip showing `confidence%` on hover. Words are reflowed naturally (not positioned absolutely).
- **Table View:** If `raw_output` is `string[][]`, render a styled `<table>` with alternating row shading and sticky header.
- **Raw View:** The existing `<pre>` block, unchanged.
- **Confidence legend:** Updated to use the new `.ocr-token` classes instead of inline styles.
- **Character count + word count** displayed in a small stat strip above the panel.

#### DoctorPortal — PipelineAccordion Left Column
- Same three-way toggle
- Add **"Find in OCR"** mini search bar (filters visible tokens)
- Replace Copy button style with new `.btn-ghost` class
- Show **OCR Confidence Score** as a single averaged percentage badge at the top

**OUTPUT:** Both OCR text panels are tokenised, interactive, and scannable.

**FAILURE SURFACE:** `raw_output` can be `string`, `string[][]`, or `null` — all three branches must be handled gracefully.

---

### Session 3: Analysis Panel Upgrade
**OBJECTIVE:** Replace the flat summary text + badge-row with per-stage structured cards.

**SCOPE:** `DoctorPortal.tsx` — `PipelineAccordion` component right column

**New layout — four Stage Cards:**

#### Stage A — Pattern Analysis Card
- Grid of pattern chips: `Hepatocellular`, `Cholestatic`, `Mixed`, `Synthetic Dysfunction` etc.
- De Ritis Ratio badge + R-Factor badge
- Urgent lab alerts as pulsing red chips

#### Stage B — Differentials Card
- Each differential: animated `.diff-bar` + probability % + `HIGH/MODERATE/LOW` pill
- Urgent conditions pinned to top with 🚨 icon
- Supporting vs Against evidence in collapsible `<details>`

#### Stage C — AI Clinical Brief Card
- `flags_to_discuss` → orange pill chips
- `tests_to_order` → blue pill chips
- `urgent_actions` → red alert chips with 🚨
- `disclaimer` → muted italic text at the bottom

#### Stage D — Scores Card
- Three circular SVG gauge widgets (animated stroke-dashoffset)
- MELD score + "~X% 90-day mortality" sub-label
- Child-Pugh class (A/B/C) + points
- FIB-4 index + risk label

**FAILURE SURFACE:** `result.diagnosis` may be `null` — each card must gracefully show a "no data" placeholder.

---

### Session 4: New Features
**OBJECTIVE:** Add three net-new features.

#### Feature 1 — Quick-Action Command Palette (`CommandPalette.tsx`)
- Triggered by `Ctrl+K` / `Cmd+K`
- Floating modal overlay with `backdrop-filter: blur`
- Fuzzy-searchable list of all navigation destinations
- Keyboard navigation (arrow keys + Enter)
- Registered in `App.tsx` via `useEffect` keydown listener

#### Feature 2 — Diagnosis Timeline (`LabInterpretation.tsx`)
- New "Timeline" tab
- Vertical timeline of analysis events with pulse animation on latest node
- Clickable nodes with detail tooltip

#### Feature 3 — Lab Trend Mini-Dashboard (`LabInterpretation.tsx`)
- New "Trends" tab
- Full-width grid of sparkline cards with delta from first reading
- "Show abnormal only" toggle
- "Export as CSV" download button

---

### Session 5: Polish, Dark Mode, and Verification
**OBJECTIVE:** Systematic pass to verify every new component in light and dark mode.

**Tasks:**
- Verify all `.btn-*`, `.stage-card`, `.diff-bar`, `.score-gauge`, `.ocr-token` in dark mode
- Verify Command Palette backdrop contrast
- Smoke test: upload lab report → run pipeline → all 4 stage cards render
- Verify `Ctrl+K` functional in all views
- No console errors

---

## SECTION D — PROGRESS CHECKLIST

- [ ] Session 1: Design System Refresh
  - [ ] New button variant classes (primary, secondary, ghost, danger, success, icon)
  - [ ] Micro-animation hover/lift + click ripple on `.btn-*`
  - [ ] `.score-gauge`, `.diff-bar`, `.stage-card`, `.confidence-token` added
  - [ ] `.cmd-palette-overlay`, `.timeline-*`, `.ocr-token` added
  - [ ] Dark mode variables for all new classes

- [ ] Session 2: OCR Panel Rewrite
  - [ ] Three-way toggle (Token / Raw / Table) in OCRWorkbench
  - [ ] Confidence-colour token spans with hover tooltip
  - [ ] "Find in OCR" mini search bar in DoctorPortal
  - [ ] Average confidence badge at top of OCR panel
  - [ ] All 3 `raw_output` types handled (string / string[][] / null)

- [ ] Session 3: Analysis Panel Upgrade
  - [ ] Stage A card — pattern chips, De Ritis, R-Factor, urgent alerts
  - [ ] Stage B card — differential probability bars, supporting/against evidence
  - [ ] Stage C card — flags, tests, patterns, urgent actions in pill badges
  - [ ] Stage D card — MELD/Child-Pugh/FIB-4 gauge widgets
  - [ ] Null/disabled state placeholder when `result.diagnosis` is absent

- [ ] Session 4: New Features
  - [ ] `CommandPalette.tsx` created with Ctrl+K trigger and fuzzy search
  - [ ] Keyboard listener cleaned up on unmount
  - [ ] Diagnosis Timeline tab in LabInterpretation
  - [ ] Lab Trend Dashboard tab with delta + Export CSV

- [ ] Session 5: Polish & Verification
  - [ ] All new components verified in dark mode
  - [ ] Smoke test: pipeline run → all 4 stage cards render
  - [ ] Ctrl+K palette functional in all views
  - [ ] No console errors

---

## Bonus Ideas (Suggest to User After Sessions 1–5)

| Idea | Description | Complexity |
|---|---|---|
| **Confidence Heatmap Overlay** | SVG canvas overlay on original document image showing bounding boxes coloured by confidence | Medium |
| **Sticky Abnormal Indicator** | Floating pulsing badge in bottom corner if current report has CRITICAL labs | Low |
| **PDF Physician Report** | "Download Report" button assembling a print-ready PDF via `@media print` CSS sheet | Low |
| **Patient Risk Score Widget** | Computed risk tier (Low/Moderate/High) from MELD + flags shown on patient list cards | Medium |
| **BioMistral Streaming** | Show AI narrative generating word-by-word with a cursor animation | High |
| **Side-by-side OCR Diff** | Split pane — original image left, extracted text right, sync-scrolled | High |
| **Keyboard Cheat Sheet** | `?` key shows modal listing all shortcuts | Low |
