/**
 * More tab — settings foundation placeholder.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Screen } from '@/components/ui/Screen';
import { appEnvironment } from '@/src/config/environment';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';

export default function MoreScreen() {
  const colors = useThemeColors();
  const { properties } = useDatabase();
  const defaultProperty = properties?.listProperties()[0];

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: colors.text }]}>Ещё</Text>

      <Card>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Версия
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {appEnvironment.appVersion}
        </Text>

        <Divider />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Объект
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {defaultProperty?.name ?? '—'}
        </Text>
      </Card>

      <View style={styles.note}>
        <Text style={[styles.noteText, { color: colors.textMuted }]}>
          Резервное копирование, экспорт и настройки уведомлений — в следующих
          фазах.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.body,
  },
  note: {
    marginTop: spacing.lg,
  },
  noteText: {
    ...typography.caption,
    textAlign: 'center',
  },
});
