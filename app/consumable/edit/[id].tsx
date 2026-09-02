/**
 * Edit consumable.
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

import { ConsumableForm } from '@/components/consumables/ConsumableForm';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { AppError } from '@/src/domain/errors';
import {
  DEFAULT_CONSUMABLE_REMINDER_OFFSETS,
  type ConsumableFormValues,
} from '@/src/domain/consumables';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { spacing } from '@/src/theme/tokens';
import { toLocalDateOnly } from '@/src/utils/datetime';
import { daysUntilDateOnly } from '@/src/utils/warrantyDate';

export default function EditConsumableScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { consumableService, reminders } = useDatabase();
  const [values, setValues] = useState<ConsumableFormValues | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!consumableService || !reminders || !id) return;
    const consumable = consumableService.getById(id);
    if (!consumable) return;

    const existingReminders = reminders.listByConsumableId(id);
    const offsets =
      existingReminders.length > 0 && consumable.nextDueDate
        ? existingReminders.map((r) => {
            const fireDateOnly = toLocalDateOnly(new Date(r.dueAt));
            return Math.max(
              0,
              daysUntilDateOnly(consumable.nextDueDate!, fireDateOnly),
            );
          })
        : [...DEFAULT_CONSUMABLE_REMINDER_OFFSETS];

    const hasSchedule =
      consumable.nextDueDate != null ||
      (consumable.replacementIntervalValue != null &&
        consumable.replacementIntervalUnit != null);

    queueMicrotask(() => {
      setValues({
        name: consumable.name,
        modelOrArticle: consumable.modelOrArticle ?? '',
        manufacturer: consumable.manufacturer ?? '',
        note: consumable.note ?? '',
        trackStock: consumable.stockQuantity != null,
        stockQuantity: consumable.stockQuantity,
        stockUnit: consumable.stockUnit ?? 'pcs',
        intervalValue: consumable.replacementIntervalValue,
        intervalUnit: consumable.replacementIntervalUnit,
        dueMode: hasSchedule ? 'explicit' : 'none',
        nextDueDate: consumable.nextDueDate,
        reminderOffsets: [...new Set(offsets)],
        remindersEnabled:
          existingReminders.some((r) => r.enabled) ||
          (hasSchedule && existingReminders.length === 0),
      });
    });
  }, [consumableService, reminders, id]);

  const handleSave = async () => {
    if (!consumableService || !id || !values || saving) return;
    setSaving(true);
    try {
      const result = await consumableService.update(id, values);
      if (result.reminders.permissionDenied && values.remindersEnabled) {
        Alert.alert(
          'Расходник сохранён',
          'Напоминания отключены в настройках Android.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }
      router.back();
    } catch (err) {
      const message =
        err instanceof AppError ? err.message : 'Не удалось сохранить';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  if (!values) {
    return (
      <>
        <Stack.Screen options={{ title: 'Редактировать' }} />
        <Screen><></></Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Редактировать' }} />
      <Screen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <ConsumableForm values={values} onChange={setValues} />
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
