/**
 * Item chooser used before document / maintenance / consumable create flows.
 * Keeps data item-centric without requiring users to dig into item detail first.
 */

import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { DEFAULT_INVENTORY_FILTERS } from '@/src/domain/inventory';
import { useActiveProperty } from '@/src/hooks/useActiveProperty';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';
import { buildBrandModelLine } from '@/src/utils/itemPresentation';

type SelectPurpose = 'document' | 'maintenance' | 'consumable';

const TITLES: Record<SelectPurpose, string> = {
  document: 'Выберите вещь',
  maintenance: 'Выберите вещь',
  consumable: 'Выберите вещь',
};

const HINTS: Record<SelectPurpose, string> = {
  document: 'Документ будет привязан к выбранной вещи.',
  maintenance: 'Обслуживание будет привязано к выбранной вещи.',
  consumable: 'Расходник будет привязан к выбранной вещи.',
};

function resolvePurpose(raw: string | undefined): SelectPurpose {
  if (raw === 'maintenance' || raw === 'consumable' || raw === 'document') {
    return raw;
  }
  return 'document';
}

export default function SelectItemScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { purpose: purposeParam } = useLocalSearchParams<{ purpose?: string }>();
  const purpose = resolvePurpose(purposeParam);
  const { propertyId } = useActiveProperty();
  const { inventory } = useDatabase();

  const rows = useMemo(() => {
    if (!propertyId || !inventory) return [];
    return inventory.list(propertyId, {
      ...DEFAULT_INVENTORY_FILTERS,
      sort: 'name',
    });
  }, [propertyId, inventory]);

  const handleSelect = (itemId: string) => {
    if (purpose === 'document') {
      router.replace({ pathname: '/document/add', params: { itemId } });
      return;
    }
    if (purpose === 'maintenance') {
      router.replace({ pathname: '/maintenance/add', params: { itemId } });
      return;
    }
    router.replace({ pathname: '/consumable/add', params: { itemId } });
  };

  return (
    <>
      <Stack.Screen options={{ title: TITLES[purpose] }} />
      <Screen>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {HINTS[purpose]}
        </Text>

        {rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              title="Сначала добавьте вещь"
              message="Документы, обслуживание и расходники привязываются к вещам."
            />
            <Button
              title="Добавить вещь"
              onPress={() => router.push('/item/add' as Href)}
            />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(row) => row.item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item: row }) => {
              const subtitle = buildBrandModelLine(row.item.brand, row.item.model);
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleSelect(row.item.id)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.rowTitle, { color: colors.text }]}>
                    {row.item.name}
                  </Text>
                  {subtitle ? (
                    <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
                      {subtitle}
                    </Text>
                  ) : null}
                  {row.locationName ? (
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                      {row.locationName}
                    </Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  list: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
    justifyContent: 'center',
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
