# CycleTrack "Soft Bloom" Full Redesign — Design Spec

**Date:** 2026-03-25
**Status:** Approved
**Goal:** Transform CycleTrack from a functional prototype into a polished, illustrative wellness app that feels like Flo meets Headspace — feminine, playful, inviting, with NFP power features under an accessible surface.

---

## Design Language: "Soft Bloom"

**Vibe:** Warm, organic, inviting — an app that knows you and cares about you. Pink tones dominant, with soft illustrations and organic shapes.

### Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Primary | `#E8668B` (warm pink) | `#F08DA8` | Buttons, active states, primary actions |
| Primary Light | `#FDE8EF` | `#3D2030` | Subtle backgrounds, hover states |
| Background | Gradient: `#FFF8F9` → `#FDF2F5` | `#1A1520` | Page background (subtle gradient, not flat) |
| Card | `#FFFFFF` | `#231E2C` | Card surfaces |
| Phase Period | `#E8668B` + light `#FDE8EF` | `#F08DA8` + `#3D2030` | Menstruation phase |
| Phase Fertile | `#5BA8C8` + light `#D6EDF7` | `#6DBAD8` + `#1E3340` | Fertile window |
| Phase Ovulation | `#F0A870` + light `#FBE8D8` | `#F0B88C` + `#3D2E20` | Ovulation |
| Phase Luteal | `#9B8EC4` + light `#E8E4F3` | `#B0A4D4` + `#2E2639` | Luteal phase |
| Accent Coral | `#F4845F` | `#F4A080` | Highlights, CTAs |

### Typography
- **Headings:** Lora (serif), weights 500-700, sizes scaled up (h1: 28px, h2: 22px, h3: 18px)
- **Body:** Raleway (sans), weights 400-600, base 15px
- **Numbers/Data:** Raleway 600 with tabular figures

### Shapes & Effects
- **Border Radius:** 20-24px on cards, 16px on buttons, 999px on pills
- **Shadows:** Warm pink-tinted: `0 4px 20px rgba(232, 102, 139, 0.08)`
- **Blob Decorations:** SVG organic shapes as background elements on Dashboard and empty states
- **Gradients:** Subtle vertical gradients on page backgrounds, not flat colors

### Micro-Interactions
- **Spring Physics:** Framer Motion `type: "spring", stiffness: 300, damping: 25` as default
- **Tap Feedback:** `active:scale-[0.97]` with 150ms transition on all interactive elements
- **Page Transitions:** Directional slide with AnimatePresence (forward = left, back = right)
- **Skeleton Loading:** Shimmer effect on all pages instead of "Laden..." text
- **Nav Indicator:** Animated dot/pill that slides between nav items
- **Reduced Motion:** All animations respect `prefers-reduced-motion`

---

## Page Designs

### 1. Dashboard — "Your Daily Check-in"

**Layout:** Single immersive scroll, not a card grid.

**Sections top to bottom:**

1. **Cycle Ring (Hero)** — Large circular progress ring (200px) centered. Shows cycle progress visually with phase-colored gradient segments (pink → blue → peach → lavender). Center shows cycle day number (large, serif) + phase name (small, sans). Decorative blob SVGs in background behind ring.

2. **Status Pill** — Centered pill below ring: Icon + "Follikelphase · Tag 8". Color matches current phase. Subtle shadow.

3. **AI Summary Card** — Soft gradient background (primary-light → ovulation-light). Rounded 24px. Blends into page flow rather than standing out as a separate block. Sparkle icon + "Dein Status" label.

4. **Quick Stats Row** — Horizontal scrollable row of small round cards (80px wide):
   - "Periode in 12 Tagen"
   - "Ø 28 Tage Zyklus"
   - "Lutealphase: 14 Tage"
   Each card has: small icon on top, number in bold, label below. Soft shadows.

5. **CTA Button** — Full-width, coral/peach gradient: "Wie geht es dir heute?" Opens Entry Drawer. Large (h-14), rounded-2xl, with subtle shadow.

### 2. Entry Drawer — "Guided Entry"

**Principle:** Progressive disclosure. Most important field always visible, rest grouped and collapsible.

**Sections:**

1. **Temperature (always visible)** — Prominent number display with stepper buttons (+/- 0.05°C). Large touch targets. Disturbing factor toggle as small pill next to it. Visually distinct from other sections.

2. **Bleeding Group** — Collapsible section "Blutung". 4 round icons in a row (droplet sizes: small → large) for flow intensity. Active = filled icon with pink color + scale animation. Spotting as separate small icon.

