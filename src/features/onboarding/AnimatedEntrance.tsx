import { type PropsWithChildren, useEffect, useState } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { getMotionSettings } from './motion';

interface AnimatedEntranceProps extends PropsWithChildren {
  delay?: number;
  reduceMotion: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedEntrance({
  children,
  delay = 0,
  reduceMotion,
  style,
}: AnimatedEntranceProps) {
  const [progress] = useState(() => new Animated.Value(0));
  const motion = getMotionSettings(reduceMotion);

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.entranceDuration,
      delay: reduceMotion ? 0 : delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, motion.entranceDuration, progress, reduceMotion]);

  const animatedStyle = {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [motion.entranceOffset, 0],
        }),
      },
    ],
  };

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
