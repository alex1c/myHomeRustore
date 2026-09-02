/**
 * Compact warranty summary card for item details and lists.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import type { Warranty } from '@/src/domain/types';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { formatRussianDate } from '@/src/utils/formatDate';
import { resolveWarrantyEndDate } from '@/src/utils/warrantyDate';
import {
  presentWarrantyStatus,
  warrantyTypeLabel,
} from '@/src/utils/warrantyPresentation';

type WarrantyCardProps = {
  warranty: Warranty;
  onPress: () => void;
};

export function WarrantyCard({ warranty, onPress }: WarrantyCardProps) {
  const colors = useThemeColors();
  const endDate = resolveWarrantyEndDate(warranty);
  const status = presentWarrantyStatus(warranty);
  const typeLine = warranty.provider
    ? `${warrantyTypeLabel(warranty.type)} · ${warranty.provider}`
    : warrantyTypeLabel(warranty.type);

  const statusColor =
    status.kind === 'active'
      ? colors.success
      : status.kind === 'expiring_soon'
        ? colors.warning
        : colors.textMuted;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.card}>
        <Text style={[styles.type, { color: colors.text }]} numberOfLines={1}>
          {typeLine}
        </Text>
        {endDate ? (
          <Text style={[styles.endDate, { color: colors.textSecondary }]}>
            до {formatRussianDate(endDate)}
          </Text>
        ) : null}
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.status, { color: colors.text }]}>
            {status.label}
          </Text>
        </View>
        {status.detail ? (
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            {status.detail}
          </Text>
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
  type: {
    ...typography.body,
    fontWeight: '600',
  },
  endDate: {
    ...typography.body,
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
  detail: {
    ...typography.caption,
  },
});
