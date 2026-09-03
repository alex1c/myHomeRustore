/**
 * Mock expo-notifications and native monetization SDKs for Node/Jest.
 */

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'test-id'),
  cancelScheduledNotificationAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));

jest.mock('@appmetrica/react-native-analytics', () => ({
  __esModule: true,
  default: {
    activate: jest.fn(),
    reportEvent: jest.fn(),
  },
}));

jest.mock('yandex-mobile-ads', () => ({
  MobileAds: { initialize: jest.fn(async () => undefined) },
  BannerAdSize: {
    stickySize: jest.fn(async () => ({ width: 320, height: 50 })),
  },
  BannerView: 'BannerView',
  InterstitialAdLoader: {
    create: jest.fn(async () => ({
      loadAd: jest.fn(async () => null),
    })),
  },
}));
