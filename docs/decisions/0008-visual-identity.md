# 0008: Visual identity: true black, one accent hue on data, outline icons

**Status:** Accepted (2026-10-26)

## Context

The first prototype used emoji as icons, a different colour for each of the 7 types, a violet accent, gradients and glowing pins. Two automated reviews flagged it: Taste Skill's inspector (emoji, violet, heavy shadow, no `h1`) and Vercel's Web Interface Guidelines. Spawn is checked at night, quickly, on a phone, before going out.

## Decision

Adopt Taste Skill's **`true-black-flat`** app style (seed 1131324797), chosen over `data-terminal` because Spawn is a quick night-time look at events, not a long analysis session. Adapted to a map game:

- **Elevation by lightness alone:** `#000` ground, `#111` surfaces, `#2a2a2a` raised. No shadows at rest, no gradients, no glows.
- **One accent hue, on data only:** what's live, your 150 m reach, and Legendary. Never on buttons, tabs or navigation. The hue comes from Montréal: the orange of the metro's orange line, which runs under the Plateau.
- **Primary actions by inversion:** a white pill with black text (Catch It, Keep Exploring).
- **Types by icon, not colour:** one outline icon set (Lucide, ISC license) replaces the emoji and the seven hues.
- **Rarity by marks:** Rare gets a white outer ring, Legendary an accent ring with a slow second ring; rarity pills are neutral except Legendary.
- **Inter, self-hosted** (`@fontsource/inter`, weights 400/500/600), so no request goes to a font CDN.
- **Brand mark:** the catch ring seen from above, drawn in the accent.

## Alternatives considered

- **Keep the colourful game look.** Familiar for a game, but seven hues plus glows made nothing stand out, and the map read as a template.
- **`data-terminal`** (the other dark style dealt): built for long monitoring sessions, with signs instead of colour. Wrong use pattern.
- **A light theme.** Spawn is mostly used at night, and the map tiles were already inverted to dark.

## Consequences

- Taste Skill's source linter reports 0 FAIL / 0 WARN. The inspector went from 5 FAIL to 1. The remaining FAIL (text touching the edge) is the sideways-scrolling filter row, which now fades, and the map credit; both are deliberate.
- Colour now means something: an orange pin is live, so the eye goes straight to what can be caught now.
- Two dependencies added (`lucide-react`, `@fontsource/inter`). Marker icons are rendered once to SVG strings and cached.
- Looking at the screenshots found three bugs the tools missed: Leaflet's light grey flashing while tiles load, the map credit drawing over the spawn sheet, and an orange zero on "0 Legendary".
