/**
 * Items tab — placeholder for household inventory (Phase 2+).
 */

import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { typography } from '@/src/theme/tokens';

export default function ItemsScreen() {
  const colors = useThemeColors();

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: colors.text }]}>Имущество</Text>
      <EmptyState
        title="Список пуст"
        message="Добавление вещей, комнат и категорий будет доступно в следующей фазе."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    marginBottom: 8,
  },
});
