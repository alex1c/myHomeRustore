/**
 * Inventory tab — searchable list with filters and FlatList.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterChips } from '@/components/inventory/FilterChips';
import { ItemCard } from '@/components/inventory/ItemCard';
import { AppBanner } from '@/components/ads/AppBanner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TextField } from '@/components/ui/TextField';
import {
  DEFAULT_INVENTORY_FILTERS,
  type InventoryFilters,
  type ItemListRow,
} from '@/src/domain/inventory';
import { useActiveProperty } from '@/src/hooks/useActiveProperty';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import { usePropertyLocations } from '@/src/hooks/usePropertyLocations';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { subscribeDataReset } from '@/src/services/dataReset';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';

type FilterTab = 'all' | 'locations' | 'categories';

export default function ItemsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { propertyId, ready } = useActiveProperty();
  const { inventory, error: dbError } = useDatabase();
  const { list: propertyLocations } = usePropertyLocations(propertyId);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [locationFilterId, setLocationFilterId] = useState('all');
  const [categoryFilterId, setCategoryFilterId] = useState('all');
  const [sortMode, setSortMode] = useState<InventoryFilters['sort']>('recent');
  const [rows, setRows] = useState<ItemListRow[]>([]);
  const [loading, setLoading] = useState(true);

  const extraCategories = useMemo(() => {
    if (!propertyId || !inventory) return [];
    return inventory.listDistinctCategories(propertyId);
  }, [propertyId, inventory]);

  const filters = useMemo<InventoryFilters>(() => {
    const base: InventoryFilters = {
      ...DEFAULT_INVENTORY_FILTERS,
      search: debouncedSearch,
      sort: sortMode,
    };
    if (locationFilterId === 'none') {
      base.location = { type: 'none' };
    } else if (locationFilterId !== 'all') {
      base.location = { type: 'location', locationId: locationFilterId };
    }
    if (categoryFilterId !== 'all') {
      base.category = { type: 'category', category: categoryFilterId };
    }
    return base;
  }, [debouncedSearch, sortMode, locationFilterId, categoryFilterId]);

  const load = useCallback(() => {
    if (!ready || !inventory || !propertyId) return;
    setLoading(true);
    try {
      setRows(inventory.list(propertyId, filters));
    } finally {
      setLoading(false);
    }
  }, [ready, inventory, propertyId, filters]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => subscribeDataReset(() => load()), [load]);

  const locationChips = useMemo(() => {
    const chips = [
      { id: 'all', label: 'Все места' },
      { id: 'none', label: 'Без места' },
      ...propertyLocations.map((l) => ({ id: l.id, label: l.name })),
    ];
    return chips;
  }, [propertyLocations]);

  const categoryChips = useMemo(() => {
    const chips = [{ id: 'all', label: 'Все категории' }];
    for (const cat of extraCategories) {
      chips.push({ id: cat, label: cat });
    }
    return chips;
  }, [extraCategories]);

  const sortChips = [
    { id: 'recent', label: 'Недавние' },
    { id: 'name', label: 'По имени' },
    { id: 'price', label: 'Дороже' },
  ];

  if (!ready && !dbError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const isEmpty = rows.length === 0 && !debouncedSearch && locationFilterId === 'all' && categoryFilterId === 'all';
  const countLabel = `${rows.length} ${pluralItems(rows.length)}`;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.item.id}
        renderItem={({ item }) => (
          <ItemCard row={item} onPress={() => router.push(`/item/${item.item.id}`)} />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 140 },
          isEmpty ? styles.listEmpty : null,
        ]}
        ListHeaderComponent={
          <View>
            <TextField
              value={search}
              onChangeText={setSearch}
              placeholder="Поиск"
              accessibilityLabel="Поиск"
            />

            <View style={styles.tabRow}>
              {(['all', 'locations', 'categories'] as FilterTab[]).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setFilterTab(tab)}
                  style={[
                    styles.tab,
                    filterTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                  ]}
                >
                  <Text style={{ color: filterTab === tab ? colors.primary : colors.textMuted }}>
                    {tab === 'all' ? 'Все' : tab === 'locations' ? 'Комнаты' : 'Категории'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {filterTab === 'locations' ? (
              <FilterChips
                chips={locationChips}
                selectedId={locationFilterId}
                onSelect={setLocationFilterId}
              />
            ) : null}
            {filterTab === 'categories' ? (
              <FilterChips
                chips={categoryChips}
                selectedId={categoryFilterId}
                onSelect={setCategoryFilterId}
              />
            ) : null}

            <FilterChips
              chips={sortChips}
              selectedId={sortMode}
              onSelect={(id) => setSortMode(id as InventoryFilters['sort'])}
            />

            {!isEmpty ? (
              <Text style={[styles.count, { color: colors.textSecondary }]}>{countLabel}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : isEmpty ? (
            <EmptyState
              title="Пока ничего не добавлено"
              message="Добавьте технику, мебель или другую вещь, чтобы хранить информацию о покупке, фото и позже — гарантии и обслуживание."
            />
          ) : (
            <EmptyState title="Ничего не найдено" message="Попробуйте изменить поиск или фильтры." />
          )
        }
      />

      <View
        style={[
          styles.fabWrap,
          { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.background },
        ]}
      >
        <AppBanner placement="inventory" />
        <Button
          title="+ Добавить вещь"
          onPress={() => router.push('/item/add')}
          accessibilityLabel="Добавить вещь"
        />
      </View>
    </View>
  );
}

function pluralItems(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'вещь';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'вещи';
  return 'вещей';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  listEmpty: { flexGrow: 1 },
  tabRow: { flexDirection: 'row', marginBottom: spacing.sm, gap: spacing.md },
  tab: { paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  count: { ...typography.caption, marginBottom: spacing.sm },
  fabWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
  },
});
