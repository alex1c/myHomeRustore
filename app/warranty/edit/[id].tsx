/**
 * Edit existing warranty.
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
  DEFAULT_WARRANTY_REMINDER_OFFSETS,
  type WarrantyFormValues,
  type WarrantyType,
} from '@/src/domain/warranty';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { spacing } from '@/src/theme/tokens';

export default function EditWarrantyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { warrantyService, reminders } = useDatabase();
  const [values, setValues] = useState<WarrantyFormValues | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!warrantyService || !reminders || !id) return;
    const warranty = warrantyService.getById(id);
    if (!warranty) return;

    const existingReminders = reminders.listByWarrantyId(id);
    const offsets = existingReminders.length > 0
      ? existingReminders.map((r) => {
          const end = warrantyService.resolveEndDate(warranty);
          if (!end) return 30;
          const endMs = new Date(`${end}T12:00:00`).getTime();
          const dueMs = new Date(r.dueAt).getTime();
          return Math.max(1, Math.round((endMs - dueMs) / 86_400_000));
        })
      : [...DEFAULT_WARRANTY_REMINDER_OFFSETS];

    queueMicrotask(() => {
      setValues({
        type: warranty.type as WarrantyType,
        provider: warranty.provider ?? '',
        startDate: warranty.startDate,
        durationMonths: warranty.durationMonths,
        endDate: warranty.endDate,
        note: warranty.note ?? '',
        reminderOffsets: offsets,
        remindersEnabled: existingReminders.some((r) => r.enabled),
      });
    });
  }, [warrantyService, reminders, id]);

  const handleSave = async () => {
    if (!warrantyService || !id || !values || saving) return;
    setSaving(true);
    try {
      const result = await warrantyService.update(id, values);
      if (result.reminders.permissionDenied && values.remindersEnabled) {
        Alert.alert(
          'Гарантия сохранена',
          'Напоминания отключены в настройках Android.',
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

  if (!values) {
    return (
      <>
        <Stack.Screen options={{ title: 'Редактировать гарантию' }} />
        <Screen><></></Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Редактировать гарантию' }} />
      <Screen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
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
