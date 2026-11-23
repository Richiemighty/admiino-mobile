# Admiino P06A — Screen-specific artwork pack

**Important provenance:** These five PNGs are **existing Admiino artworks renamed for the five proposed opening screens**. A request to generate five new illustrations was attempted, but the image-generation service failed. This is an immediately usable fallback, not five newly generated or independently art-directed scenes.

## Install

Unzip the archive into `admiino-mobile/assets/`. This creates `assets/admiino/onboarding/p06a/`. Do not replace the official logo or the existing P05 assets.

## Suggested screens

- `welcome-mascot-transparent.png` — Welcome screen, transparent mascot. Use the existing P05 `Logo` component above it.
- `onboarding-01-organise-work.png` — Slide 1, tasks and planning.
- `onboarding-02-work-together.png` — Slide 2, approximate team imagery; a dedicated collaboration scene is still recommended.
- `onboarding-03-track-progress.png` — Slide 3, progress, calendar and status.
- `account-choice-productivity-hero.png` — Final account choice screen.

**Brand:** Other than the transparent mascot, the source artworks already have a **baked-in 'admiino' wordmark and a light illustrated background**. Do not layer a second logo directly over the baked-in one. Preserve aspect ratios, keep the logo legible if displayed, and test these light images within dark mode. The existing official logo is `assets/admiino/brand/logo-wordmark-original-transparent.png`.

## Animation limitation

Static PNGs are not character animations. Animate the entire image with entrance fades, gentle translation or parallax, and animate page transitions and progress indicators in React Native. Do not claim the character itself is articulated or lip-syncing.

## Before public launch

Replace these fallback artworks with purpose-built, cohesive Welcome/Organise/Collaborate/Progress/Account illustrations with no embedded text. In particular, Slide 2 needs a genuine collaboration-specific illustration. Leave exact paths unchanged if replacing so screen imports do not drift.

See `ASSET_MANIFEST.json` for SHA-256, sizes, origins and detailed usage notes.
