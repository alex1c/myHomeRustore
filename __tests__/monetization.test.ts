/**
 * Monetization config, eligibility, and analytics isolation tests.
 */

import AppMetrica from '@appmetrica/react-native-analytics';

import {
  APPMETRICA_API_KEY,
  BANNER_PLACEMENTS,
  FORBIDDEN_DEMO_AD_UNIT_IDS,
  INTERSTITIAL_AD_UNIT_ID,
  INTERSTITIAL_POLICY,
  NATIVE_AD_UNIT_ID_RESERVED,
  evaluateInterstitialEligibility,
  resolveBannerUnitId,
  resolveInterstitialUnitId,
} from '@/src/monetization/config';
import { isMonetizationSettingsKey } from '@/src/monetization/MonetizationSettings';
import {
  Analytics,
  __analyticsTest,
  initAnalytics,
} from '@/src/services/AnalyticsService';

describe('production monetization IDs', () => {
  test('uses approved AppMetrica and Yandex unit IDs', () => {
    expect(APPMETRICA_API_KEY).toBe('2ff3a08e-e312-4880-98af-b5c4dca731f0');
    expect(resolveBannerUnitId('today')).toBe('R-M-19975558-1');
    expect(resolveBannerUnitId('inventory')).toBe('R-M-19975558-1');
    expect(resolveBannerUnitId('maintenance')).toBe('R-M-19975558-2');
    expect(resolveBannerUnitId('documents')).toBe('R-M-19975558-3');
    expect(resolveBannerUnitId('more')).toBe('R-M-19975558-3');
    expect(resolveInterstitialUnitId()).toBe('R-M-19975558-4');
    expect(NATIVE_AD_UNIT_ID_RESERVED).toBe('R-M-19975558-5');
  });

  test('never resolves demo units or reserved native', () => {
    const all = [...Object.values(BANNER_PLACEMENTS), INTERSTITIAL_AD_UNIT_ID];
    for (const id of all) {
      expect(FORBIDDEN_DEMO_AD_UNIT_IDS).not.toContain(id);
      expect(id).not.toBe(NATIVE_AD_UNIT_ID_RESERVED);
    }
  });

  test('interstitial policy values', () => {
    expect(INTERSTITIAL_POLICY.minAppSessions).toBe(3);
    expect(INTERSTITIAL_POLICY.maxPerSession).toBe(1);
    expect(INTERSTITIAL_POLICY.cooldownMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe('interstitial eligibility', () => {
  const now = Date.parse('2026-09-03T12:00:00.000Z');

  test('blocks sessions 1 and 2', () => {
    expect(
      evaluateInterstitialEligibility({
        sessionCount: 1,
        shownThisSession: false,
        lastInterstitialAtMs: null,
        nowMs: now,
      }),
    ).toBe(false);
    expect(
      evaluateInterstitialEligibility({
        sessionCount: 2,
        shownThisSession: false,
        lastInterstitialAtMs: null,
        nowMs: now,
      }),
    ).toBe(false);
  });

  test('allows session 3 when never shown', () => {
    expect(
      evaluateInterstitialEligibility({
        sessionCount: 3,
        shownThisSession: false,
        lastInterstitialAtMs: null,
        nowMs: now,
      }),
    ).toBe(true);
  });

  test('blocks second show in same session', () => {
    expect(
      evaluateInterstitialEligibility({
        sessionCount: 5,
        shownThisSession: true,
        lastInterstitialAtMs: null,
        nowMs: now,
      }),
    ).toBe(false);
  });

  test('blocks within 24h cooldown', () => {
    expect(
      evaluateInterstitialEligibility({
        sessionCount: 5,
        shownThisSession: false,
        lastInterstitialAtMs: now - 12 * 60 * 60 * 1000,
        nowMs: now,
      }),
    ).toBe(false);
  });

  test('allows after 24h cooldown', () => {
    expect(
      evaluateInterstitialEligibility({
        sessionCount: 5,
        shownThisSession: false,
        lastInterstitialAtMs: now - 24 * 60 * 60 * 1000 - 1000,
        nowMs: now,
      }),
    ).toBe(true);
  });
});

describe('analytics', () => {
  beforeEach(() => {
    __analyticsTest.reset();
    jest.clearAllMocks();
  });

  test('init once and app_open once', () => {
    initAnalytics();
    initAnalytics();
    expect(AppMetrica.activate).toHaveBeenCalledTimes(1);
    expect(AppMetrica.activate).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: APPMETRICA_API_KEY }),
    );
    Analytics.appOpen();
    Analytics.appOpen();
    expect(AppMetrica.reportEvent).toHaveBeenCalledTimes(1);
    expect(AppMetrica.reportEvent).toHaveBeenCalledWith(
      'app_open',
      expect.objectContaining({ platform: expect.any(String) }),
    );
  });

  test('failure in activate does not throw', () => {
    (AppMetrica.activate as jest.Mock).mockImplementationOnce(() => {
      throw new Error('sdk boom');
    });
    expect(() => initAnalytics()).not.toThrow();
    expect(__analyticsTest.isActivated()).toBe(false);
  });

  test('events never include sensitive payload keys', () => {
    initAnalytics();
    Analytics.itemCreated('appliance');
    Analytics.backupCreated();
    Analytics.exportCsv('inventory');
    for (const call of (AppMetrica.reportEvent as jest.Mock).mock.calls) {
      const attrs = call[1] as Record<string, unknown> | undefined;
      if (!attrs) continue;
      const keys = Object.keys(attrs).join(',');
      expect(keys).not.toMatch(/name|serial|price|note|path|file|brand|title/i);
      for (const value of Object.values(attrs)) {
        expect(
          typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean',
        ).toBe(true);
      }
    }
  });
});

describe('monetization settings keys', () => {
  test('detects monetization.* keys', () => {
    expect(isMonetizationSettingsKey('monetization.app_session_count')).toBe(
      true,
    );
    expect(isMonetizationSettingsKey('activePropertyId')).toBe(false);
  });
});
