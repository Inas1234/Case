I will read the existing landing page specifications to ensure the new design remains consistent with the project's established visual identity and functional goals.
I will verify the existence and size of the design specification files to determine if they contain any relevant information.
I will read both landing page specifications to gather a comprehensive understanding of the project's design history and requirements.
# Case: Landing Page Specification (V3)
**Tone:** Serious Cinematic Workspace. High-stakes, tactile, monochromatic with precision accents.

### Layout
- **Global:** 12-column grid, fluid vertical spacing (`gap-24` to `gap-48`), dark-first theme.
- **Navbar:** Sticky glassmorphism (`backdrop-blur-xl`) with a "System Status" pulse (Green/Amber) and "Case ID" tracking in the corner.
- **Max Width:** 1440px container for content, full-bleed for background cinematic textures.

### Sections
1. **The Lead (Hero):** Large-scale display typography. "The truth is in the connections." Subtext: "A spatial workspace for complex investigations." Primary CTA: "Open a Case."
2. **The Field (Interactive Demo):** A constrained "Canvas Lite" area. Draggable "Evidence Cards" (Polaroids, Transcripts) that snap to a grid and draw dynamic Bezier "Strings" upon proximity or manual connection.
3. **Forensics (Product 1):** Focus on search and filtering. Terminal-style interface showing real-time indexing of uploaded documents.
4. **Collaboration (Product 2):** "Chain of Custody" visualization. A vertical timeline showing who moved what node and when, rendered as a high-contrast audit log.
5. **Clearance Levels (Pricing):** Minimalist card-based tiers:
    - **Open Source (Free):** Public boards, basic nodes.
    - **Restricted (Pro):** Private cases, AI-assisted linking, unlimited strings.
    - **Classified (Enterprise):** Local hosting, SAML, dedicated "Locker" (Storage).
6. **The Archive (Footer):** Dense, multi-column layout. Left: "Case" logo + "Department of Information." Center: System links. Right: Live "Server Time" and "Active Investigations" counter.

### Components
- **EvidenceNode:** Sharp-cornered cards with high-grain texture. Header contains "Timestamp" and "Node ID."
- **ConnectionString:** SVG-based lines that glow when the connected nodes are active or hovered.
- **CinematicButton:** 1px border-glow, `uppercase`, tracking-widest, `hover:bg-primary hover:text-background`.
- **StatusBadge:** Monospace font, `bg-muted` with a small colored dot for "Live," "Closed," or "Draft" states.

### Motion
- **Entrance:** Reveal animations using `y: 20, opacity: 0` for text blocks.
- **Interaction:** Drag-and-drop powered by `framer-motion` with `spring` physics for tactile feedback.
- **Background:** Subtle "dust-mote" particle effect or low-opacity scanlines moving slowly across the viewport.
- **State Changes:** Smooth layout transitions between demo steps.

### Mobile Behavior
- **Navigation:** Compact "Plus" menu for actions; links move to a full-screen "Command Center" overlay.
- **Demo Area:** Replaces drag-and-drop with a "Tap to Connect" sequence or a horizontal card carousel that visualizes links as a side-bar list.
- **Typography:** Display fonts downscale aggressively (`text-4xl` to `text-2xl`) to maintain the "serious" information density without overcrowding.
