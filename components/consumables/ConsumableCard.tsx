/**
 * Compact consumable card for lists and item details.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Consumable } from '@/src/domain/types';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { presentConsumableStatus } from '@/src/utils/consumablePresentation';

type ConsumableCardProps = {
  consumable: Consumable;
  itemName?: string;
  onPress: () => void;
  onMarkReplaced?: () => void;
  marking?: boolean;
};

export function ConsumableCard({
  consumable,
  itemName,
  onPress,
  onMarkReplaced,
  marking,
}: ConsumableCardProps) {
  const colors = useThemeColors();
  const status = presentConsumableStatus(consumable);

  const statusColor =
    status.kind === 'out_of_stock' || status.kind === 'overdue'
      ? colors.warning
      : status.kind === 'today' || status.kind === 'tomorrow'
        ? colors.primary
        : colors.textMuted;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {consumable.name}
        </Text>
        {itemName ? (
          <Text style={[styles.item, { color: colors.textSecondary }]} numberOfLines={1}>
            {itemName}
          </Text>
        ) : null}
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.status, { color: colors.text }]}>{status.primary}</Text>
        </View>
        {status.secondary ? (
          <Text style={[styles.secondary, { color: colors.textMuted }]}>
            {status.secondary}
          </Text>
        ) : null}
        {onMarkReplaced ? (
          <Button
            title={marking ? '…' : 'Заменил'}
            variant="secondary"
            onPress={onMarkReplaced}
            disabled={marking}
            style={styles.action}
          />
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm, gap: spacing.xs },
  title: { ...typography.body, fontWeight: '600' },
  item: { ...typography.caption },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { ...typography.caption, fontWeight: '600' },
  secondary: { ...typography.caption },
  action: { marginTop: spacing.sm },
});
