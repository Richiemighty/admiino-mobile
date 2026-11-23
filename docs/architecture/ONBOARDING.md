# P06A onboarding architecture

P06A supersedes the older P06 Sign In-first ordering in the Development Playbook. The approved Blueprint and Playbook are unchanged. The entry sequence is **Welcome → Organise your work → Work better together → Stay on top of everything → Account Choice**.

## Routes and launch decision

- `app/index.tsx` reads one local, non-sensitive `admiino.onboarding.completed` preference and replaces itself with Welcome or Account Choice.
- `app/(onboarding)/welcome.tsx`, `slides.tsx`, and `account-choice.tsx` are the three UI destinations. The slide route renders a single carousel with three data-driven pages.
- Welcome and completion use route replacement to avoid accumulating onboarding routes in the back stack. Slide Back controls change the carousel index; Back from its first slide returns to Welcome.
- Future sign-in and invitation routes can be addressed directly by their own deep links. The first-launch check is only at `/` and is not a root-layout auth guard, so it will not intercept those destinations.

The carousel accepts `?step=1|2|3` only in development to capture individual visual-review screenshots; production ignores the parameter and starts at slide one.

## Persistence and UI-only boundaries

AsyncStorage stores only the string `true` for onboarding completion. It stores no token, account, identity, or authentication state. Storage read/write failures are shown as retryable UI errors rather than silently treating onboarding as complete.

Create Account and Sign In open closeable, labelled P06B placeholder messages. The planned routes are `/create-account` and `/sign-in`; neither route nor authentication behavior is implemented in P06A. The development-only Replay onboarding action removes the preference and returns to Welcome.

P06A makes no API or `fetch` calls. The existing environment validator and production-safe environment configuration remain unchanged. The dev-only P05 UI kit remains reachable from the environment indicator.

## Motion and assets

React Native `Animated` and `PanResponder` provide native-driven fades/translations, staggered image/copy/button entrance, horizontal drag/settle, animated progress segments and a short fade to Account Choice without adding another animation dependency. The drag uses the built-in responder; vertical movement remains available to the page scroll view. `AppButton` provides pressed-opacity and slight scale feedback. Reduce Motion is read from `AccessibilityInfo`; reduced mode removes translation and uses short opacity transitions. Motion preference read failures default conservatively to reduced motion. No haptics module is installed.

The three slides use distinct, statically imported portrait PNGs: `assets/admiino/onboarding/image.png` (Organise), `image2.png` (Work together), and `image3.png` (Stay on top). All are 941 x 1672 RGB. The expected `image1.png` was not present; the supplied `image.png` depicts the correct Organise scene and is used without changing its bytes. `OnboardingArtwork` separates the full-viewport lavender canvas from a centered, aspect-preserving image frame. Slide artwork uses 86% of the viewport in each dimension; Account Choice uses 78% to keep its embedded wordmark balanced. These relative bounds leave a matching brand-color surround on varying device sizes instead of scaling art edge-to-edge. Background entrance motion fades without translating the full-screen canvas. The transparent Welcome mascot uses `contain` at a responsive, bounded size. Text and controls sit in a translucent, theme-aware panel at the bottom, with progress immediately above the primary action.

Welcome uses the transparent mascot and existing P05 `Logo`. Account Choice uses the supplied portrait fallback art and does not add a logo over its embedded wordmark. Slide and Account Choice artwork may crop at the edges on phone aspect ratios; visual review on a simulator remains a release check. The development/staging indicator and UI-kit link are not shown on onboarding screens; the protected UI kit remains at `/dev/ui-kit`. The floating gear visible in Expo Go is Expo's development-menu overlay, not app UI.
