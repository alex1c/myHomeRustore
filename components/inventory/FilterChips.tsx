/**
 * Horizontal or wrapping filter chips.
 *
 * Horizontal ScrollView MUST use flexGrow:0 in column layouts — otherwise RN
 * stretches it to fill leftover height and chips look like tall cards.
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

export type FilterChip = {
  id: string;
  label: string;
};

type FilterChipsProps = {
  chips: FilterChip[];
  selectedId: string;
  onSelect: (id: string) => void;
  /**
   * Wrap chips into a compact row (best for 2–4 filters).
   * Default keeps horizontal scroll for longer chip lists.
   */
  wrap?: boolean;
};

export function FilterChips({
  chips,
  selectedId,
  onSelect,
  wrap = false,
}: FilterChipsProps) {
  const colors = useThemeColors();

  const nodes = chips.map((chip) => {
    const selected = chip.id === selectedId;
    return (
      <Pressable
        key={chip.id}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onSelect(chip.id)}
        style={[
          styles.chip,
          wrap ? styles.chipWrap : null,
          {
            backgroundColor: selected ? colors.primarySoft : colors.surface,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            { color: selected ? colors.primary : colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {chip.label}
        </Text>
      </Pressable>
    );
  });

  if (wrap) {
    return <View style={styles.wrapRow}>{nodes}</View>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Prevent vertical expansion inside flex column parents.
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      {nodes}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Allow long labels (e.g. «Требуют внимания») to take needed width without
  // stretching the whole filter panel vertically.
  chipWrap: {
    flexGrow: 0,
    flexShrink: 1,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
});
