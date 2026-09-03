/**
 * Runtime environment flags — no secrets, safe for production bundles.
 */

export const appEnvironment = {
  isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production',
  appVersion: '1.0.0',
  supportEmail: 'rustore-alex1c@yandex.ru',
  privacyPolicyUrl:
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ??
    'https://alex1c.github.io/myHomeRustore/privacy.html',
} as const;
