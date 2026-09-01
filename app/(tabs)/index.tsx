/**
 * Today tab — minimal placeholder with empty state.
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { toLocalDateOnly } from '@/src/utils/datetime';

export default function TodayScreen() {
  const { ready, error } = useDatabase();
  const colors = useThemeColors();

  if (!ready && !error) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <EmptyState title="Не удалось загрузить данные" message={error} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: colors.text }]}>Сегодня</Text>
      <Text style={[styles.date, { color: colors.textSecondary }]}>
        {toLocalDateOnly()}
      </Text>
      <EmptyState
        title="Пока ничего на сегодня"
        message="Здесь появятся напоминания о гарантиях, обслуживании и расходниках."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
  },
  date: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
});
