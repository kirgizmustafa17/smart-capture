# Design System & Visual Authority: SmartCapture PRO

## Mode
- **Mode:** `Operate` (Productivity tool, keyboard-driven precision, low cognitive load, scanability).

## Visual World: Obsidian Precision
- **Aesthetic:** High-craft dark slate engineering precision. Subtle translucency, crisp 1px borders, calibrated elevation shadows, zero visual noise or gratuitous decoration.
- **Craft Floor Compliance:**
  - **No emoji icons:** 100% bespoke inline vector SVGs with uniform 2px stroke width, round caps/joins.
  - **No gradient text:** Crisp solid typography with deliberate optical weights (`#ffffff`, `#f8fafc`, `#94a3b8`, `#64748b`).
  - **No layout-thrashing animations:** Zero transitions on `width`, `height`, `padding`, or `margin`. Exclusively GPU composited (`transform`, `opacity`).
  - **Themed browser surfaces:** Custom dark slate scrollbars (`::-webkit-scrollbar`), themed text selection (`::selection`), and accessible focus indicators (`:focus-visible`).
  - **Tabular figures:** `font-variant-numeric: tabular-nums` applied to coordinates, zoom percentages, and dimensions.

## Color Palette Tokens

### Surface Hierarchy
- **Canvas Base (Deep Obsidian):** `#080c14`
- **Application Shell (Slate 950):** `#090d16`
- **Header & Structural Bars:** `#0d1322`
- **Toolbars & Elevated Panels:** `#131d31`
- **Cards & Interactive Containers:** `#141f36`
- **Hover States:** `#1c2b4a` / `#24355a`

### Borders & Dividers
- **Subtle Border:** `rgba(255, 255, 255, 0.07)`
- **Card Border:** `rgba(255, 255, 255, 0.10)`
- **Active / Accent Border:** `#6366f1` (Indigo 500)

### Accents & Semantics
- **Brand Primary:** `#6366f1` (Indigo) / `#4f46e5` (Indigo 600)
- **Cyan Accent (Selection & Crop):** `#06b6d4`
- **Emerald Accent (Success & Ready):** `#10b981`
- **Rose Accent (Errors & Alerts):** `#ef4444`
- **Amber Accent (Warnings & Highlights):** `#f59e0b`

## Typography
- **UI Font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif`
- **Data & Coordinate Font:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- **Scale:** Fixed 11px / 12px / 13px / 14px / 15px scale tuned for compact desktop extension windows.

## Elevation & Depth
- **Level 1 (Cards):** `0 1px 2px rgba(0, 0, 0, 0.3)`
- **Level 2 (Dropdowns, Floating toolbars):** `0 4px 14px -2px rgba(0, 0, 0, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.25)`
- **Level 3 (Modals & Studio Canvas):** `0 24px 64px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)`
