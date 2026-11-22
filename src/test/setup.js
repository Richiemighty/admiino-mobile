const { beforeEach, jest } = require('@jest/globals');

process.env.EXPO_PUBLIC_APP_ENV = 'development';
process.env.EXPO_PUBLIC_API_REQUIRED = 'false';

jest.mock('expo-router', () => require('./mocks/expo-router'));
jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));
jest.mock('expo-secure-store', () => require('./mocks/expo-secure-store'), {
  virtual: true,
});
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

global.fetch = jest.fn();

beforeEach(() => {
  global.fetch.mockReset();
});
