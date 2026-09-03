/**
 * Boots analytics + ads once after the local database is ready.
 */

import { Analytics, initAnalytics } from '@/src/services/AnalyticsService';
import { InterstitialAdService } from '@/src/services/InterstitialAdService';
import {
  bindMonetizationSettings,
  incrementAppSessionCount,
} from '@/src/monetization/MonetizationSettings';
import type { SettingsRepository } from '@/src/repositories/settingsRepository';

let bootstrapped = false;

/** Idempotent session/analytics/ads startup for the current process. */
export async function bootstrapMonetization(
  settingsRepository: SettingsRepository,
): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  try {
    bindMonetizationSettings(settingsRepository);
    initAnalytics();
    Analytics.appOpen();

    const sessions = incrementAppSessionCount();
    await InterstitialAdService.bootstrap(sessions);
  } catch {
    // Ads/analytics must never block app use
  }
}

/** Test helper. */
export function __resetBootstrapForTests(): void {
  bootstrapped = false;
}
