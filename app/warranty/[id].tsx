/**
 * Warranty detail screen.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import type { Document, Warranty } from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { formatRussianDate } from '@/src/utils/formatDate';
import {
  presentWarrantyStatus,
  warrantyTypeLabel,
} from '@/src/utils/warrantyPresentation';
import { resolveWarrantyEndDate } from '@/src/utils/warrantyDate';
import { DOCUMENT_TYPE_LABELS } from '@/src/domain/documents';

export default function WarrantyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { warrantyService, documentService, inventory } = useDatabase();
  const [warranty, setWarranty] = useState<Warranty | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [itemName, setItemName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    if (!warrantyService || !documentService || !inventory || !id) return;
    const w = warrantyService.getById(id);
    setWarranty(w);
    if (w) {
      const detail = inventory.getDetail(w.itemId);
      setItemName(detail?.item.name ?? null);
      const docs = documentService.listByItem(w.itemId).filter(
        (d) => d.type === 'warranty' || d.type === 'receipt',
      );
      setDocuments(docs);
    }
  }, [warrantyService, documentService, inventory, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = () => {
    if (!warranty || deleting) return;
    Alert.alert(
      'Удалить гарантию?',
      'Напоминания будут отменены. Документы вещи сохранятся.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => void handleDelete(),
        },
      ],
    );
  };

  const handleDelete = async () => {
    if (!warrantyService || !id || deleting) return;
    setDeleting(true);
    try {
      await warrantyService.delete(id);
      router.back();
    } catch {
      Alert.alert('Ошибка', 'Не удалось удалить гарантию');
    } finally {
      setDeleting(false);
    }
  };

  if (!warranty) {
    return (
      <>
        <Stack.Screen options={{ title: 'Гарантия' }} />
        <Screen><></></Screen>
      </>
    );
  }

  const endDate = resolveWarrantyEndDate(warranty);
  const status = presentWarrantyStatus(warranty);

  return (
    <>
      <Stack.Screen
        options={{
          title: warrantyTypeLabel(warranty.type),
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={confirmDelete}
              style={styles.headerBtn}
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          ),
        }}
      />
      <Screen scroll>
        <ScrollView>
          {itemName ? (
            <Text style={[styles.itemName, { color: colors.textSecondary }]}>
              {itemName}
            </Text>
          ) : null}

          <Card style={styles.section}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Тип</Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {warrantyTypeLabel(warranty.type)}
            </Text>
            {warranty.provider ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>Провайдер</Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {warranty.provider}
                </Text>
              </>
            ) : null}
            {warranty.startDate ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>Начало</Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {formatRussianDate(warranty.startDate)}
                </Text>
              </>
            ) : null}
            {endDate ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>Окончание</Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {formatRussianDate(endDate)}
                </Text>
              </>
            ) : null}
            <Text style={[styles.label, { color: colors.textMuted }]}>Статус</Text>
            <Text style={[styles.value, { color: colors.text }]}>{status.label}</Text>
            {status.detail ? (
              <Text style={[styles.detail, { color: colors.textSecondary }]}>
                {status.detail}
              </Text>
            ) : null}
            {warranty.note ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>Заметка</Text>
                <Text style={[styles.value, { color: colors.textSecondary }]}>
                  {warranty.note}
                </Text>
              </>
            ) : null}
          </Card>

          {documents.length > 0 ? (
            <Card style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Документы вещи
              </Text>
              {documents.map((doc) => (
                <Pressable
                  key={doc.id}
                  onPress={() => router.push({ pathname: '/document/[id]', params: { id: doc.id } })}
                  style={styles.docRow}
                >
                  <Text style={{ color: colors.text, ...typography.body }}>
                    {doc.title || DOCUMENT_TYPE_LABELS[doc.type]}
                  </Text>
                </Pressable>
              ))}
            </Card>
          ) : null}

          <Button
            title="Редактировать"
            onPress={() => router.push({ pathname: '/warranty/edit/[id]', params: { id: warranty.id } })}
            style={styles.edit}
          />
          <Button
            title="Открыть вещь"
            variant="secondary"
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: warranty.itemId } })}
          />
        </ScrollView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    ...typography.subtitle,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  value: {
    ...typography.body,
  },
  detail: {
    ...typography.caption,
  },
  docRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  edit: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
