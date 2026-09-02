/**
 * Edit maintenance rule.
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

import { MaintenanceForm } from '@/components/maintenance/MaintenanceForm';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { AppError } from '@/src/domain/errors';
import {
  DEFAULT_MAINTENANCE_REMINDER_OFFSETS,
  type MaintenanceFormValues,
} from '@/src/domain/maintenance';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { spacing } from '@/src/theme/tokens';
import { toLocalDateOnly } from '@/src/utils/datetime';
import { daysUntilDateOnly } from '@/src/utils/warrantyDate';

export default function EditMaintenanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { maintenanceService, reminders } = useDatabase();
  const [values, setValues] = useState<MaintenanceFormValues | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!maintenanceService || !reminders || !id) return;
    const rule = maintenanceService.getRuleById(id);
    if (!rule) return;

    const existingReminders = reminders.listByMaintenanceRuleId(id);
    const offsets =
      existingReminders.length > 0 && rule.nextDueDate
        ? existingReminders.map((r) => {
            const fireDateOnly = toLocalDateOnly(new Date(r.dueAt));
            return Math.max(0, daysUntilDateOnly(rule.nextDueDate!, fireDateOnly));
          })
        : [...DEFAULT_MAINTENANCE_REMINDER_OFFSETS];

    queueMicrotask(() => {
      setValues({
        title: rule.title,
        note: rule.note ?? '',
        intervalValue: rule.intervalValue,
        intervalUnit: rule.intervalUnit,
        dueMode: 'explicit',
        nextDueDate: rule.nextDueDate,
        reminderOffsets: [...new Set(offsets)],
        remindersEnabled: existingReminders.some((r) => r.enabled) ||
          existingReminders.length === 0,
      });
    });
  }, [maintenanceService, reminders, id]);

  const handleSave = async () => {
    if (!maintenanceService || !id || !values || saving) return;
    setSaving(true);
    try {
      const result = await maintenanceService.update(id, values);
      if (result.reminders.permissionDenied && values.remindersEnabled) {
        Alert.alert(
          'Обслуживание сохранено',
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
            <MaintenanceForm values={values} onChange={setValues} />
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
