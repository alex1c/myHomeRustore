/**
 * Today tab — simple property summary and recent items.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import type { ItemListRow } from '@/src/domain/inventory';
import type { WarrantyAttentionRow } from '@/src/repositories/warrantyRepository';
import type { MaintenanceListRow } from '@/src/repositories/maintenanceRepository';
import { WARRANTY_EXPIRING_SOON_DAYS } from '@/src/domain/warranty';
import { MAINTENANCE_TODAY_AHEAD_DAYS } from '@/src/domain/maintenance';
import { useActiveProperty } from '@/src/hooks/useActiveProperty';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { toLocalDateOnly } from '@/src/utils/datetime';
import { warrantyTypeLabel } from '@/src/utils/warrantyPresentation';
import { presentMaintenanceStatus } from '@/src/utils/maintenancePresentation';
import { formatRussianDate } from '@/src/utils/formatDate';

export default function TodayScreen() {
  const router = useRouter();
  const { ready, error, inventory, locations, warranties, maintenanceService } =
    useDatabase();
  const { property, propertyId } = useActiveProperty();
  const colors = useThemeColors();
  const [itemCount, setItemCount] = useState(0);
  const [locationCount, setLocationCount] = useState(0);
  const [recent, setRecent] = useState<ItemListRow[]>([]);
  const [attention, setAttention] = useState<WarrantyAttentionRow[]>([]);
  const [maintenanceAttention, setMaintenanceAttention] = useState<
    MaintenanceListRow[]
  >([]);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!ready || !inventory || !locations || !propertyId) return;
    setItemCount(inventory.count(propertyId));
    setLocationCount(locations.countByProperty(propertyId));
    setRecent(inventory.listRecent(propertyId, 3));
    if (warranties) {
      setAttention(
        warranties.listAttentionForProperty(
          propertyId,
          WARRANTY_EXPIRING_SOON_DAYS,
          WARRANTY_EXPIRING_SOON_DAYS,
          toLocalDateOnly(),
        ),
      );
    }
    if (maintenanceService) {
      setMaintenanceAttention(
        maintenanceService.listAttentionForProperty(
          propertyId,
          MAINTENANCE_TODAY_AHEAD_DAYS,
        ),
      );
    }
  }, [ready, inventory, locations, warranties, maintenanceService, propertyId]);

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

      {attention.length > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.text }]}>Требует внимания</Text>
          {attention.map((row) => (
            <Pressable
              key={row.warranty.id}
              onPress={() => router.push({ pathname: '/warranty/[id]', params: { id: row.warranty.id } })}
              style={({ pressed }) => [
                styles.attentionRow,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={[styles.attentionMeta, { color: colors.textMuted }]}>
                {row.daysUntilEnd >= 0
                  ? row.daysUntilEnd === 0
                    ? 'Сегодня'
                    : `Через ${row.daysUntilEnd} ${pluralDays(row.daysUntilEnd)}`
                  : `Истекла ${Math.abs(row.daysUntilEnd)} ${pluralDays(Math.abs(row.daysUntilEnd))} назад`}
              </Text>
              <Text style={[styles.attentionTitle, { color: colors.text }]}>
                {row.daysUntilEnd >= 0 ? 'Заканчивается гарантия' : 'Гарантия'}
              </Text>
              <Text style={[styles.attentionItem, { color: colors.textSecondary }]} numberOfLines={1}>
                {row.itemName}
                {row.warranty.provider
                  ? ` · ${warrantyTypeLabel(row.warranty.type)}`
                  : ''}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {maintenanceAttention.length > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.text }]}>Обслуживание</Text>
          {maintenanceAttention.map((row) => {
            const status = presentMaintenanceStatus(row.rule.nextDueDate);
            return (
              <Pressable
                key={row.rule.id}
                onPress={() =>
                  router.push({
                    pathname: '/maintenance/[id]',
                    params: { id: row.rule.id },
                  })
                }
                onLongPress={() => {
                  if (!maintenanceService || markingId) return;
                  setMarkingId(row.rule.id);
                  void maintenanceService
                    .markDone(row.rule.id)
                    .then((result) => {
                      const next = result.rule.nextDueDate
                        ? formatRussianDate(result.rule.nextDueDate)
                        : null;
                      Alert.alert(
                        'Готово',
                        next
                          ? `Отмечено выполненным\nСледующее обслуживание — ${next}`
                          : 'Отмечено выполненным',
                      );
                      load();
                    })
                    .catch(() => {
                      Alert.alert('Ошибка', 'Не удалось отметить выполнение');
                    })
                    .finally(() => setMarkingId(null));
                }}
                style={({ pressed }) => [
                  styles.attentionRow,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Text style={[styles.attentionMeta, { color: colors.textMuted }]}>
                  {status.label}
                </Text>
                <Text style={[styles.attentionTitle, { color: colors.text }]}>
                  {row.rule.title}
                </Text>
                <Text
                  style={[styles.attentionItem, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {row.itemName}
                </Text>
              </Pressable>
            );
          })}
        </>
      ) : null}

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

function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
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
  attentionRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  attentionMeta: { ...typography.caption },
  attentionTitle: { ...typography.body, fontWeight: '600', marginTop: 2 },
  attentionItem: { ...typography.caption, marginTop: 2 },
  cta: { marginTop: spacing.lg },
});
