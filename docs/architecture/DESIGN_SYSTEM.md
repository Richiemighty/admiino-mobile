# Mobile design system

## Foundation

P05 uses React Native `StyleSheet` with typed tokens and a React theme provider. It does not add NativeWind: this is a native-first component layer, and a second styling system would duplicate style ownership without improving the approved mobile experience.

Import reusable controls from `src/components/ui` and theme values from `src/theme`. `ThemeProvider` supports `light`, `dark`, and `system` modes; `useAppTheme()` exposes the selected mode, resolved palette, and `setMode`. The app currently follows the system setting by default. Preference persistence is intentionally not part of this phase.

```tsx
import { AppButton, AppText } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { View } from 'react-native';

function Example() {
  const { colors } = useAppTheme();
  return (
    <View style={{ backgroundColor: colors.surface }}>
      <AppText>Example content</AppText>
      <AppButton accessibilityLabel="Save changes" onPress={() => undefined}>
        Save
      </AppButton>
    </View>
  );
}
```

In normal use, pass button text as its child; `AppButton` applies the matching accessible text tone. Access `useAppTheme()` for semantic view styles when needed.

## Token roles

`src/theme/tokens.ts` is the single source for the theme palettes, branding, spacing, typography, radius, elevation, icon sizes, touch targets, task status tones, and priority tones.

- **Logo ink** `#1E149F` and **decorative gold** `#C69B19` are approximate samples from the supplied image, not an approved master color specification.
- **Primary action** is `#6724DB` in light mode and `#8951EC` in dark mode. It is intentionally distinct from the sampled logo ink and gold.
- Light and dark palettes define page/surface/text/muted/border/focus/action colors and readable semantic foreground/background pairs for neutral, success, warning, info, and danger.
- Gold is decorative only. It is not used as normal text on white.
- Task status vocabulary is centralized: `pending`, `in_progress`, `in_review`, `completed`, `delayed`, and `cancelled`. `in_review` consistently uses the warning tone. Priority vocabulary is `low`, `medium`, `high`, and `urgent`.
- Spacing uses the 4-point scale: 4, 8, 12, 16, 20, 24, 32, and 40.
- Typography provides display, title, heading, body, label, and caption levels. React Native system fonts and font scaling are retained; do not add fixed line counts to ordinary copy.
- Radius, elevation, icon-size, and minimum-touch-target values are centralized. Interactive targets are at least 44 pt on iOS and 48 dp on Android.

## Components and accessibility

`AppText`, `AppButton`, `AppInput`, `AppScreen`, `AppCard`, `InlineError`, `LoadingState`, `Logo`, and `IconButton` are platform-native and receive semantic styles from the active theme. Use visible input labels, error text, explicit accessible labels for buttons, accessible progress/error announcements, safe-area-aware screens, and keyboard avoidance for forms. Avoid color-only status communication.

Text allows platform font scaling by default and wraps rather than clipping. Verify layouts with large accessibility text and at 320 pt/dp width on devices before product-screen acceptance. All palette text/foreground pairs are checked against WCAG AA's 4.5:1 normal-text threshold in `src/theme/theme.test.tsx`; actual device contrast, VoiceOver/TalkBack, and 200% font scaling remain device QA.

`IconButton` accepts an icon element; the development gallery uses the already-installed Expo Symbols module. No icon dependency was added. For the brand, use the exact supplied original wordmark. Its source is 256 x 256 with transparent padding, so keep its rendered canvas at or below 160 logical pixels to avoid excessive upscaling. The optional monogram is generated artwork and is labeled a concept; it does not replace the canonical wordmark.

The app icon and logo-only light native splash are configured from the supplied assets. Native icon/splash updates may require a new development build; Expo Go does not necessarily reflect the installed app icon or OS launch screen. App identifiers and signing credentials remain pending owner decisions.

## Development gallery

`app/dev/ui-kit.tsx` is a development-only reference for all nine controls, both palettes, validation/loading states, task tones, brand artwork, and the mascot. The starter screen links to it only in development. `DevelopmentOnlyRoute` redirects to `/` when disabled; its production branch is covered by a component test. This gallery is not a product screen or a production navigation destination.
