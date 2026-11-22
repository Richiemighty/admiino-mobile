# Admiino mobile asset pack

**Extract the ZIP into `admiino-mobile/assets/`.** The archive already has an `admiino/` top-level folder. Result: `admiino-mobile/assets/admiino/`.

## Primary assets for Copilot

| Purpose | Path relative to repository root |
|---|---|
| Official supplied brand logo (transparent) | `assets/admiino/brand/logo-wordmark-original-transparent.png` |
| Generated large wordmark | `assets/admiino/brand/logo-wordmark-refined-transparent.png` |
| iOS app icon (1024 px opaque) | `assets/admiino/icons/app-icon-ios-1024.png` |
| Android adaptive foreground | `assets/admiino/icons/android-adaptive-foreground.png` |
| Android adaptive background | `assets/admiino/icons/android-adaptive-background.png` |
| Android adaptive monochrome | `assets/admiino/icons/android-adaptive-monochrome.png` |
| Android store icon | `assets/admiino/icons/app-icon-android-store-512.png` |
| Native light splash logo | `assets/admiino/splash/native-splash-wordmark-light.png` |
| Native dark splash mark | `assets/admiino/splash/native-splash-mark-dark.png` |
| Illustrated startup/welcome art | `assets/admiino/splash/splash-productivity-illustration.png` |
| Onboarding hero art | `assets/admiino/onboarding/onboarding-productivity-hero.png` |
| Standalone cartoon character | `assets/admiino/onboarding/mascot-professional-phone.png` |

## Important implementation notes

- The exact user-supplied wordmark is `logo-wordmark-original-transparent.png`. Generated wordmark and monogram artworks are creative recreations, **not** verified master-brand vector files. For brand-critical usage, prefer the original unless the product owner approves the generated refinement.
- Use a logo-only **native splash** image. Native launch screens do not reliably show a full-bleed poster across iOS and Android. Render the illustrated `splash-productivity-illustration.png` on the subsequent React Native welcome/onboarding screen.
- The light native splash image has transparent padding. Set `backgroundColor: '#FFFFFF'` in Expo splash config. For the dark image, set a matching opaque background (for example `#160B78`), but confirm the UI palette first.
- The iOS icon is opaque, full-bleed and has **no pre-rounded corner mask**; the OS applies its own mask. The earlier generated `app-icon-concept-generated.png` remains a visual reference only.
- Android adaptive layers use the same lettermark scaled inside the central safe zone. The monochrome variant is an alpha-mask foreground; Android applies dynamic colors.
- All filenames are lowercase kebab-case, stable for `require()` calls.
- Do not replace existing application asset files until P05 review. Wire up `app.config.ts` splash/icons in P05, then run Expo Doctor, asset resolution and an iOS simulator launch. Native icon/splash changes may require a **new development build**; Expo Go may not reflect them.

## Asset descriptions

- `brand/logo-wordmark-original-transparent.png` — Canonical user-supplied logo. Use where exact brand artwork matters.
- `brand/logo-wordmark-original-white.png` — Canonical user-supplied logo with white background, for reference.
- `brand/logo-wordmark-original-small-transparent.png` — Small original logo reference; not for large upscaling.
- `brand/logo-wordmark-refined-transparent.png` — Generated high-resolution recreation; visual approximation, review against original before replacing canonical logo.
- `brand/logo-monogram-generated-transparent.png` — Generated standalone brand monogram concept. Keep transparent.
- `icons/app-icon-concept-generated.png` — Original generated icon mockup; rounded corners are baked into the artwork. Not the configured iOS source.
- `icons/app-icon-ios-1024.png` — Edge-to-edge 1024x1024 opaque PNG for iOS app icon (generated production-format candidate).
- `icons/app-icon-android-store-512.png` — Opaque 512x512 Play Store listing icon candidate.
- `icons/android-adaptive-foreground.png` — 432x432 transparent foreground at conservative safe-zone scale.
- `icons/android-adaptive-background.png` — 432x432 solid indigo adaptive icon background.
- `icons/android-adaptive-monochrome.png` — 432x432 white alpha mask for Android themed icon.
- `splash/native-splash-wordmark-light.png` — 1200x1200 transparent wordmark canvas for native splash; set backgroundColor separately.
- `splash/native-splash-mark-dark.png` — 1200x1200 transparent white/yellow monogram canvas for dark native splash.
- `splash/splash-productivity-illustration.png` — Tall 9:16 illustrated startup/welcome art; use within React Native welcome screen, NOT as OS native splash image.
- `onboarding/onboarding-productivity-hero.png` — Generated 4:5 productivity scene for onboarding/get-started screens.
- `onboarding/mascot-professional-phone.png` — Transparent standing professional mascot, resizable in onboarding/empty states.

## Brand colors

The supplied original small logo has an approximate indigo `#1E149F` and gold `#C69B19` when sampled. These are source-image approximations, not an official brand guide. The existing approved mobile UX Blueprint also specifies a primary action violet (`#6724DB`) and dark variant (`#8951EC`). Keep these roles separate in tokens. Gold does not meet normal body-text contrast on white and should be used sparingly for decoration.
