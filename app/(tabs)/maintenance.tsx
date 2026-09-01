/**
 * Maintenance tab — placeholder for service schedules (Phase 2+).
 */

import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { typography } from '@/src/theme/tokens';

export default function MaintenanceScreen() {
  const colors = useThemeColors();

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: colors.text }]}>Обслуживание</Text>
      <EmptyState
        title="Нет задач"
        message="Правила обслуживания и история ТО появятся здесь позже."
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
