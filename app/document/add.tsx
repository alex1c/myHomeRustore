/**
 * Add document to an item (receipt, manual, etc.).
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DocumentFilePicker } from '@/components/documents/DocumentFilePicker';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  EMPTY_DOCUMENT_FORM,
  type DocumentFormValues,
} from '@/src/domain/documents';
import type { DocumentType } from '@/src/domain/types';
import { AppError } from '@/src/domain/errors';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import type { PendingDocumentFile } from '@/src/services/documentService';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

export default function AddDocumentScreen() {
  const { itemId, type: typeParam } = useLocalSearchParams<{
    itemId: string;
    type?: string;
  }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { documentService, inventory } = useDatabase();
  const initialType =
    typeParam && DOCUMENT_TYPES.includes(typeParam as DocumentType)
      ? (typeParam as DocumentType)
      : EMPTY_DOCUMENT_FORM.type;

  const [values, setValues] = useState<DocumentFormValues>({
    ...EMPTY_DOCUMENT_FORM,
    type: initialType,
  });
  const [pendingFile, setPendingFile] = useState<PendingDocumentFile | null>(null);
  const [saving, setSaving] = useState(false);

  const itemName = useMemo(() => {
    if (!itemId || !inventory) return null;
    return inventory.getDetail(itemId)?.item.name ?? null;
  }, [itemId, inventory]);

  const handleSave = async () => {
    if (!documentService || !itemId || saving) return;
    if (!pendingFile) {
      Alert.alert('Выберите файл', 'Добавьте фото или документ.');
      return;
    }
    setSaving(true);
    try {
      await documentService.createDocument({
        itemId,
        type: values.type,
        title: values.title,
        file: pendingFile,
      });
      router.back();
    } catch (err) {
      const message = err instanceof AppError ? err.message : 'Не удалось сохранить документ';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Добавить документ' }} />
      <Screen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {itemName ? (
              <Text style={[styles.itemName, { color: colors.textSecondary }]}>
                {itemName}
              </Text>
            ) : null}

            <Text style={[styles.label, { color: colors.textSecondary }]}>Тип</Text>
            <View style={styles.typeRow}>
              {DOCUMENT_TYPES.map((type) => {
                const selected = values.type === type;
                return (
                  <Button
                    key={type}
                    title={DOCUMENT_TYPE_LABELS[type]}
                    variant={selected ? 'primary' : 'secondary'}
                    onPress={() => setValues((v) => ({ ...v, type }))}
                    style={styles.typeBtn}
                  />
                );
              })}
            </View>

            <TextField
              label="Название (необязательно)"
              value={values.title}
              onChangeText={(title) => setValues((v) => ({ ...v, title }))}
              placeholder={DOCUMENT_TYPE_LABELS[values.type]}
            />

            <DocumentFilePicker
              onPick={setPendingFile}
              label={pendingFile ? 'Файл выбран' : 'Выбрать файл'}
            />

            <Button
              title={saving ? 'Сохранение…' : 'Сохранить'}
              onPress={() => void handleSave()}
              disabled={saving}
              style={styles.save}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  itemName: {
    ...typography.subtitle,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeBtn: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
  },
  save: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});
