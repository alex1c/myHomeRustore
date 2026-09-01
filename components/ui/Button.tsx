/**
 * Themed pressable button with minimum 48dp touch target.
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && { backgroundColor: colors.primary },
        variant === 'secondary' && {
          backgroundColor: colors.primarySoft,
          borderWidth: 1,
          borderColor: colors.primaryMuted,
        },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.label,
          {
            color:
              variant === 'primary'
                ? '#FFFFFF'
                : variant === 'ghost'
                  ? colors.primary
                  : colors.text,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...typography.button,
  },
});
