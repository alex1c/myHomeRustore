/**
 * Inventory list card — photo, title, meta, price.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ItemListRow } from '@/src/domain/inventory';
import { categoryLabel } from '@/src/domain/categories';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';
import { managedUriFromRelativePath } from '@/src/services/managedFileService';
import { formatRubMinor } from '@/src/utils/money';

type ItemCardProps = {
  row: ItemListRow;
  onPress: () => void;
};

function buildSubtitle(row: ItemListRow): string | null {
  const parts: string[] = [];
  if (row.item.brand) {
    parts.push(row.item.brand);
  }
  if (row.item.model) {
    parts.push(row.item.model);
  }
  return parts.length > 0 ? parts.join(' • ') : null;
}

export function ItemCard({ row, onPress }: ItemCardProps) {
  const colors = useThemeColors();
  const photoUri = row.item.primaryPhotoPath
    ? managedUriFromRelativePath(row.item.primaryPhotoPath)
    : null;
  const subtitle = buildSubtitle(row);
  const price =
    row.priceMinor != null ? formatRubMinor(row.priceMinor) : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <Ionicons
            name="cube-outline"
            size={28}
            color={colors.textMuted}
            accessibilityLabel={categoryLabel(row.item.category)}
          />
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {row.item.name}
        </Text>
        {subtitle ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {row.locationName ? (
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {row.locationName}
          </Text>
        ) : null}
        {price ? (
          <Text style={[styles.price, { color: colors.primary }]}>{price}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    minHeight: 88,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  name: {
    ...typography.subtitle,
    fontSize: 16,
  },
  meta: {
    ...typography.caption,
  },
  price: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});
