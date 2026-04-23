I will check the existing design specification file to see if there is any content to build upon.

I will list the files in the design specs directory to confirm the file's existence and check its size.

I will read the landing specification file to understand its current contents.

### 1) Layout Map
**Desktop**
- **Nav**: Top-fixed, glassmorphism (`backdrop-blur-md`). Minimal "Case" branding left, "Investigation", "Intel", "Archive" links center, "New Case" primary CTA right.
- **Hero**: High-contrast typography left, "The Board" interactive preview right (spatial cards connected by lines).
- **The Board (Feature 1)**: Full-width immersive section. Interactive canvas showing "Evidence Nodes" with connecting "Strings."
- **Tactile Evidence (Feature 2)**: Two-column grid. Left: Description of "The Dossier." Right: Staggered evidence cards (notes, images, links) with realistic textures.
- **Intelligence (Feature 3)**: Terminal-style overlay showing automated tagging and "Interrogation" (search) interface.
- **Evidence Locker (Social Proof)**: Monochromatic, low-opacity logotypes of partners/users in a subtle ticker.
- **Closing CTA**: Centered, cinematic gradient background. "Case Closed." heading. "Open Investigation" button.

**Mobile**
- **Nav**: Logo and minimalist "plus" icon (CTA). Hidden hamburger for links.
- **Hero**: Stacked. Vertical board preview with horizontal scroll for cards.
- **Features**: Single column. "Sticky" section headers that behave like filing cabinet tabs.
- **Interactions**: Bottom-fixed "Start Investigation" CTA.

### 2) Component Inventory
**shadcn/ui Components**
- `Button`: Sharp corners, `ghost` for nav, `default` for CTA with custom 1px glow border.
- `Card`: Primary container for evidence. `bg-muted/50` with high-grain texture.
- `Dialog`: For "Evidence Inspection" (detailed view of a node).
- `Input`: Monospace styling, `border-b-only` for a "form filling" feel.
- `Tooltip`: For metadata on board connections.
- `Separator`: Ultra-thin (`0.5px`) lines for spatial hierarchy.

**Custom Blocks**
- `StringCanvas`: SVG layer rendering bezier curves between `EvidenceCard` components.
- `EvidenceCard`: Custom card with "pinned paper" or "Polaroid" shadow effects.
- `RedactionEffect`: CSS-based "blackout" text for classified or placeholder information.
- `TerminalSearch`: Command-line interface component for filtering the board.

### 3) Design Tokens
- **Color (Dark Theme)**
  - `background`: `#0A0A0B` (Ink Black)
  - `foreground`: `#E2E2E2` (Soft Parchment)
  - `primary`: `#D1D5DB` (Cold Steel)
  - `accent`: `#8B0000` (Dried Blood/Crimson - for key connections)
  - `muted`: `#18181B` (Shadow Gray)
  - `border`: `#27272A` (Faint Metal)
- **Typography**
  - `Display`: Geist Sans, Semi-bold, -0.05em tracking.
  - `Body`: Geist Sans, Regular, high line-height (1.6).
  - `Metadata`: JetBrains Mono (Monospace for "Case Files").
- **Radii**: `2px` (Sharp/Industrial).
- **Shadows**: `shadow-hard` (Offset 4px, 4px, 0px blur, black) for tactile depth.
- **Spacing**: 8px grid system with heavy use of `gap-12` and `gap-24` for spatial clarity.

### 4) Interaction States
- **Hover**: 1px inner border glow on cards; string connections "pulse" with color when nodes are hovered.
- **Focus**: High-contrast `accent` ring with 2px offset.
- **Active**: `scale-[0.98]` to simulate tactile "click" of a mechanical button.
- **Disabled**: Desaturated (`grayscale`), 40% opacity, `cursor-not-allowed`.
- **Loading**: "Scanning" horizontal line animation across active cards.

### 5) Responsive Rules
- **Typography**: Fluid scaling using `clamp(1.5rem, 5vw, 3rem)`.
- **Grid**: Desktop (12-col), Tablet (8-col), Mobile (4-col).
- **Board Scaling**: The Canvas transitions from a free-form layout (Desktop) to a structured "Filing System" (List view) on Mobile.
- **Touch**: Increased hit targets (min 44px) for all board-interactive nodes.

### 6) Content Blocks and Suggested Copy Structure
- **Hero**: "Solve the Unsolvable." / "Spatial evidence mapping for complex ideas."
- **The Board**: "Connect the Dots." / "Visual logic for messy problems. No strings attached—unless you want them."
- **Evidence**: "Everything is Clue." / "Notes, links, and media transformed into tactile evidence cards."
- **Intelligence**: "Interrogate your data." / "Natural language search that finds the hidden link between disparate nodes."
- **Closing**: "Open the Case." / "Ready to find the solution?"

### 7) Accessibility Checklist
- **Contrast**: All text meets WCAG 2.1 AA minimum (4.5:1).
- **Navigation**: Full keyboard "tab-stop" cycle through Evidence Cards and Strings.
- **Aria-Labels**: "Link from [Node A] to [Node B]" for all SVG connections.
- **Motion**: `framer-motion` components respect `prefers-reduced-motion` media query.
- **Structure**: Semantic `<main>`, `<section>`, and `<article>` tags for card-based content.
