/**
 * Production AppMetrica + Yandex Mobile Ads identifiers for «Мой дом».
 *
 * Release builds must resolve ONLY to these IDs — never demo/test units.
 */

import Constants from 'expo-constants';

/** AppMetrica production API key. */
export const APPMETRICA_API_KEY = '2ff3a08e-e312-4880-98af-b5c4dca731f0';

/** Yandex Advertising Network application id (informational). */
export const YANDEX_APP_ID = '19975558';

/**
 * Banner placement groups → production unit IDs.
 * today/inventory share block 1; maintenance shares block 2; documents/more share block 3.
 */
export const BANNER_PLACEMENTS = {
  today: 'R-M-19975558-1',
  inventory: 'R-M-19975558-1',
  maintenance: 'R-M-19975558-2',
  documents: 'R-M-19975558-3',
  more: 'R-M-19975558-3',
} as const;

export type BannerPlacement = keyof typeof BANNER_PLACEMENTS;

/** Production interstitial unit. */
export const INTERSTITIAL_AD_UNIT_ID = 'R-M-19975558-4';

/**
 * Native unit reserved for a future release — MUST NOT be used in 1.0.
 */
export const NATIVE_AD_UNIT_ID_RESERVED = 'R-M-19975558-5';

/** Known Yandex demo/test unit IDs — must never appear in production resolution. */
export const FORBIDDEN_DEMO_AD_UNIT_IDS = [
  'demo-banner-yandex',
  'demo-interstitial-yandex',
  'demo-rewarded-yandex',
  'demo-appopen-yandex',
] as const;

/** Interstitial eligibility policy. */
export const INTERSTITIAL_POLICY = {
  minAppSessions: 3,
  maxPerSession: 1,
  cooldownMs: 24 * 60 * 60 * 1000,
} as const;

/** Settings keys for monetization persistence (not backed up). */
export const MONETIZATION_SETTING_KEYS = {
  appSessionCount: 'monetization.app_session_count',
  lastInterstitialAt: 'monetization.last_interstitial_at',
} as const;

export const ONBOARDING_SETTING_KEY = 'onboarding.completed';

/** True when running a production/release client build. */
export function isProductionClient(): boolean {
  return typeof __DEV__ === 'undefined' ? true : !__DEV__;
}

/**
 * Resolves banner unit for a placement.
 * Never falls back to demo IDs in production.
 */
export function resolveBannerUnitId(placement: BannerPlacement): string {
  const unitId = BANNER_PLACEMENTS[placement];
  assertProductionAdUnit(unitId);
  return unitId;
}

/** Resolves interstitial unit — production ID only. */
export function resolveInterstitialUnitId(): string {
  assertProductionAdUnit(INTERSTITIAL_AD_UNIT_ID);
  return INTERSTITIAL_AD_UNIT_ID;
}

function assertProductionAdUnit(unitId: string): void {
  if (
    FORBIDDEN_DEMO_AD_UNIT_IDS.includes(
      unitId as (typeof FORBIDDEN_DEMO_AD_UNIT_IDS)[number],
    )
  ) {
    throw new Error('Demo/test ad unit must not be used');
  }
  if (unitId === NATIVE_AD_UNIT_ID_RESERVED) {
    throw new Error('Native ad unit is reserved and unused in 1.0');
  }
  if (isProductionClient() && !unitId.startsWith('R-M-19975558-')) {
    throw new Error(`Unexpected production ad unit: ${unitId}`);
  }
}

/** Pure eligibility helper — unit-testable without SDK. */
export function evaluateInterstitialEligibility(input: {
  sessionCount: number;
  shownThisSession: boolean;
  lastInterstitialAtMs: number | null;
  nowMs?: number;
}): boolean {
  if (input.shownThisSession) return false;
  if (input.sessionCount < INTERSTITIAL_POLICY.minAppSessions) return false;
  if (input.lastInterstitialAtMs != null) {
    const now = input.nowMs ?? Date.now();
    if (now - input.lastInterstitialAtMs < INTERSTITIAL_POLICY.cooldownMs) {
      return false;
    }
  }
  return true;
}

/** App version string for analytics properties. */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}
