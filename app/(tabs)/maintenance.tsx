/**
 * Maintenance tab with ТО / Расходники switch.
 */

import { type Href, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ConsumableCard } from '@/components/consumables/ConsumableCard';
import { MaintenanceCard } from '@/components/maintenance/MaintenanceCard';
import { FilterChips } from '@/components/inventory/FilterChips';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import type { ConsumableFilter } from '@/src/domain/consumables';
import type { MaintenanceFilter } from '@/src/domain/maintenance';
import type { ConsumableListRow } from '@/src/repositories/consumableRepository';
import type { MaintenanceListRow } from '@/src/repositories/maintenanceRepository';
import { AppError } from '@/src/domain/errors';
import { useActiveProperty } from '@/src/hooks/useActiveProperty';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { subscribeDataReset } from '@/src/services/dataReset';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';
import { formatRussianDate } from '@/src/utils/formatDate';
import { toLocalDateOnly } from '@/src/utils/datetime';

type TabMode = 'maintenance' | 'consumables';

const MAINTENANCE_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'overdue', label: 'Просрочено' },
  { id: 'upcoming', label: 'Скоро' },
];

const CONSUMABLE_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'attention', label: 'Требуют внимания' },
  { id: 'out_of_stock', label: 'Нет в запасе' },
];

