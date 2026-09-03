/**
 * Central interstitial loader + eligibility policy for «Мой дом».
 *
 * - min 3 real app sessions
 * - max 1 interstitial per process session
 * - 24 hour cooldown
 * - natural points only (backup / export / restore completion)
 * - never on startup / tabs / core CRUD
 */

import {
  evaluateInterstitialEligibility,
  resolveInterstitialUnitId,
} from '@/src/monetization/config';
import {
  getAppSessionCount,
  getLastInterstitialAt,
  setLastInterstitialAt,
} from '@/src/monetization/MonetizationSettings';
import { Analytics } from '@/src/services/AnalyticsService';

type TriggerReason = 'backup_created' | 'export_csv' | 'restore_completed';

type InterstitialAdLike = {
  show: () => void;
  onAdShown?: () => void;
  onAdFailedToShow?: () => void;
  onAdDismissed?: () => void;
};

type AdsSdk = {
  MobileAds: { initialize: () => Promise<void> };
  InterstitialAdLoader: {
    create: () => Promise<{
      loadAd: (req: { adUnitId: string }) => Promise<InterstitialAdLike | null>;
    } | null>;
  };
};

let sdkReady = false;
let loader: {
  loadAd: (req: { adUnitId: string }) => Promise<InterstitialAdLike | null>;
} | null = null;
let readyAd: InterstitialAdLike | null = null;
let loading = false;
let shownThisSession = false;
let sessionCountCached = 0;

function loadAdsSdk(): AdsSdk | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('yandex-mobile-ads') as AdsSdk;
  } catch {
    return null;
  }
}

export const InterstitialAdService = {
  /** Call after DB is ready — initializes Yandex Ads and preloads quietly. */
  async bootstrap(sessionCount: number): Promise<void> {
    sessionCountCached = sessionCount;
    try {
      const sdk = loadAdsSdk();
      if (!sdk) {
        sdkReady = false;
        return;
      }
      await sdk.MobileAds.initialize();
      sdkReady = true;
    } catch {
      sdkReady = false;
      return;
    }
    setTimeout(() => {
      void InterstitialAdService.preload();
    }, 2500);
  },

  async onBackupCreated(): Promise<void> {
    await InterstitialAdService.tryShow('backup_created');
  },

  async onExportCsv(): Promise<void> {
    await InterstitialAdService.tryShow('export_csv');
  },

  async onRestoreCompleted(): Promise<void> {
    await InterstitialAdService.tryShow('restore_completed');
  },

  async tryShow(_reason: TriggerReason): Promise<boolean> {
    if (!(await InterstitialAdService.isEligible())) {
      return false;
    }
    if (!readyAd) {
      void InterstitialAdService.preload();
      return false;
    }

    const ad = readyAd;
    readyAd = null;

    return await new Promise<boolean>((resolve) => {
      let finished = false;
      const finish = (ok: boolean) => {
        if (finished) return;
        finished = true;
        resolve(ok);
      };

      ad.onAdShown = () => {
        shownThisSession = true;
        setLastInterstitialAt(new Date().toISOString());
        Analytics.interstitialShown();
      };
      ad.onAdFailedToShow = () => {
        finish(false);
        void InterstitialAdService.preload();
      };
      ad.onAdDismissed = () => {
        finish(true);
        void InterstitialAdService.preload();
      };

      try {
        ad.show();
      } catch {
        finish(false);
      }
    });
  },

  async isEligible(): Promise<boolean> {
    try {
      const sessions =
        sessionCountCached > 0 ? sessionCountCached : getAppSessionCount();
      return evaluateInterstitialEligibility({
        sessionCount: sessions,
        shownThisSession,
        lastInterstitialAtMs: getLastInterstitialAt(),
      });
    } catch {
      return false;
    }
  },

  async preload(): Promise<void> {
    if (!sdkReady || loading || readyAd) return;
    loading = true;
    try {
      const sdk = loadAdsSdk();
      if (!sdk) return;
      if (!loader) {
        loader = await sdk.InterstitialAdLoader.create();
      }
      if (!loader) return;
      const unitId = resolveInterstitialUnitId();
      const ad = await loader.loadAd({ adUnitId: unitId });
      if (ad) {
        readyAd = ad;
      }
    } catch {
      // Unavailable — skip quietly
    } finally {
      loading = false;
    }
  },

  /** Test helper — resets in-memory session flags. */
  __resetForTests(partial?: {
    sessionCount?: number;
    shownThisSession?: boolean;
  }): void {
    if (partial?.sessionCount != null) sessionCountCached = partial.sessionCount;
    if (partial?.shownThisSession != null) {
      shownThisSession = partial.shownThisSession;
    } else if (!partial) {
      shownThisSession = false;
      sessionCountCached = 0;
      readyAd = null;
      sdkReady = false;
    }
  },
};
