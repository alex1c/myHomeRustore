/**
 * Add warranty to an item.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { WarrantyForm } from '@/components/warranty/WarrantyForm';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { AppError } from '@/src/domain/errors';
import {
  EMPTY_WARRANTY_FORM,
  type WarrantyFormValues,
} from '@/src/domain/warranty';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { spacing } from '@/src/theme/tokens';

export default function AddWarrantyScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const { warrantyService, inventory } = useDatabase();
  const [values, setValues] = useState<WarrantyFormValues>(EMPTY_WARRANTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!warrantyService || !itemId) return;
    const defaultStart = warrantyService.getDefaultStartDate(itemId);
    if (defaultStart) {
      queueMicrotask(() => {
        setValues((prev) => ({ ...prev, startDate: defaultStart }));
      });
    }
  }, [warrantyService, itemId]);

  const handleSave = async () => {
    if (!warrantyService || !itemId || saving) return;
    setSaving(true);
    try {
      const result = await warrantyService.create(itemId, values);
      if (result.reminders.permissionDenied && values.remindersEnabled) {
        Alert.alert(
          'Гарантия сохранена',
          'Напоминания отключены в настройках Android.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }
      if (result.reminders.failedCount > 0) {
        Alert.alert(
          'Гарантия сохранена',
          'Не удалось создать одно или несколько напоминаний.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }
      router.back();
    } catch (err) {
      const message = err instanceof AppError ? err.message : 'Не удалось сохранить гарантию';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  const itemName = itemId && inventory ? inventory.getDetail(itemId)?.item.name : null;

  return (
    <>
      <Stack.Screen options={{ title: 'Добавить гарантию' }} />
      <Screen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {itemName ? null : null}
            <WarrantyForm values={values} onChange={setValues} />
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
  save: { marginTop: spacing.md, marginBottom: spacing.xl },
});
