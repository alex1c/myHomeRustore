/**
 * Add consumable — templates then form.
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

import { ConsumableForm } from '@/components/consumables/ConsumableForm';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { AppError } from '@/src/domain/errors';
import {
  EMPTY_CONSUMABLE_FORM,
  type ConsumableFormValues,
} from '@/src/domain/consumables';
import {
  formatConsumableIntervalLabel,
  suggestConsumableTemplates,
  type ConsumableTemplate,
} from '@/src/domain/consumableTemplates';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

export default function AddConsumableScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { consumableService, inventory } = useDatabase();
  const [step, setStep] = useState<'templates' | 'form'>('templates');
  const [values, setValues] = useState<ConsumableFormValues>(EMPTY_CONSUMABLE_FORM);
  const [saving, setSaving] = useState(false);

  const item = useMemo(() => {
    if (!itemId || !inventory) return null;
    return inventory.getDetail(itemId)?.item ?? null;
  }, [itemId, inventory]);

  const templates = useMemo(() => {
    if (!item) return [];
    return suggestConsumableTemplates({
      category: item.category,
      name: item.name,
    });
  }, [item]);

  useEffect(() => {
    if (templates.length === 0) {
      queueMicrotask(() => setStep('form'));
    }
  }, [templates.length]);

  const applyTemplate = (template: ConsumableTemplate) => {
    const hasSchedule =
      template.intervalValue != null && template.intervalUnit != null;
    setValues({
      ...EMPTY_CONSUMABLE_FORM,
      name: template.name,
      trackStock: template.suggestStock,
      stockQuantity: template.suggestStock ? 1 : null,
      stockUnit: template.defaultStockUnit,
      intervalValue: template.intervalValue,
      intervalUnit: template.intervalUnit,
      dueMode: hasSchedule ? 'from_today' : 'none',
      remindersEnabled: hasSchedule,
    });
    setStep('form');
  };

  const handleSave = async () => {
    if (!consumableService || !itemId || saving) return;
    if (!values.name.trim()) {
      Alert.alert('Ошибка', 'Введите название расходника');
      return;
    }
    setSaving(true);
    try {
      const result = await consumableService.create(itemId, values);
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
        err instanceof AppError ? err.message : 'Не удалось сохранить расходник';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Добавить расходник' }} />
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
                  Сроки примерные — ориентируйтесь на инструкцию производителя и
                  фактический износ.
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
                      {template.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                      {template.intervalValue != null && template.intervalUnit
                        ? formatConsumableIntervalLabel(
                            template.intervalValue,
                            template.intervalUnit,
                          )
                        : 'Только учёт запаса'}
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
                    style={styles.back}
                  />
                ) : null}
                <ConsumableForm values={values} onChange={setValues} />
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
  back: { marginBottom: spacing.sm },
  save: { marginTop: spacing.md, marginBottom: spacing.xl },
});
