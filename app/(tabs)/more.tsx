/**
 * More tab — settings, backup, export, and support entry points.
 */

import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Screen } from '@/components/ui/Screen';
import { appEnvironment } from '@/src/config/environment';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';

const SUPPORT_EMAIL = 'rustore-alex1c@yandex.ru';

export default function MoreScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { properties } = useDatabase();
  const defaultProperty = properties?.listProperties()[0];

  const openSupportEmail = () => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  const openPrivacyPolicy = () => {
    void Linking.openURL(appEnvironment.privacyPolicyUrl);
  };

  return (
    <Screen scroll banner="more">
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

      <Card style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/backup' as Href)}
          style={({ pressed }) => [
            styles.row,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.rowTitle, { color: colors.text }]}>
            Резервная копия
          </Text>
          <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
            Создать или восстановить .myhomebackup
          </Text>
        </Pressable>

        <Divider />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/export' as Href)}
          style={({ pressed }) => [
            styles.row,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.rowTitle, { color: colors.text }]}>
            Экспорт данных
          </Text>
          <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
            CSV для имущества, гарантий, ТО и расходников
          </Text>
        </Pressable>

        <Divider />

        <Pressable
          accessibilityRole="link"
          onPress={openSupportEmail}
          style={({ pressed }) => [
            styles.row,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.rowTitle, { color: colors.text }]}>
            Поддержка
          </Text>
          <Text style={[styles.rowMeta, { color: colors.primary }]}>
            {SUPPORT_EMAIL}
          </Text>
        </Pressable>

        <Divider />

        <Pressable
          accessibilityRole="link"
          onPress={openPrivacyPolicy}
          style={({ pressed }) => [
            styles.row,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.rowTitle, { color: colors.text }]}>
            Политика конфиденциальности
          </Text>
          <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
            Открыть в браузере
          </Text>
        </Pressable>
      </Card>
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
  actions: {
    marginTop: spacing.lg,
  },
  row: {
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  rowMeta: {
    ...typography.caption,
    marginTop: 2,
  },
});
