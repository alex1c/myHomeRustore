/**
 * Document detail — view file or delete.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { DOCUMENT_TYPE_LABELS } from '@/src/domain/documents';
import type { Document } from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { formatRussianDate } from '@/src/utils/formatDate';
import { openDocumentFile } from '@/src/utils/openDocument';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { documentService, inventory } = useDatabase();
  const [document, setDocument] = useState<Document | null>(null);
  const [itemName, setItemName] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    if (!documentService || !inventory || !id) return;
    const doc = documentService.getById(id);
    setDocument(doc);
    if (doc) {
      setItemName(inventory.getDetail(doc.itemId)?.item.name ?? null);
    }
  }, [documentService, inventory, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleOpen = async () => {
    if (!document) return;
    await openDocumentFile(document, (uri) => setImageUri(uri));
  };

  const confirmDelete = () => {
    if (!document || deleting) return;
    Alert.alert(
      `Удалить документ «${document.title}»?`,
      'Файл будет удалён из приложения.',
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
    if (!documentService || !id || deleting) return;
    setDeleting(true);
    try {
      await documentService.deleteDocument(id);
      router.back();
    } catch {
      Alert.alert('Ошибка', 'Не удалось удалить документ');
    } finally {
      setDeleting(false);
    }
  };

  if (!document) {
    return (
      <>
        <Stack.Screen options={{ title: 'Документ' }} />
        <Screen><></></Screen>
      </>
    );
  }

  const created = document.createdAt.slice(0, 10);

  return (
    <>
      <Stack.Screen
        options={{
          title: document.title,
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
          <Card style={styles.section}>
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              {DOCUMENT_TYPE_LABELS[document.type]}
            </Text>
            {itemName ? (
              <Text style={[styles.itemName, { color: colors.text }]}>{itemName}</Text>
            ) : null}
            <Text style={[styles.date, { color: colors.textSecondary }]}>
              {formatRussianDate(created)}
            </Text>
          </Card>

          <Button title="Открыть" onPress={() => void handleOpen()} />
          <Button
            title="Открыть вещь"
            variant="secondary"
            onPress={() => router.push(`/item/${document.itemId}`)}
            style={styles.secondary}
          />
        </ScrollView>
      </Screen>

      <Modal visible={imageUri != null} transparent animationType="fade">
        <View style={[styles.modal, { backgroundColor: 'rgba(0,0,0,0.92)' }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
            onPress={() => setImageUri(null)}
            style={styles.close}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.fullImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
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
  section: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  meta: {
    ...typography.caption,
  },
  itemName: {
    ...typography.subtitle,
  },
  date: {
    ...typography.body,
  },
  secondary: {
    marginTop: spacing.sm,
  },
  modal: {
    flex: 1,
    justifyContent: 'center',
  },
  close: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 2,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});
