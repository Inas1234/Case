I will begin by reading the existing design specifications to ensure the new Login and Signup designs are consistent with the established project style.

I will list the files in the `docs/design-specs` directory to check their sizes and confirm if they contain any relevant information.

I will list the contents of the `docs/design-specs` directory to verify the presence and size of the specification files.

I will read the `auth-spec.md` file to understand the existing authentication design requirements.

I will use `grep_search` to check the content of `auth-spec.md` and confirm if it contains any relevant design information or if it's filled with placeholder text.

I will check the `src/app` directory to see if the `/login` or `/signup` routes have already been created.

Based on the "Case" design system and your requirements for a cinematic, high-frictionless authentication experience using Supabase and shadcn/ui, here is the design specification for the Login and Signup pages.

### 1) Layout Map
**Desktop**
- **Wrapper**: Full-viewport centered flex container. Background features a subtle `radial-gradient` (center-out) from `#18181B` to `#0A0A0B`.
- **Auth Card**: 400px width, `2px` sharp borders, `backdrop-blur-xl`. Uses the "Hard Shadow" token from the landing spec.
- **Header**: Left-aligned minimalist "Case" branding. High-contrast display heading: *"Access Intelligence"* (Login) or *"Join the Investigation"* (Signup).
- **Footer**: Minimalist monochromatic links for route switching (e.g., "Request Access" or "Sign In") at the bottom of the card.

**Mobile**
- **Wrapper**: Full-height viewport, top-aligned content with 24px horizontal padding.
- **Form**: Full-width inputs with 48px touch targets. Card borders/shadows are removed for a seamless "edge-to-edge" mobile feel.
- **Navigation**: Top-left "Back" arrow (ghost button) to return to the landing page.

### 2) Component Inventory
**shadcn/ui Components**
- `Card`: Primary container with `bg-muted/50` and `rounded-none`.
- `Input`: Monospace styling (`font-mono`), sharp corners, and `border-b` emphasis.
- `Button`: `default` with 1px glow border for CTAs; `ghost` for secondary navigation.
- `Form` / `FormControl`: Integrated with `zod` for schema-based validation.
- `Alert`: For global Supabase errors (e.g., "Invalid credentials").

**Custom Blocks**
- `AuthLayout`: Shared wrapper managing the cinematic background and entrance animations.
- `PasswordToggle`: Input variant with a monochromatic "peek" icon.
- `ScanningLoader`: A horizontal line animation that sweeps across the primary button during `isSubmitting` states.

### 3) Form UX and Validation Rules
- **Email**: Required; standard RFC 5322 validation.
- **Password**: 
  - *Login*: Required; no client-side length check (handled by Supabase).
  - *Signup*: Min 8 characters, 1 uppercase, 1 symbol. Strength meter visual using `accent` color.
- **Feedback**: 
  - **Error**: Input border changes to `#8B0000` (Dried Blood). Inline messages appear in monospace below the field.
  - **Loading**: Button text shifts to "Verifying..." with the `ScanningLoader` active.
- **Redirection**: On success, a 500ms "Establishing Secure Connection" transition before pushing to `/dashboard`.

### 4) Design Tokens (Auth-specific)
- **Background**: `#0A0A0B` (Ink Black)
- **Foreground**: `#E2E2E2` (Soft Parchment)
- **Accent**: `#8B0000` (Dried Blood) — Reserved for errors and critical UI highlights.
- **Focus Ring**: `2px solid #D1D5DB` (Cold Steel) with `offset-2`.
- **Radii**: `0px` to `2px` (Industrial/Sharp).

### 5) Interaction States
- **Hover**: Inputs utilize a 1px inner glow; links underline with a `duration-300` fade.
- **Active**: Primary buttons scale to `0.98` to simulate tactile feedback.
- **Validation**: Fields flash `#8B0000` once if a submission is attempted with invalid data.
- **Disabled**: Grayscale desaturation (40% opacity) for buttons during active Supabase requests.

### 6) Responsive Rules
- **Typography**: Fluid scaling using `clamp`; headers reduce by 15% on screens `< 640px`.
- **Padding**: Mobile uses `px-6 py-12`; Desktop uses `p-8` inside the centered card.
- **Visibility**: Subtle background grid patterns are hidden on mobile to reduce visual noise.

### 7) Accessibility Checklist
- **ARIA**: Auth alerts use `aria-live="assertive"` for immediate screen-reader feedback on failures.
- **Keyboard**: Full tab-index cycle; `Enter` key triggers form submission from any field.
- **Contrast**: All text/background combinations verified for WCAG 2.1 AA (4.5:1 ratio).
- **Labels**: Every input is explicitly paired with a `<Label>` using `htmlFor` for increased hit-target area.
