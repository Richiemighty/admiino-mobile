# P06A visual QA

No repository simulator screenshots were captured. The project owner separately tested the application on a physical phone through Expo Go and approved proceeding. This physical-device review is product visual acceptance, but it is not a substitute for simulator screenshots, native-build QA or automated evidence. The native/native-build limitations below remain open.

Requested captures after simulator access is restored:

- `p06a-01-welcome.png`
- `p06a-02-organise.png`
- `p06a-03-collaborate.png`
- `p06a-04-progress.png`
- `p06a-05-account-choice.png`

The development server already running on port 8081 was started by `npm start` under a parent process not owned by this task; its Expo endpoint selected the custom development client, so it was left undisturbed. A separate local-only Expo Go server was started on port 8082 for simulator inspection and then stopped; `exp://127.0.0.1:8082` is not a physical-phone URL. The owner will verify using Expo Go on their own phone. The blue gear seen in a previous capture is the development-client menu control, not an app component. The development/staging label and UI-kit link were application components and have been removed from onboarding screens; the UI kit remains protected at `/dev/ui-kit`.

No light/dark system appearance, large-text setting, or smaller simulator was changed. Those visual checks, swipe behavior on-device, Android, native splash and frame rate remain unverified. No production or staging API was used.

## Artwork scaling correction

The previous `contain`-only change left the `<Image>` frame at the entire viewport. Although the source ratio was preserved, all source content still used the maximum available viewport width; this did not reduce the principal artwork scale, and Account Choice has an embedded wordmark in its flattened art. The full-screen `AnimatedEntrance` also applied a vertical translation to the whole artwork canvas during entry, which could briefly expose edges but was not a zoom.

`OnboardingArtwork` now uses two layers: a viewport-sized lavender canvas and a centered `contain` image frame sized as a percentage of the viewport. The three slide images use 86% of viewport width and height; Account Choice uses 78% to scale down the embedded wordmark and illustration. Original images remain unchanged. Background entrance still fades but no longer translates the full-canvas layer. The Welcome mascot remains `contain` and its responsive height is 40% of the screen (still capped by width).

Files changed for this correction: `src/features/onboarding/OnboardingArtwork.tsx`, `AnimatedEntrance.tsx`, `content.ts`, `OnboardingCarousel.tsx`, `AccountChoiceScreen.tsx`, `WelcomeScreen.tsx`, `onboarding.test.tsx`, `docs/architecture/ONBOARDING.md`, and this QA record.

Automated onboarding tests assert aspect-preserving bounded artwork mapping and navigation. These do not replace visual validation. The owner has visually accepted the current onboarding implementation on a physical phone through Expo Go. Remaining outstanding items are formal simulator screenshots, compact-device and increased-text records, native-build/native-splash checks and Android verification.

## Artwork verification

The three new 941 x 1672 RGB PNGs are distinct. Their actual supplied paths are `assets/admiino/onboarding/image.png`, `image2.png`, and `image3.png`; the expected `image1.png` name is missing. `image.png` depicts the Organise scene and is used directly without modifying its source. If the canonical filename is required, provide or rename the approved Organise artwork to `assets/admiino/onboarding/image1.png` and verify its checksum before changing the import. Before release, capture the screens on iOS and Android and inspect portrait crops, contrast, safe-area spacing and large-text behavior.

## Expo Doctor directory-check exclusions

The `expo.doctor.reactNativeDirectoryCheck.exclude` list in the root `package.json` suppresses only React Native Directory metadata checks for these two transitive packages; it does not disable Expo Doctor checks generally:

- `@react-native-masked-view/masked-view` is installed as a production dependency of `expo-router@58.0.32` (`^0.3.2`, resolved as `0.3.2`). The directory labels it unmaintained. The app does not add or directly use it; replacing a required Expo Router dependency is outside this phase. Expo Doctor's SDK/native compatibility checks remain enabled.
- `expo-modules-core@58.1.0` is required transitively by `expo@58.0.26` (`~58.1.0`). It is Expo's native module core and has no React Native Directory metadata entry; it is not an independently selected app library. Expo's native-tooling and peer-dependency checks remain enabled.

The initial `npx expo-doctor --verbose` run passed 19/20 checks and failed only the React Native Directory metadata check. It separately warned that bundled native-module data could not be fetched; this was not the directory metadata failure. After adding the two narrow exclusions, `npx expo-doctor` passed 20/20 checks. `npx expo install --check` also reported that dependencies are up to date.
