I will research the existing design language and authentication components in the codebase to ensure the new signup form specification aligns with the "Case" aesthetic and technical standards.
I will examine the existing authentication design specifications to incorporate any previously defined "v2" or animated elements into the new signup form design.
I will review `landing-v2-spec.md` to identify any "modern animated" design elements that can be adapted for the updated authentication form.
Based on the "Case" cinematic aesthetic and the technical requirements, I have designed the following authentication form specification for the signup process.

### Fields
- **Username**: `font-mono` input with "Identity Handle" placeholder. Sharp borders (`rounded-none`), high-contrast text.
- **Email**: Standard RFC 5322 validation, monospace styling, integrated "Verified" icon checkmark on successful format.
- **Password**: "Access Cipher" field with monochromatic eye-toggle. Sharp focus ring in "Cold Steel" (`#D1D5DB`).
- **Confirm Password**: "Verify Cipher" field. Visually linked to the primary password field via a subtle vertical "String" connector.

### Validation
- **Real-time Feedback**: Fields utilize a "Scanning" animation (horizontal light bar) that sweeps when input stops.
- **Zod Schema**: 
    - Username: 3-20 chars, alphanumeric.
    - Password: Min 8 chars, 1 uppercase, 1 symbol (Strong requirement).
    - Match Check: confirmPassword must strictly equal password; otherwise, triggers "Cipher Mismatch" error.
- **Error Display**: Inline monospace messages in "Dried Blood" (`#8B0000`). Fields flash red once on invalid submission attempt.

### States
- **Idle/Default**: `bg-card/85` with `backdrop-blur-md` and subtle scanline texture overlay.
- **Focus**: 1px inner glow border with a 10% increase in card opacity.
- **Submitting**: Button shifts to "Verifying Identity..." with a persistent "ScanningLoader" sweep animation across the card.
- **Success**: Card dissolves into a "Establishing Secure Connection" progress bar before a cinematic fade-to-board transition.

### UX Details
- **Motion**: Staggered entrance animations for fields using `framer-motion` (`y: 20, opacity: 0`).
- **Tactile Feedback**: Spring-physics on focus states; primary button scales to `0.98` on click.
- **Strength Meter**: A minimalist horizontal segmented bar below the password field that fills from "Cold Steel" to "Dried Blood" (ironically, for strength) or a high-contrast white.
- **Accessibility**: `aria-live="assertive"` for error alerts; full keyboard navigation with focus traps.
