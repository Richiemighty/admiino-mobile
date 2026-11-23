export interface MotionSettings {
  entranceDuration: number;
  slideDuration: number;
  entranceOffset: number;
}

export function getMotionSettings(reduceMotion: boolean): MotionSettings {
  return reduceMotion
    ? { entranceDuration: 90, slideDuration: 100, entranceOffset: 0 }
    : { entranceDuration: 420, slideDuration: 260, entranceOffset: 18 };
}

export function getSwipeDirection(
  translationX: number,
  translationY: number,
  velocityX: number,
  activeIndex: number,
  slideCount: number,
): -1 | 0 | 1 {
  const isHorizontal = Math.abs(translationX) >= Math.abs(translationY) * 1.15;
  const hasIntent = Math.abs(translationX) >= 52 || Math.abs(velocityX) >= 0.45;

  if (!isHorizontal || !hasIntent) return 0;
  if (translationX < 0 && activeIndex < slideCount - 1) return 1;
  if (translationX > 0 && activeIndex > 0) return -1;
  return 0;
}

export function resolveInitialSlideIndex(step: string | undefined, isDevelopment: boolean): number {
  if (!isDevelopment || !step || !/^[1-3]$/.test(step)) return 0;
  return Number(step) - 1;
}
