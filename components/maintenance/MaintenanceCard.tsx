/**
 * Compact maintenance rule card for lists and item details.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { MaintenanceRule } from '@/src/domain/types';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { presentMaintenanceStatus } from '@/src/utils/maintenancePresentation';

type MaintenanceCardProps = {
  rule: MaintenanceRule;
  itemName?: string;
  onPress: () => void;
  onMarkDone?: () => void;
  markingDone?: boolean;
};

export function MaintenanceCard({
  rule,
  itemName,
  onPress,
  onMarkDone,
  markingDone,
}: MaintenanceCardProps) {
  const colors = useThemeColors();
  const status = presentMaintenanceStatus(rule.nextDueDate);

  const statusColor =
    status.kind === 'overdue'
      ? colors.warning
      : status.kind === 'today' || status.kind === 'tomorrow'
        ? colors.primary
        : colors.textMuted;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {rule.title}
        </Text>
        {itemName ? (
          <Text style={[styles.item, { color: colors.textSecondary }]} numberOfLines={1}>
            {itemName}
          </Text>
        ) : null}
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.status, { color: colors.text }]}>{status.label}</Text>
        </View>
        {onMarkDone ? (
          <Button
            title={markingDone ? '…' : 'Готово'}
            variant="secondary"
            onPress={onMarkDone}
            disabled={markingDone}
            style={styles.done}
          />
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  item: {
    ...typography.caption,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  status: {
    ...typography.caption,
    fontWeight: '600',
  },
  done: {
    marginTop: spacing.sm,
  },
});
