I will start by checking the existing design specifications to ensure consistency with any established patterns.

I will read the content of the existing `board-spec.md` file to see what's already there.

I'll check `src/app/globals.css` to understand the existing dark mode setup and design tokens before I finalize the design specification.

### 1) Layout Map

**Desktop (3-column)**
- **Left (Boards Sidebar):** 260px fixed width. Collapsible navigation for workspace hierarchy, favorited boards, and recent "Cases."
- **Center (Infinite Canvas):** Flexible primary area. A `dnd-kit` powered freeform viewport with a subtle dotted grid background. Floating toolbar at the bottom center.
- **Right (AI Context Panel):** 340px fixed width. Divided into "Strategic Summary" (top) and "AI Actions" (bottom). Toggleable via `[Ctrl + \]`.

**Mobile (Stacked)**
- **Primary View:** The Canvas occupies 100% of the viewport.
- **Navigation:** Bottom navigation bar to switch between "Boards," "Canvas," and "AI Summary."
- **Overlays:** Sidebar and AI Panel become full-screen `Drawer` components.

### 2) Component Inventory

**shadcn/ui (Modified)**
- `Sidebar`: Custom dark-glass variant for board navigation.
- `Card`: The `BaseCard` for the canvas with `oklch` border highlights.
- `Badge`: Used for the Taxonomy labels (Thought, Evidence, etc.).
- `Tooltip`: For all icon-only AI actions.
- `ScrollArea`: Custom implementation for the infinite canvas viewport.
- `Separator`: Subtle vertical lines using `border-white/5`.

**Custom Components**
- `InfiniteCanvas`: Root viewport handling panning and zooming.
- `DraggableCard`: Wrapper for `dnd-kit` integration with high-performance transforms.
- `TaxonomyBadge`: Color-coded indicators (e.g., Risk = Crimson, Evidence = Emerald).
- `ActionGlowButton`: AI buttons with a pulsing `oklch` outer glow during "processing" states.
- `ConnectionLayer`: SVG overlay for rendering relationships between cards.

### 3) Canvas Interaction Model

- **Drag & Drop:** Cards use `dnd-kit/sortable` (for lists) or `dnd-kit/core` (for freeform). Positions are persisted as `x, y` coordinates in the DB.
- **Add Card:** 
  - Double-click anywhere on the empty canvas to spawn a `Thought` card.
  - Floating `+` button in the toolbar with a quick-select menu for taxonomy.
- **Tag Rendering:** Top-left corner of each card features a small, high-contrast icon + text badge corresponding to its taxonomy type.
- **Empty State:** A centered, low-opacity "Core Question" card placeholder with a subtle cinematic pulse to invite the first interaction.

### 4) Summary Panel Structure

- **Header:** "Board Intelligence" with a "Re-sync" animation icon.
- **Executive Summary:** A scrollable markdown area containing AI-generated synthesis of the current board state.
- **Insights List:**
  - **Conflicts:** Red-tinted items showing contradicting `Evidence` and `Assumptions`.
  - **Gaps:** Suggestions for what's missing (e.g., "Needs Experiment").
- **Action Grid:** Large, tactile buttons for:
  - `Organize`: Auto-clusters cards by taxonomy or topic.
  - `Challenge`: Generates `Question` cards targeting current `Assumptions`.
  - `Compress`: Merges duplicate `Thoughts` into a single `Conclusion`.

### 5) Design Tokens (Board-Specific)

- `--canvas-bg`: `oklch(0.12 0 0)` (Deep obsidian).
- `--grid-dots`: `oklch(1 0 0 / 0.05)`.
- `--card-surface`: `oklch(0.18 0 0 / 0.8)` with `backdrop-blur-md`.
- `--ai-primary`: `oklch(0.7 0.12 250)` (Cinematic Blue).
- `--taxonomy-risk`: `oklch(0.62 0.17 28)`.
- `--taxonomy-evidence`: `oklch(0.72 0.15 150)`.
- `--focus-ring`: `oklch(0.7 0.12 250 / 0.5)`.

### 6) Interaction States

- **Card Hover:** Border brightness increases by 10%; subtle `y-axis` lift.
- **Card Active (Dragging):** Scale down to `0.98`, opacity to `0.85`, and drop-shadow expansion.
- **AI Processing:** A thin, scanning light line moves top-to-bottom across the Right Panel.
- **Multi-select:** Drag-to-select marquee (blue tinted) highlights cards with a thick `oklch` border.

### 7) Responsive Rules

- **Tablet (L):** AI Panel collapses into a right-side drawer.
- **Tablet (S):** Sidebar collapses into a hamburger menu.
- **Mobile:** Pinch-to-zoom enabled on Canvas; cards snap to a simplified 1-column grid if "View Mode" is toggled from "Canvas Mode."

### 8) Accessibility Checklist

- [ ] **Keyboard Nav:** `Tab` cycles through cards; `Arrow Keys` move selected card by 8px (or 40px with `Shift`).
- [ ] **Aria-Live:** Summary panel updates are announced to screen readers.
- [ ] **Contrast:** All taxonomy colors verified for `4.5:1` ratio against card surface.
- [ ] **Focus Trap:** Modal drawers for Boards/AI Summary on mobile correctly trap focus.
- [ ] **Reduced Motion:** Disable card lift/glow animations if `prefers-reduced-motion` is active.
