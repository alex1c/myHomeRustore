/**
 * Compact Smart Today attention card with optional quick action.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { TodayAttentionItem } from '@/src/domain/today';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

type AttentionCardProps = {
  item: TodayAttentionItem;
  busy?: boolean;
  onPress: () => void;
  onQuickAction?: () => void;
};

function statusColor(
  severity: TodayAttentionItem['severity'],
  colors: ReturnType<typeof useThemeColors>,
): string {
  if (severity === 'critical') return colors.warning;
  if (severity === 'warning') return colors.warning;
  return colors.textMuted;
}

export function AttentionCard({
  item,
  busy = false,
  onPress,
  onQuickAction,
}: AttentionCardProps) {
  const colors = useThemeColors();
  const actionLabel =
    item.quickAction === 'mark_done'
      ? 'Готово'
      : item.quickAction === 'mark_replaced'
        ? 'Заменил'
        : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: pressed || busy ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.body}>
        <Text
          style={[styles.status, { color: statusColor(item.severity, colors) }]}
          numberOfLines={2}
        >
          {item.statusText}
        </Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text
          style={[styles.subtitle, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {item.subtitle}
        </Text>
      </View>

      {actionLabel && onQuickAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          disabled={busy}
          onPress={(event) => {
            // Keep card navigation from firing when tapping the action.
            event.stopPropagation?.();
            onQuickAction();
          }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: colors.primarySoft,
              borderColor: colors.primaryMuted,
              opacity: pressed || busy ? 0.75 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={[styles.actionLabel, { color: colors.primary }]}>
              {actionLabel}
            </Text>
          )}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  status: {
    ...typography.caption,
    fontWeight: '600',
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    marginTop: 2,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  action: {
    minWidth: 88,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.caption,
    fontWeight: '700',
  },
});
