/**
 * Today tab — simple property summary and recent items.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import type { ItemListRow } from '@/src/domain/inventory';
import { useActiveProperty } from '@/src/hooks/useActiveProperty';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { toLocalDateOnly } from '@/src/utils/datetime';

export default function TodayScreen() {
  const router = useRouter();
  const { ready, error, inventory, locations } = useDatabase();
  const { property, propertyId } = useActiveProperty();
  const colors = useThemeColors();
  const [itemCount, setItemCount] = useState(0);
  const [locationCount, setLocationCount] = useState(0);
  const [recent, setRecent] = useState<ItemListRow[]>([]);

  const load = useCallback(() => {
    if (!ready || !inventory || !locations || !propertyId) return;
    setItemCount(inventory.count(propertyId));
    setLocationCount(locations.countByProperty(propertyId));
    setRecent(inventory.listRecent(propertyId, 3));
  }, [ready, inventory, locations, propertyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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

      <Card style={styles.summary}>
        <Text style={[styles.propertyName, { color: colors.text }]}>
          {property?.name ?? 'Мой дом'}
        </Text>
        <Text style={[styles.stat, { color: colors.textSecondary }]}>
          {itemCount} {pluralItems(itemCount)}
        </Text>
        <Text style={[styles.stat, { color: colors.textSecondary }]}>
          {locationCount} {pluralRooms(locationCount)}
        </Text>
      </Card>

      {itemCount === 0 ? (
        <EmptyState
          title="Пока ничего не добавлено"
          message="Добавьте первую вещь, чтобы начать вести каталог имущества."
        />
      ) : (
        <>
          <Text style={[styles.section, { color: colors.text }]}>Недавно добавлено</Text>
          {recent.map((row) => (
            <Pressable
              key={row.item.id}
              onPress={() => router.push(`/item/${row.item.id}`)}
              style={({ pressed }) => [
                styles.recentRow,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={[styles.recentName, { color: colors.text }]} numberOfLines={1}>
                {row.item.name}
              </Text>
              {row.locationName ? (
                <Text style={[styles.recentMeta, { color: colors.textMuted }]}>
                  {row.locationName}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </>
      )}

      <Button
        title="Добавить вещь"
        onPress={() => router.push('/item/add')}
        style={styles.cta}
      />
    </Screen>
  );
}

function pluralItems(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'вещь';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'вещи';
  return 'вещей';
}

function pluralRooms(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'комната';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'комнаты';
  return 'комнат';
}

const styles = StyleSheet.create({
  title: { ...typography.title },
  date: { ...typography.body, marginBottom: spacing.lg },
  summary: { marginBottom: spacing.lg, gap: spacing.xs },
  propertyName: { ...typography.subtitle },
  stat: { ...typography.body },
  section: { ...typography.subtitle, marginBottom: spacing.sm },
  recentRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  recentName: { ...typography.body, fontWeight: '600' },
  recentMeta: { ...typography.caption, marginTop: 2 },
  cta: { marginTop: spacing.lg },
});
