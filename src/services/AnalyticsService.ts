/**
 * Privacy-safe AppMetrica wrapper for «Мой дом».
 *
 * Never send item names, brands, serials, prices, notes, paths, or filenames.
 */

import { Platform } from 'react-native';

import {
  APPMETRICA_API_KEY,
  getAppVersion,
} from '@/src/monetization/config';

type SafeAttrs = Record<string, string | number | boolean>;

let activated = false;
let appOpenSent = false;

type AppMetricaModule = {
  activate: (config: {
    apiKey: string;
    sessionTimeout?: number;
    logs?: boolean;
  }) => void;
  reportEvent: (name: string, attributes?: SafeAttrs) => void;
};

function loadSdk(): AppMetricaModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@appmetrica/react-native-analytics') as
      | AppMetricaModule
      | { default: AppMetricaModule };
    if (mod && typeof mod === 'object' && 'default' in mod && mod.default) {
      return mod.default;
    }
    return mod as AppMetricaModule;
  } catch {
    return null;
  }
}

/** Initializes AppMetrica once. Best-effort — never throws to callers. */
export function initAnalytics(): void {
  if (activated) return;
  try {
    const AppMetrica = loadSdk();
    if (!AppMetrica) return;
    AppMetrica.activate({
      apiKey: APPMETRICA_API_KEY,
      sessionTimeout: 120,
      logs: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
    });
    activated = true;
  } catch {
    // Analytics must never break the app
  }
}

function report(eventName: string, attributes?: SafeAttrs): void {
  try {
    if (!activated) {
      initAnalytics();
    }
    if (!activated) return;
    const AppMetrica = loadSdk();
    AppMetrica?.reportEvent(eventName, attributes);
  } catch {
    // swallow
  }
}

export const Analytics = {
  /** One app_open per process. */
  appOpen(): void {
    if (appOpenSent) return;
    appOpenSent = true;
    report('app_open', {
      app_version: getAppVersion(),
      platform: Platform.OS,
    });
  },

  itemCreated(category?: string): void {
    report('item_created', category ? { category } : undefined);
  },

  itemDeleted(): void {
    report('item_deleted');
  },

  warrantyCreated(type?: string): void {
    report('warranty_created', type ? { type } : undefined);
  },

  warrantyExpiringOpened(): void {
    report('warranty_expiring_opened');
  },

  documentAdded(type?: string): void {
    report('document_added', type ? { type } : undefined);
  },

  maintenanceCreated(): void {
    report('maintenance_created');
  },

  maintenanceCompleted(): void {
    report('maintenance_completed');
  },

  consumableCreated(): void {
    report('consumable_created');
  },

  consumableReplaced(): void {
    report('consumable_replaced');
  },

  stockUpdated(kind: 'add' | 'set'): void {
    report('stock_updated', { kind });
  },

  todayAttentionOpened(kind: 'warranty' | 'maintenance' | 'consumable'): void {
    report('today_attention_opened', { kind });
  },

  todayQuickAction(action: 'mark_done' | 'mark_replaced'): void {
    report('today_quick_action', { action });
  },

  backupCreated(): void {
    report('backup_created');
  },

  restoreCompleted(): void {
    report('restore_completed');
  },

  exportCsv(kind: string): void {
    report('export_csv', { kind });
  },

  interstitialShown(): void {
    report('interstitial_shown');
  },
};

/** Test helpers — do not use in product UI. */
export const __analyticsTest = {
  reset(): void {
    activated = false;
    appOpenSent = false;
  },
  isActivated(): boolean {
    return activated;
  },
  wasAppOpenSent(): boolean {
    return appOpenSent;
  },
};
