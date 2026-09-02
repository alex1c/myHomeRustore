/**
 * Global maintenance tab — searchable list with status filters.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { MaintenanceCard } from '@/components/maintenance/MaintenanceCard';
import { FilterChips } from '@/components/inventory/FilterChips';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import type { MaintenanceFilter } from '@/src/domain/maintenance';
import type { MaintenanceListRow } from '@/src/repositories/maintenanceRepository';
import { useActiveProperty } from '@/src/hooks/useActiveProperty';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { formatRussianDate } from '@/src/utils/formatDate';
import { toLocalDateOnly } from '@/src/utils/datetime';

const FILTER_CHIPS = [
  { id: 'all', label: 'Все' },
  { id: 'overdue', label: 'Просрочено' },
  { id: 'upcoming', label: 'Скоро' },
];

export default function MaintenanceScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { ready, maintenanceService } = useDatabase();
  const { propertyId } = useActiveProperty();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MaintenanceFilter>('all');
  const [rows, setRows] = useState<MaintenanceListRow[]>([]);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!ready || !maintenanceService || !propertyId) return;
    setRows(
      maintenanceService.listForProperty(propertyId, { search, filter }),
    );
  }, [ready, maintenanceService, propertyId, search, filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleMarkDone = async (ruleId: string) => {
    if (!maintenanceService || markingId) return;
    setMarkingId(ruleId);
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
      setMarkingId(null);
    }
  };

  const emptyMessage = useMemo(() => {
    if (filter === 'overdue') return 'Нет просроченных работ.';
    if (filter === 'upcoming') return 'Нет предстоящих работ.';
    return 'Добавьте обслуживание в карточке вещи.';
  }, [filter]);

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.text }]}>Обслуживание</Text>
      <Text style={[styles.date, { color: colors.textSecondary }]}>
        {toLocalDateOnly()}
      </Text>

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
        chips={FILTER_CHIPS}
        selectedId={filter}
        onSelect={(id) => setFilter(id as MaintenanceFilter)}
      />

      {rows.length === 0 ? (
        <EmptyState title="Нет задач" message={emptyMessage} />
      ) : (
        <FlatList
          data={rows}
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
              markingDone={markingId === row.rule.id}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title },
  date: { ...typography.body, marginBottom: spacing.md },
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
});
