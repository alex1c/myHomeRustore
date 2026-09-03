/**
 * Reusable Yandex banner for one placement group.
 * Collapses to zero height when load fails or keyboard is open.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  type BannerPlacement,
  resolveBannerUnitId,
} from '@/src/monetization/config';

type AppBannerProps = {
  placement: BannerPlacement;
  disabled?: boolean;
};

type BannerAdSizeLike = unknown;

type BannerSdk = {
  BannerAdSize: {
    stickySize: (width: number) => Promise<BannerAdSizeLike>;
  };
  BannerView: React.ComponentType<{
    size: BannerAdSizeLike;
    adRequest: { adUnitId: string };
    onAdLoaded?: () => void;
    onAdFailedToLoad?: () => void;
    style?: object;
  }>;
};

function loadBannerSdk(): BannerSdk | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('yandex-mobile-ads') as BannerSdk;
  } catch {
    return null;
  }
}

/**
 * One banner per screen. Prefer layout flow (footer) over absolute overlay.
 */
export function AppBanner({ placement, disabled = false }: AppBannerProps) {
  const { width } = useWindowDimensions();
  const sdk = useMemo(() => loadBannerSdk(), []);
  const [size, setSize] = useState<BannerAdSizeLike | null>(null);
  const [failed, setFailed] = useState(() => sdk == null);
  const [loaded, setLoaded] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const adUnitId = useMemo(() => resolveBannerUnitId(placement), [placement]);
  const bannerWidth = Math.max(320, Math.floor(width - 24));

  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!sdk) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sticky = await sdk.BannerAdSize.stickySize(bannerWidth);
        if (!cancelled) {
          setSize(sticky);
          setFailed(false);
          setLoaded(false);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setSize(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bannerWidth, adUnitId, sdk]);

  const handleFailed = useCallback(() => {
    setFailed(true);
    setLoaded(false);
  }, []);

  const handleLoaded = useCallback(() => {
    setLoaded(true);
  }, []);

  if (disabled || failed || keyboardOpen || !size || !sdk) {
    return null;
  }

  const BannerView = sdk.BannerView;

  return (
    <View
      style={[styles.wrap, !loaded && styles.collapsedPending]}
      pointerEvents={loaded ? 'auto' : 'none'}
    >
      <BannerView
        size={size}
        adRequest={{ adUnitId }}
        onAdLoaded={handleLoaded}
        onAdFailedToLoad={handleFailed}
        style={styles.banner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 8,
    paddingBottom: 4,
  },
  collapsedPending: {
    height: 0,
    overflow: 'hidden',
    paddingTop: 0,
    paddingBottom: 0,
  },
  banner: {
    alignSelf: 'center',
  },
});
