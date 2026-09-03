/**
 * Smart Today — home command center: attention, upcoming, recent, overview.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import { AttentionCard } from '@/components/today/AttentionCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { AppError } from '@/src/domain/errors';
import {
  TODAY_ATTENTION_PREVIEW_LIMIT,
  type TodayActivityItem,
  type TodayAttentionItem,
  type TodayOverview,
} from '@/src/domain/today';
import { useActiveProperty } from '@/src/hooks/useActiveProperty';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { subscribeDataReset } from '@/src/services/dataReset';
import { Analytics } from '@/src/services/AnalyticsService';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import {
  buildUpcomingAttention,
  takeAttentionPreview,
} from '@/src/utils/todayAttention';
import {
  pluralDocuments,
  pluralItems,
  pluralRooms,
  pluralRules,
  todayGreeting,
  todayHeadline,
  todaySummaryLine,
} from '@/src/utils/todayPresentation';
import { formatRussianDate } from '@/src/utils/formatDate';
import { toLocalDateOnly } from '@/src/utils/datetime';

export default function TodayScreen() {
  const router = useRouter();
  const {
    ready,
    error,
    todayService,
    maintenanceService,
    consumableService,
  } = useDatabase();
  const { propertyId } = useActiveProperty();
  const colors = useThemeColors();

  const [overview, setOverview] = useState<TodayOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(() => {
    if (!ready || !todayService || !propertyId) return;
    try {
      setOverview(todayService.getOverview(propertyId));
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Не удалось загрузить Сегодня',
      );
    } finally {
      setHasLoaded(true);
    }
  }, [ready, todayService, propertyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // After replace-restore, bump refresh even if the tab stayed mounted.
  useEffect(() => subscribeDataReset(() => load()), [load]);

  const visibleAttention = useMemo(() => {
    if (!overview) return [];
    return showAllAttention
      ? overview.attention
      : takeAttentionPreview(overview.attention, TODAY_ATTENTION_PREVIEW_LIMIT);
  }, [overview, showAllAttention]);

  const upcoming = useMemo(() => {
    if (!overview) return [];
    return buildUpcomingAttention(overview.attention, {
      previewLimit: TODAY_ATTENTION_PREVIEW_LIMIT,
      showAllAttention,
    });
  }, [overview, showAllAttention]);

  const remainingAttention = overview
    ? Math.max(0, overview.attention.length - TODAY_ATTENTION_PREVIEW_LIMIT)
    : 0;

  const navigateAttention = (item: TodayAttentionItem) => {
    // Kind only (warranty | maintenance | consumable) — no titles.
    Analytics.todayAttentionOpened(item.kind);
    if (item.kind === 'warranty') {
      router.push({ pathname: '/warranty/[id]', params: { id: item.entityId } });
      return;
    }
    if (item.kind === 'maintenance') {
      router.push({
        pathname: '/maintenance/[id]',
        params: { id: item.entityId },
      });
      return;
    }
    router.push({
      pathname: '/consumable/[id]',
      params: { id: item.entityId },
    });
  };

  const navigateActivity = (item: TodayActivityItem) => {
    const { route } = item;
    if (route.type === 'item') {
      router.push(`/item/${route.id}`);
      return;
    }
    if (route.type === 'document') {
      router.push({ pathname: '/document/[id]', params: { id: route.id } });
      return;
    }
    if (route.type === 'maintenance') {
      router.push({
        pathname: '/maintenance/[id]',
        params: { id: route.id },
      });
      return;
    }
    router.push({
      pathname: '/consumable/[id]',
      params: { id: route.id },
    });
  };

  const handleMarkDone = async (item: TodayAttentionItem) => {
    if (!maintenanceService || busyId) return;
    setBusyId(item.id);
    try {
      await maintenanceService.markDone(item.entityId);
      Analytics.todayQuickAction('mark_done');
      Alert.alert('Готово', 'Отмечено выполненным');
      load();
    } catch {
      Alert.alert('Ошибка', 'Не удалось отметить выполнение');
    } finally {
      setBusyId(null);
    }
  };

  const runMarkReplaced = async (
    item: TodayAttentionItem,
    allowZeroStock: boolean,
  ) => {
    if (!consumableService) return;
    setBusyId(item.id);
    try {
      await consumableService.markReplaced(
        item.entityId,
        toLocalDateOnly(),
        null,
        { allowZeroStock },
      );
      Analytics.todayQuickAction('mark_replaced');
      Alert.alert('Готово', 'Замена отмечена');
      load();
    } catch (err) {
      if (err instanceof AppError && err.code === 'STOCK_ZERO_CONFIRM') {
        Alert.alert(
          'Запас закончился',
          'В запасе указано 0 шт.\n\nОтметить замену всё равно?',
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Заменил',
              onPress: () => {
                void runMarkReplaced(item, true);
              },
            },
          ],
        );
        return;
      }
      Alert.alert('Ошибка', 'Не удалось отметить замену');
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickAction = (item: TodayAttentionItem) => {
    if (item.quickAction === 'mark_done') {
      void handleMarkDone(item);
      return;
    }
    if (item.quickAction === 'mark_replaced') {
      void runMarkReplaced(item, false);
    }
  };

  if ((!ready && !error) || (ready && !hasLoaded && !loadError)) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  if (error || loadError) {
    return (
      <Screen>
        <EmptyState
          title="Не удалось загрузить данные"
          message={error ?? loadError ?? 'Попробуйте ещё раз'}
        />
        <Button title="Повторить" onPress={load} style={styles.cta} />
      </Screen>
    );
  }

  const attention = overview?.attention ?? [];
  const counts = overview?.counts;
  const recent = overview?.recent ?? [];
  const attentionCount = overview?.attentionCount ?? 0;
  const summaryLine = todaySummaryLine(attention);
  const isEmptyHome = (counts?.items ?? 0) === 0;

  return (
    <Screen scroll banner="today">
      <Text style={[styles.greeting, { color: colors.text }]}>
        {todayGreeting()}
      </Text>
      <Text style={[styles.date, { color: colors.textSecondary }]}>
        {formatRussianDate(toLocalDateOnly())}
      </Text>

      <Card style={styles.summaryCard}>
        <Text style={[styles.headline, { color: colors.text }]}>
          {todayHeadline(attentionCount)}
        </Text>
        {summaryLine ? (
          <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
            {summaryLine}
          </Text>
        ) : (
          <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
            На ближайшее время важных дел нет.
          </Text>
        )}
      </Card>

      {attentionCount > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.text }]}>
            Требует внимания
          </Text>
          {visibleAttention.map((item) => (
            <AttentionCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onPress={() => navigateAttention(item)}
              onQuickAction={
                item.quickAction
                  ? () => handleQuickAction(item)
                  : undefined
              }
            />
          ))}
          {!showAllAttention && remainingAttention > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllAttention(true)}
              style={styles.showAll}
            >
              <Text style={[styles.showAllText, { color: colors.primary }]}>
                Показать все ({attentionCount})
              </Text>
            </Pressable>
          ) : null}
          {showAllAttention && attentionCount > TODAY_ATTENTION_PREVIEW_LIMIT ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllAttention(false)}
              style={styles.showAll}
            >
              <Text style={[styles.showAllText, { color: colors.primary }]}>
                Свернуть
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {upcoming.length > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.text }]}>Ближайшее</Text>
          {upcoming.map((item) => (
            <AttentionCard
              key={`upcoming:${item.id}`}
              item={item}
              busy={busyId === item.id}
              onPress={() => navigateAttention(item)}
              onQuickAction={
                item.quickAction
                  ? () => handleQuickAction(item)
                  : undefined
              }
            />
          ))}
        </>
      ) : null}

      {recent.length > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.text }]}>Недавнее</Text>
          {recent.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => navigateActivity(item)}
              style={({ pressed }) => [
                styles.recentRow,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text
                style={[styles.recentTitle, { color: colors.text }]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text
                  style={[styles.recentMeta, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {item.subtitle}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </>
      ) : null}

      {counts ? (
        <>
          <Text style={[styles.section, { color: colors.text }]}>Мой дом</Text>
          <Card style={styles.homeCard}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/items')}
              style={styles.homeRow}
            >
              <Text style={[styles.homeStat, { color: colors.text }]}>
                {counts.items} {pluralItems(counts.items)}
              </Text>
            </Pressable>
            <Text style={[styles.homeStatMuted, { color: colors.textSecondary }]}>
              {counts.locations} {pluralRooms(counts.locations)}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/documents')}
              style={styles.homeRow}
            >
              <Text style={[styles.homeStat, { color: colors.text }]}>
                {counts.documents} {pluralDocuments(counts.documents)}
              </Text>
            </Pressable>
            {counts.activeMaintenanceRules > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(tabs)/maintenance')}
                style={styles.homeRow}
              >
                <Text style={[styles.homeStat, { color: colors.text }]}>
                  {counts.activeMaintenanceRules}{' '}
                  {pluralRules(counts.activeMaintenanceRules)}
                </Text>
              </Pressable>
            ) : null}
          </Card>
        </>
      ) : null}

      {isEmptyHome ? (
        <EmptyState
          title="Пока ничего не добавлено"
          message="Добавьте первую вещь, чтобы начать вести каталог имущества."
        />
      ) : null}

      <Button
        title="Добавить вещь"
        onPress={() => router.push('/item/add')}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { ...typography.title },
  date: { ...typography.body, marginBottom: spacing.md },
  summaryCard: { marginBottom: spacing.lg, gap: spacing.xs },
  headline: { ...typography.subtitle },
  summaryLine: { ...typography.body },
  section: {
    ...typography.subtitle,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  showAll: {
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  showAllText: { ...typography.body, fontWeight: '600' },
  recentRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  recentTitle: { ...typography.body, fontWeight: '600' },
  recentMeta: { ...typography.caption, marginTop: 2 },
  homeCard: { gap: spacing.xs, marginBottom: spacing.sm },
  homeRow: { minHeight: 36, justifyContent: 'center' },
  homeStat: { ...typography.body, fontWeight: '600' },
  homeStatMuted: { ...typography.body },
  cta: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