export default function MaintenanceScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { ready, maintenanceService, consumableService, items } = useDatabase();
  const { propertyId } = useActiveProperty();
  const [mode, setMode] = useState<TabMode>('maintenance');
  const [search, setSearch] = useState('');
  const [maintenanceFilter, setMaintenanceFilter] =
    useState<MaintenanceFilter>('all');
  const [consumableFilter, setConsumableFilter] =
    useState<ConsumableFilter>('all');
  const [maintenanceRows, setMaintenanceRows] = useState<MaintenanceListRow[]>([]);
  const [consumableRows, setConsumableRows] = useState<ConsumableListRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const itemCount = useMemo(() => {
    if (!items || !propertyId) return 0;
    return items.countActive(propertyId);
  }, [items, propertyId]);

  const openAddFlow = () => {
    if (itemCount === 0) {
      router.push('/item/add' as Href);
      return;
    }
    router.push({
      pathname: '/select-item',
      params: {
        purpose: mode === 'maintenance' ? 'maintenance' : 'consumable',
      },
    } as Href);
  };

  const load = useCallback(() => {
    if (!ready || !propertyId) return;
    if (mode === 'maintenance' && maintenanceService) {
      setMaintenanceRows(
        maintenanceService.listForProperty(propertyId, {
          search,
          filter: maintenanceFilter,
        }),
      );
    }
    if (mode === 'consumables' && consumableService) {
      setConsumableRows(
        consumableService.listForProperty(propertyId, {
          search,
          filter: consumableFilter,
        }),
      );
    }
  }, [
    ready,
    propertyId,
    mode,
    maintenanceService,
    consumableService,
    search,
    maintenanceFilter,
    consumableFilter,
  ]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => subscribeDataReset(() => load()), [load]);

  const handleMarkDone = async (ruleId: string) => {
    if (!maintenanceService || busyId) return;
    setBusyId(ruleId);
    try {
      const result = await maintenanceService.markDone(ruleId);
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
    } catch {
      Alert.alert('Ошибка', 'Не удалось отметить выполнение');
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkReplaced = async (consumableId: string, allowZero = false) => {
    if (!consumableService || busyId) return;
    setBusyId(consumableId);
    try {
      const result = await consumableService.markReplaced(
        consumableId,
        toLocalDateOnly(),
        null,
        { allowZeroStock: allowZero },
      );
      const next = result.consumable.nextDueDate
        ? formatRussianDate(result.consumable.nextDueDate)
        : null;
      Alert.alert(
        'Готово',
        next ? `Замена отмечена\nСледующая замена — ${next}` : 'Замена отмечена',
      );
      load();
    } catch (err) {
      if (err instanceof AppError && err.code === 'STOCK_ZERO_CONFIRM') {
        Alert.alert('В запасе указано 0 шт.', 'Отметить замену всё равно?', [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Отметить',
            onPress: () => void handleMarkReplaced(consumableId, true),
          },
        ]);
        return;
      }
      Alert.alert('Ошибка', 'Не удалось отметить замену');
    } finally {
      setBusyId(null);
    }
  };

  const emptyMessage = useMemo(() => {
    if (itemCount === 0) {
      return 'Сначала добавьте вещь, затем запланируйте обслуживание.';
    }
    if (mode === 'maintenance') {
      if (maintenanceFilter === 'overdue') return 'Нет просроченных работ.';
      if (maintenanceFilter === 'upcoming') return 'Нет предстоящих работ.';
      return 'Добавьте обслуживание для выбранной вещи.';
    }
    if (consumableFilter === 'out_of_stock') return 'Нет расходников с нулевым запасом.';
    if (consumableFilter === 'attention') return 'Сейчас ничего не требует внимания.';
    return 'Добавьте расходник для выбранной вещи.';
  }, [mode, maintenanceFilter, consumableFilter, itemCount]);

  return (
    <Screen banner="maintenance">
      <Text style={[styles.title, { color: colors.text }]}>Обслуживание</Text>
      <Text style={[styles.date, { color: colors.textSecondary }]}>
        {toLocalDateOnly()}
      </Text>

      <View style={styles.modeRow}>
        {([
          ['maintenance', 'ТО'],
          ['consumables', 'Расходники'],
        ] as const).map(([id, label]) => {
          const selected = mode === id;
          return (
            <Pressable
              key={id}
              onPress={() => {
                setMode(id);
                setSearch('');
              }}
              style={[
                styles.modeChip,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.modeLabel,
                  { color: selected ? colors.primary : colors.textSecondary },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        placeholder="Поиск"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        style={[
          styles.search,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      />

      <FilterChips
        chips={mode === 'maintenance' ? MAINTENANCE_FILTERS : CONSUMABLE_FILTERS}
        selectedId={mode === 'maintenance' ? maintenanceFilter : consumableFilter}
        onSelect={(id) => {
          if (mode === 'maintenance') {
            setMaintenanceFilter(id as MaintenanceFilter);
          } else {
            setConsumableFilter(id as ConsumableFilter);
          }
        }}
      />

      {mode === 'maintenance' ? (
        maintenanceRows.length === 0 ? (
          <EmptyState title="Нет задач" message={emptyMessage} />
        ) : (
          <FlatList
            data={maintenanceRows}
            keyExtractor={(row) => row.rule.id}
            contentContainerStyle={styles.list}
            renderItem={({ item: row }) => (
              <MaintenanceCard
                rule={row.rule}
                itemName={row.itemName}
                onPress={() =>
                  router.push({
                    pathname: '/maintenance/[id]',
                    params: { id: row.rule.id },
                  })
                }
                onMarkDone={() => void handleMarkDone(row.rule.id)}
                markingDone={busyId === row.rule.id}
              />
            )}
          />
        )
      ) : consumableRows.length === 0 ? (
        <EmptyState title="Нет расходников" message={emptyMessage} />
      ) : (
        <FlatList
          data={consumableRows}
          keyExtractor={(row) => row.consumable.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: row }) => (
            <ConsumableCard
              consumable={row.consumable}
              itemName={row.itemName}
              onPress={() =>
                router.push({
                  pathname: '/consumable/[id]',
                  params: { id: row.consumable.id },
                })
              }
              onMarkReplaced={() => void handleMarkReplaced(row.consumable.id)}
              marking={busyId === row.consumable.id}
            />
          )}
        />
      )}

      <View style={styles.footer}>
        <Button
          title={
            itemCount === 0
              ? 'Добавить вещь'
              : mode === 'maintenance'
                ? '+ Добавить обслуживание'
                : '+ Добавить расходник'
          }
          onPress={openAddFlow}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title },
  date: { ...typography.body, marginBottom: spacing.md },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.lg,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeLabel: { ...typography.body, fontWeight: '600' },
  search: {
    ...typography.body,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  footer: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
});
