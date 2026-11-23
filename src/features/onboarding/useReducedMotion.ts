import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (active) setReduceMotion(enabled);
      },
      () => {
        if (active) setReduceMotion(true);
      },
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
