/**
 * Documents tab — global archive with search, type filters, and add entry.
 */

import { type Href, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DocumentCard } from '@/components/documents/DocumentCard';
import { FilterChips } from '@/components/inventory/FilterChips';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  type DocumentFilterType,
  type DocumentListFilters,
} from '@/src/domain/documents';
import type { DocumentListRow } from '@/src/repositories/documentRepository';
import { useActiveProperty } from '@/src/hooks/useActiveProperty';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { subscribeDataReset } from '@/src/services/dataReset';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';

const FILTER_CHIPS = [
  { id: 'all', label: 'Все' },
  ...DOCUMENT_TYPES.map((type) => ({
    id: type,
    label: DOCUMENT_TYPE_LABELS[type],
  })),
];

export default function DocumentsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { ready, documents, items } = useDatabase();
  const { propertyId } = useActiveProperty();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocumentFilterType>('all');
  const [rows, setRows] = useState<DocumentListRow[]>([]);

  const filters: DocumentListFilters = useMemo(
    () => ({ search, type: typeFilter }),
    [search, typeFilter],
  );

  const load = useCallback(() => {
    if (!ready || !documents || !propertyId) return;
    setRows(documents.listForProperty(propertyId, filters));
  }, [ready, documents, propertyId, filters]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => subscribeDataReset(() => load()), [load]);

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
      params: { purpose: 'document' },
    } as Href);
  };

  return (
    <Screen banner="documents">
      <Text style={[styles.title, { color: colors.text }]}>Документы</Text>

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
        selectedId={typeFilter}
        onSelect={(id) => setTypeFilter(id as DocumentFilterType)}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Документов пока нет"
          message={
            itemCount === 0
              ? 'Сначала добавьте вещь, затем сохраните чек или инструкцию.'
              : 'Сохраняйте чеки, гарантийные талоны и инструкции рядом с вещами.'
          }
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.document.id}
          renderItem={({ item: row }) => (
            <DocumentCard
              document={row.document}
              itemName={row.itemName}
              onPress={() =>
                router.push({
                  pathname: '/document/[id]',
                  params: { id: row.document.id },
                })
              }
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      <View style={styles.footer}>
        <Button
          title={
            itemCount === 0 ? 'Добавить вещь' : '+ Добавить документ'
          }
          onPress={openAddFlow}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    marginBottom: spacing.md,
  },
  search: {
    ...typography.body,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  list: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  footer: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
});
