/**
 * Item detail screen.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { WarrantyCard } from '@/components/warranty/WarrantyCard';
import type { ItemDetail } from '@/src/domain/inventory';
import type { Document, Warranty } from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { managedUriFromRelativePath } from '@/src/services/managedFileService';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { formatRussianDate } from '@/src/utils/formatDate';
import { buildBrandModelLine } from '@/src/utils/itemPresentation';
import { formatRubMinor } from '@/src/utils/money';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { inventory, itemDeletion, warrantyService, documentService } = useDatabase();
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    if (!inventory || !id) return;
    setDetail(inventory.getDetail(id));
    if (warrantyService) {
      setWarranties(warrantyService.listByItem(id));
    }
    if (documentService) {
      setDocuments(documentService.listByItem(id));
    }
  }, [inventory, warrantyService, documentService, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = () => {
    if (!detail || deleting) return;
    Alert.alert(
      `Удалить «${detail.item.name}»?`,
      'Будут удалены данные и сохранённое фото вещи. Это действие нельзя отменить.',
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
    if (!id || !itemDeletion || deleting) return;
    setDeleting(true);
    try {
      await itemDeletion.deleteItemWithFiles(id);
      router.replace('/(tabs)/items');
    } catch {
      Alert.alert('Ошибка', 'Не удалось удалить вещь');
    } finally {
      setDeleting(false);
    }
  };

  if (!detail) {
    return (
      <>
        <Stack.Screen options={{ title: 'Вещь' }} />
        <Screen><></></Screen>
      </>
    );
  }

  const { item, purchase, locationName } = detail;
  const photoUri = item.primaryPhotoPath
    ? managedUriFromRelativePath(item.primaryPhotoPath)
    : null;
  const brandModel = buildBrandModelLine(item.brand, item.model);

  return (
    <>
      <Stack.Screen
        options={{
          title: item.name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Удалить"
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
          <View style={[styles.photoWrap, { backgroundColor: colors.surfaceMuted }]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
            ) : (
              <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
            )}
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{item.name}</Text>
          {locationName ? (
            <Text style={[styles.location, { color: colors.textSecondary }]}>
              {locationName}
            </Text>
          ) : null}
          {brandModel ? (
            <Text style={[styles.brandModel, { color: colors.textSecondary }]}>
              {brandModel}
            </Text>
          ) : null}
          <Text style={[styles.category, { color: colors.textMuted }]}>
            {item.category}
          </Text>

          {purchase &&
          (purchase.purchaseDate || purchase.seller || purchase.priceMinor != null) ? (
            <Card style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Покупка</Text>
              {purchase.purchaseDate ? (
                <Text style={[styles.line, { color: colors.text }]}>
                  {formatRussianDate(purchase.purchaseDate)}
                </Text>
              ) : null}
              {purchase.seller ? (
                <Text style={[styles.line, { color: colors.text }]}>{purchase.seller}</Text>
              ) : null}
              {purchase.priceMinor != null ? (
                <Text style={[styles.price, { color: colors.primary }]}>
                  {formatRubMinor(purchase.priceMinor)}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {item.serialNumber || item.note ? (
            <Card style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Информация</Text>
              {item.serialNumber ? (
                <Text style={[styles.line, { color: colors.text }]}>
                  Серийный номер: {item.serialNumber}
                </Text>
              ) : null}
              {item.note ? (
                <Text style={[styles.line, { color: colors.textSecondary }]}>
                  {item.note}
                </Text>
              ) : null}
            </Card>
          ) : null}

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Гарантии</Text>
            {warranties.length === 0 ? (
              <>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Гарантий пока нет
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                  Добавьте гарантию, чтобы не пропустить срок её окончания.
                </Text>
              </>
            ) : (
              warranties.map((w) => (
                <WarrantyCard
                  key={w.id}
                  warranty={w}
                  onPress={() => router.push({ pathname: '/warranty/[id]', params: { id: w.id } })}
                />
              ))
            )}
            <Button
              title="Добавить гарантию"
              variant="secondary"
            onPress={() => router.push({ pathname: '/warranty/add', params: { itemId: item.id } })}
              style={styles.sectionBtn}
            />
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Документы</Text>
            {documents.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Документов пока нет
              </Text>
            ) : (
              documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onPress={() => router.push({ pathname: '/document/[id]', params: { id: doc.id } })}
                />
              ))
            )}
            <View style={styles.docActions}>
              <Button
                title="Добавить чек"
                variant="secondary"
                onPress={() =>
              router.push({ pathname: '/document/add', params: { itemId: item.id, type: 'receipt' } })
                }
                style={styles.docBtn}
              />
              <Button
                title="Добавить документ"
                variant="ghost"
            onPress={() => router.push({ pathname: '/document/add', params: { itemId: item.id } })}
                style={styles.docBtn}
              />
            </View>
          </Card>

          <Button
            title="Редактировать"
            onPress={() => router.push(`/item/edit/${item.id}`)}
            style={styles.edit}
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
  photoWrap: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  photo: { width: '100%', height: '100%' },
  title: { ...typography.title, marginBottom: spacing.xs },
  location: { ...typography.body, marginBottom: spacing.xs },
  brandModel: { ...typography.body, marginBottom: spacing.xs },
  category: { ...typography.caption, marginBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.subtitle, marginBottom: spacing.sm },
  line: { ...typography.body, marginBottom: spacing.xs },
  price: { ...typography.subtitle, marginTop: spacing.xs },
  emptyText: { ...typography.body, marginBottom: spacing.xs },
  emptyHint: { ...typography.caption, marginBottom: spacing.sm },
  sectionBtn: { marginTop: spacing.sm },
  docActions: { marginTop: spacing.sm, gap: spacing.xs },
  docBtn: { marginTop: spacing.xs },
  edit: { marginTop: spacing.md, marginBottom: spacing.xl },
});
