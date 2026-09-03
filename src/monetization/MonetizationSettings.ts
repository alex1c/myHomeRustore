/**
 * Persisted monetization counters (session count, last interstitial time).
 */

import type { SettingsRepository } from '@/src/repositories/settingsRepository';
import { MONETIZATION_SETTING_KEYS } from '@/src/monetization/config';

let settings: SettingsRepository | null = null;

/** Bind settings repository once DB is ready. */
export function bindMonetizationSettings(repo: SettingsRepository): void {
  settings = repo;
}

function requireSettings(): SettingsRepository {
  if (!settings) {
    throw new Error('Monetization settings not bound');
  }
  return settings;
}

export function getAppSessionCount(): number {
  const raw = requireSettings().get(MONETIZATION_SETTING_KEYS.appSessionCount);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Increments once per cold app process (not on tab/route remount). */
export function incrementAppSessionCount(): number {
  const next = getAppSessionCount() + 1;
  requireSettings().set(MONETIZATION_SETTING_KEYS.appSessionCount, String(next));
  return next;
}

export function getLastInterstitialAt(): number | null {
  const raw = requireSettings().get(MONETIZATION_SETTING_KEYS.lastInterstitialAt);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function setLastInterstitialAt(iso: string): void {
  requireSettings().set(MONETIZATION_SETTING_KEYS.lastInterstitialAt, iso);
}

/** Setting keys that must not be restored from a user backup archive. */
export function isMonetizationSettingsKey(key: string): boolean {
  return key.startsWith('monetization.');
}
