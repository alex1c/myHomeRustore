/**
 * Screen shell with safe areas, optional scroll, and at most one banner.
 */

import React, { type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBanner } from '@/components/ads/AppBanner';
import type { BannerPlacement } from '@/src/monetization/config';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing } from '@/src/theme/tokens';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** At most one banner; omit on ad-free screens (forms, restore, onboarding). */
  banner?: BannerPlacement;
};

export function Screen({
  children,
  scroll = false,
  style,
  contentStyle,
  banner,
}: ScreenProps) {
  const colors = useThemeColors();

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }, style]}
      edges={['top', 'left', 'right']}
    >
      {body}
      {banner ? <AppBanner placement={banner} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
