/**
 * Horizontal divider line.
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing } from '@/src/theme/tokens';

type DividerProps = {
  style?: StyleProp<ViewStyle>;
};

export function Divider({ style }: DividerProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[styles.line, { backgroundColor: colors.border }, style]}
      accessibilityRole="none"
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
});