3. **Fertility Signs Group** — Collapsible section "Fruchtbarkeitszeichen". Contains LH test (3 options as pills) + Cervix (5 options as pills). Default collapsed, shows summary text of selected values.

4. **Wellbeing Group** — Collapsible section "Wohlbefinden". Pain (4 level icons), Mood (horizontal scroll of round avatar-style icons), Symptoms (tag pills). Default collapsed.

5. **GV + Notes** — Bottom, subtle. Two toggle pills (protected/unprotected) + textarea.

**Interaction:** Tap section header to expand/collapse. Smooth spring animation. Collapsed sections show one-line summary of values if any are set.

### 3. Calendar — "Cycle Landscape"

**Enhancements over current:**

1. **Phase Bands** — Instead of individual colored cells, phases render as connected horizontal bands spanning multiple days. Period = continuous pink stripe, fertile = blue band, etc. Creates visual continuity.

2. **Ovulation Glow** — Ovulation day gets a soft glow ring (box-shadow with phase-ovulation color, animated pulse on predicted days).

3. **Today Marker** — Small colored dot below the date number instead of full cell highlight.

4. **Predicted Pattern** — Predicted days use CSS repeating-gradient wave pattern instead of dashed borders.

5. **Month Header** — Larger, serif font: "März 2026 · Zyklus 2" with cycle count.

6. **Day Detail** — Visual day profile: horizontal row of small colored dots showing what was tracked (pink = period, blue = fertile sign, orange = temp, purple = mood, etc.) before the detailed values.

### 4. Temperature Chart — "Health Visualization"

**Enhancements:**

1. **Gradient Fill** — Temperature line gets a gradient fill below it (primary color → transparent), creating an area chart feel. More visually striking than a bare line.

2. **Soft Phase Backgrounds** — Phase areas use softer gradient fills with rounded transitions.

3. **Coverline** — Shimmering dashed line with label pill at right edge.

4. **Touch Targets** — Data points enlarged to ≥44px tap area on mobile, tooltip on tap.

5. **Cycle Switcher** — New horizontal scrollable tabs above chart: "Aktuell", "Zyklus 12", "Zyklus 11"... to navigate between cycles instead of just showing last 6 months.

6. **Illustrative Empty State** — Custom SVG illustration instead of just an icon.

### 5. History — "Cycle Cards"

**Enhancements:**

1. **Thicker Bars** — h-10 instead of h-7, with smoother segment transitions.

2. **Expandable Rows** — Each cycle row is a tappable card. Tap expands to show: period length, ovulation day, temperature range, symptoms summary. Smooth spring animation.

3. **Forecast Pulse** — Predicted cycles have subtle pulse animation on the predicted segments.

### 6. Clara (Assistant)

**Enhancements:**

1. **Softer Bubbles** — More border-radius (20px), asymmetric (larger on one corner like iMessage).

2. **Illustrative Quick Actions** — Small cards (not pills) with icon + text, horizontal scroll. More visual weight and easier to tap.

3. **Sheet Modal** — Memory viewer uses Shadcn Sheet component instead of custom div. Proper focus trap and animations.

### 7. Dark Mode

1. **Settings Toggle** — Switch in Settings page under a new "Darstellung" section.
2. **Header Toggle** — Sun/Moon icon button in the mobile header.
3. **Implementation:** `next-themes` ThemeProvider (already a dependency). Wrap in layout.tsx.
4. **Dark Tokens:** Already defined in globals.css, just need the toggle mechanism.

---

## Global Components

### Skeleton Loading
Replace all "Laden..." text with shimmer skeleton components:
- Dashboard: Ring skeleton + card skeletons
- Calendar: Grid skeleton
- Chart: Rectangular skeleton with wave line
- History: Bar skeletons

### Blob Decorations
Reusable SVG blob components for background decoration:
- `<BlobDecoration variant="hero" />` — Large, for dashboard hero
- `<BlobDecoration variant="corner" />` — Small, for card backgrounds
- Positioned absolute, z-0, low opacity (0.3-0.5), uses phase colors
- Hidden when `prefers-reduced-motion` is set

### Animated Nav Indicator
Bottom nav active state: Animated pill/dot that slides between items using Framer Motion `layoutId`.

---

## Out of Scope
- NFP calculation engine
- Data model / types
- Backup / cloud sync logic
- Settings page (except dark mode toggle)
- API integrations (Gemini)
- Test infrastructure
