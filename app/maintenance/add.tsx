/**
 * Add maintenance rule for an item — templates then form.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MaintenanceForm } from '@/components/maintenance/MaintenanceForm';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { AppError } from '@/src/domain/errors';
import {
  EMPTY_MAINTENANCE_FORM,
  type MaintenanceFormValues,
} from '@/src/domain/maintenance';
import {
  formatIntervalLabel,
  suggestMaintenanceTemplates,
  type MaintenanceTemplate,
} from '@/src/domain/maintenanceTemplates';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

export default function AddMaintenanceScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { maintenanceService, inventory } = useDatabase();
  const [step, setStep] = useState<'templates' | 'form'>('templates');
  const [values, setValues] = useState<MaintenanceFormValues>(EMPTY_MAINTENANCE_FORM);
  const [saving, setSaving] = useState(false);

  const item = useMemo(() => {
    if (!itemId || !inventory) return null;
    return inventory.getDetail(itemId)?.item ?? null;
  }, [itemId, inventory]);

  const templates = useMemo(() => {
    if (!item) return [];
    return suggestMaintenanceTemplates({
      category: item.category,
      name: item.name,
    });
  }, [item]);

  useEffect(() => {
    if (templates.length === 0) {
      queueMicrotask(() => setStep('form'));
    }
  }, [templates.length]);

  const applyTemplate = (template: MaintenanceTemplate) => {
    setValues({
      ...EMPTY_MAINTENANCE_FORM,
      title: template.title,
      intervalValue: template.intervalValue,
      intervalUnit: template.intervalUnit,
    });
    setStep('form');
  };

  const handleSave = async () => {
    if (!maintenanceService || !itemId || saving) return;
    if (!values.title.trim()) {
      Alert.alert('Ошибка', 'Введите название работы');
      return;
    }
    setSaving(true);
    try {
      const result = await maintenanceService.create(itemId, values);
      if (result.reminders.permissionDenied && values.remindersEnabled) {
        Alert.alert(
          'Обслуживание сохранено',
          'Напоминания отключены в настройках Android.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }
      if (result.reminders.failedCount > 0) {
        Alert.alert(
          'Обслуживание сохранено',
          'Не удалось создать напоминание.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }
      router.back();
    } catch (err) {
      const message =
        err instanceof AppError ? err.message : 'Не удалось сохранить обслуживание';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Добавить обслуживание' }} />
      <Screen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {item ? (
              <Text style={[styles.itemName, { color: colors.textSecondary }]}>
                {item.name}
              </Text>
            ) : null}

            {step === 'templates' && templates.length > 0 ? (
              <View>
                <Text style={[styles.section, { color: colors.text }]}>
                  Рекомендуемые
                </Text>
                <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
                  Интервалы примерные — ориентируйтесь на инструкцию производителя.
                </Text>
                {templates.map((template) => (
                  <Pressable
                    key={template.id}
                    onPress={() => applyTemplate(template)}
                    style={[
                      styles.templateRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <Text style={[styles.templateTitle, { color: colors.text }]}>
                      {template.title}
                    </Text>
                    <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                      {formatIntervalLabel(template.intervalValue, template.intervalUnit)}
                    </Text>
                  </Pressable>
                ))}
                <Button
                  title="Другое"
                  variant="secondary"
                  onPress={() => setStep('form')}
                  style={styles.other}
                />
              </View>
            ) : (
              <>
                {templates.length > 0 ? (
                  <Button
                    title="К рекомендациям"
                    variant="ghost"
                    onPress={() => setStep('templates')}
                    style={styles.backTemplates}
                  />
                ) : null}
                <MaintenanceForm values={values} onChange={setValues} />
                <Button
                  title={saving ? 'Сохранение…' : 'Сохранить'}
                  onPress={() => void handleSave()}
                  disabled={saving}
                  style={styles.save}
                />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  itemName: { ...typography.subtitle, marginBottom: spacing.md },
  section: { ...typography.subtitle, marginBottom: spacing.xs },
  disclaimer: { ...typography.caption, marginBottom: spacing.md },
  templateRow: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 56,
    gap: 4,
  },
  templateTitle: { ...typography.body, fontWeight: '600' },
  other: { marginTop: spacing.md, marginBottom: spacing.xl },
  backTemplates: { marginBottom: spacing.sm },
  save: { marginTop: spacing.md, marginBottom: spacing.xl },
});
