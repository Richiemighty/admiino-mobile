const { beforeEach, jest } = require('@jest/globals');

process.env.EXPO_PUBLIC_APP_ENV = 'development';
process.env.EXPO_PUBLIC_API_REQUIRED = 'false';

jest.mock('expo-router', () => require('./mocks/expo-router'));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));
jest.mock('@react-native-async-storage/async-storage', () => require('./mocks/async-storage'));
jest.mock('expo-secure-store', () => require('./mocks/expo-secure-store'), {
  virtual: true,
});
jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  const Animated = {
    View: ReactNative.View,
    Text: ReactNative.Text,
    ScrollView: ReactNative.ScrollView,
    createAnimatedComponent: (component) => component,
  };
  return {
    __esModule: true,
    default: Animated,
    Animated,
    runOnJS: (callback) => callback,
    useAnimatedStyle: (factory) => factory(),
    useSharedValue: (initialValue) => ({ value: initialValue }),
    withSpring: (value) => value,
    withTiming: (value) => value,
    cancelAnimation: jest.fn(),
    Easing: { linear: jest.fn() },
  };
});
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  const createGesture = () => {
    const gesture = {};
    for (const method of ['activeOffsetX', 'failOffsetY', 'onStart', 'onUpdate', 'onEnd']) {
      gesture[method] = () => gesture;
    }
    return gesture;
  };
  return {
    ...actual,
    Gesture: { Pan: createGesture },
    GestureDetector: ({ children }) => children,
  };
});
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const ReactNative = require('react-native');
  const Swipeable = React.forwardRef((props, ref) => {
    const methods = {
      close: jest.fn(),
      openLeft: jest.fn(),
      openRight: jest.fn(),
      reset: jest.fn(),
    };
    React.useImperativeHandle(ref, () => methods);
    const actions = props.renderRightActions
      ? props.renderRightActions({ value: 0 }, { value: 0 }, methods)
      : null;
    return React.createElement(
      ReactNative.View,
      {
        testID: props.testID,
        onSwipeableClose: props.onSwipeableClose,
        onSwipeableOpen: props.onSwipeableOpen,
        onSwipeableOpenStartDrag: props.onSwipeableOpenStartDrag,
        dragOffsetFromRight: props.dragOffsetFromRight,
      },
      actions,
      props.children,
    );
  });
  Swipeable.displayName = 'MockReanimatedSwipeable';
  return {
    __esModule: true,
    default: Swipeable,
    SwipeDirection: { LEFT: 'left', RIGHT: 'right' },
  };
});
jest.mock('lucide-react-native', () => require('./mocks/lucide-react-native'));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

global.fetch = jest.fn();

beforeEach(() => {
  global.fetch.mockReset();
});
