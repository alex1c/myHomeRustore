/**
 * Document list card for item details and global archive.
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ui/Card';
import { DOCUMENT_TYPE_LABELS } from '@/src/domain/documents';
import type { Document } from '@/src/domain/types';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { formatRussianDate } from '@/src/utils/formatDate';

type DocumentCardProps = {
  document: Document;
  itemName?: string;
  onPress: () => void;
};

export function DocumentCard({ document, itemName, onPress }: DocumentCardProps) {
  const colors = useThemeColors();
  const typeLabel = DOCUMENT_TYPE_LABELS[document.type] ?? document.type;
  const created = document.createdAt.slice(0, 10);

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {document.title || typeLabel}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {typeLabel}
        </Text>
        {itemName ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
            {itemName}
          </Text>
        ) : null}
        <Text style={[styles.date, { color: colors.textMuted }]}>
          {formatRussianDate(created)}
        </Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    gap: 2,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  meta: {
    ...typography.caption,
  },
  date: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
