/**
 * Consumable create/edit form.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateOnlyField } from '@/components/forms/DateOnlyField';
import { TextField } from '@/components/ui/TextField';
import {
  ALL_CONSUMABLE_REMINDER_OFFSETS,
  CONSUMABLE_STOCK_UNITS,
  CONSUMABLE_STOCK_UNIT_LABELS,
  type ConsumableFormValues,
} from '@/src/domain/consumables';
import type { IntervalUnit } from '@/src/domain/types';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

const DAY_PRESETS = [7, 30, 90] as const;
const MONTH_PRESETS = [1, 3, 6, 12] as const;

type ConsumableFormProps = {
  values: ConsumableFormValues;
  onChange: (values: ConsumableFormValues) => void;
};

export function ConsumableForm({ values, onChange }: ConsumableFormProps) {
  const colors = useThemeColors();
  const patch = (partial: Partial<ConsumableFormValues>) => {
    onChange({ ...values, ...partial });
  };

  const selectInterval = (intervalValue: number, intervalUnit: IntervalUnit) => {
    patch({
      intervalValue,
      intervalUnit,
      dueMode: values.dueMode === 'none' ? 'from_today' : values.dueMode,
    });
  };

  const toggleOffset = (offset: number) => {
    const has = values.reminderOffsets.includes(offset);
    const next = has
      ? values.reminderOffsets.filter((o) => o !== offset)
      : [...values.reminderOffsets, offset].sort((a, b) => b - a);
    patch({ reminderOffsets: next });
  };

  return (
    <View>
      <TextField
        label="Название"
        value={values.name}
        onChangeText={(name) => patch({ name })}
        placeholder="HEPA-фильтр"
      />
      <TextField
        label="Артикул / модель"
        value={values.modelOrArticle}
        onChangeText={(modelOrArticle) => patch({ modelOrArticle })}
        placeholder="RHF5"
      />
      <TextField
        label="Производитель"
        value={values.manufacturer}
        onChangeText={(manufacturer) => patch({ manufacturer })}
      />
      <TextField
        label="Заметка"
        value={values.note}
        onChangeText={(note) => patch({ note })}
        multiline
      />

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: values.trackStock }}
        onPress={() =>
          patch({
            trackStock: !values.trackStock,
            stockQuantity: !values.trackStock ? (values.stockQuantity ?? 0) : null,
          })
        }
        style={styles.toggle}
      >
        <Text style={[styles.section, { color: colors.text }]}>Вести запас</Text>
        <Text style={{ color: colors.textSecondary, ...typography.caption }}>
          {values.trackStock ? 'Включено' : 'Выключено'}
        </Text>
      </Pressable>

      {values.trackStock ? (
        <>
          <TextField
            label="Количество в запасе"
            value={
              values.stockQuantity != null ? String(values.stockQuantity) : '0'
            }
            onChangeText={(text) => {
              const parsed = Number(text);
              if (text.trim() === '') {
                patch({ stockQuantity: 0 });
                return;
              }
              if (Number.isInteger(parsed) && parsed >= 0) {
                patch({ stockQuantity: parsed });
              }
            }}
            keyboardType="number-pad"
          />
          <View style={styles.chipRow}>
            {CONSUMABLE_STOCK_UNITS.map((unit) => {
              const selected = values.stockUnit === unit;
              return (
                <Pressable
                  key={unit}
                  onPress={() => patch({ stockUnit: unit })}
                  style={[
                    styles.chip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? colors.primarySoft
                        : colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: selected ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {CONSUMABLE_STOCK_UNIT_LABELS[unit]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={[styles.section, { color: colors.textSecondary }]}>
        Период замены
      </Text>
      <View style={styles.chipRow}>
        <Pressable
          onPress={() =>
            patch({
              dueMode: 'none',
              intervalValue: null,
              intervalUnit: null,
              nextDueDate: null,
              remindersEnabled: false,
            })
          }
          style={[
            styles.chip,
            {
              borderColor:
                values.dueMode === 'none' ? colors.primary : colors.border,
              backgroundColor:
                values.dueMode === 'none' ? colors.primarySoft : colors.surface,
            },
          ]}
        >
          <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>
            Без расписания
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.hint, { color: colors.textMuted }]}>Дни</Text>
      <View style={styles.chipRow}>
        {DAY_PRESETS.map((days) => {
          const selected =
            values.intervalUnit === 'day' && values.intervalValue === days;
          return (
            <Pressable
              key={`d-${days}`}
              onPress={() => selectInterval(days, 'day')}
              style={[
                styles.chip,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: selected ? colors.primary : colors.textSecondary },
                ]}
              >
                {days} дн.
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.hint, { color: colors.textMuted }]}>Месяцы</Text>
      <View style={styles.chipRow}>
        {MONTH_PRESETS.map((months) => {
          const selected =
            values.intervalUnit === 'month' && values.intervalValue === months;
          return (
            <Pressable
              key={`m-${months}`}
              onPress={() => selectInterval(months, 'month')}
              style={[
                styles.chip,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: selected ? colors.primary : colors.textSecondary },
                ]}
              >
                {months} мес.
              </Text>
            </Pressable>
          );
        })}
      </View>

      {values.dueMode !== 'none' ? (
        <>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => patch({ dueMode: 'from_today', nextDueDate: null })}
              style={[
                styles.chip,
                {
                  borderColor:
                    values.dueMode === 'from_today' ? colors.primary : colors.border,
                  backgroundColor:
                    values.dueMode === 'from_today'
                      ? colors.primarySoft
                      : colors.surface,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>
                Начать отсчёт сегодня
              </Text>
            </Pressable>
            <Pressable
              onPress={() => patch({ dueMode: 'explicit' })}
              style={[
                styles.chip,
                {
                  borderColor:
                    values.dueMode === 'explicit' ? colors.primary : colors.border,
                  backgroundColor:
                    values.dueMode === 'explicit'
                      ? colors.primarySoft
                      : colors.surface,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>
                Указать дату
              </Text>
            </Pressable>
          </View>
          {values.dueMode === 'explicit' ? (
            <DateOnlyField
              label="Следующая замена"
              value={values.nextDueDate}
              onChange={(nextDueDate) =>
                patch({ nextDueDate, dueMode: 'explicit' })
              }
            />
          ) : null}

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: values.remindersEnabled }}
            onPress={() => patch({ remindersEnabled: !values.remindersEnabled })}
            style={styles.toggle}
          >
            <Text style={[styles.section, { color: colors.text }]}>Напомнить</Text>
            <Text style={{ color: colors.textSecondary, ...typography.caption }}>
              {values.remindersEnabled ? 'Включено' : 'Выключено'}
            </Text>
          </Pressable>
          {values.remindersEnabled ? (
            <View style={styles.chipRow}>
              {ALL_CONSUMABLE_REMINDER_OFFSETS.map((offset) => {
                const selected = values.reminderOffsets.includes(offset);
                const label =
                  offset === 0 ? 'В день' : `За ${offset} дн.`;
                return (
                  <Pressable
                    key={offset}
                    onPress={() => toggleOffset(offset)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected
                          ? colors.primarySoft
                          : colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        {
                          color: selected ? colors.primary : colors.textSecondary,
                        },
                      ]}
                    >
                      {selected ? '✓ ' : ''}
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    ...typography.caption,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  hint: { ...typography.caption, marginBottom: spacing.xs },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipLabel: { ...typography.caption, fontWeight: '600' },
  toggle: { marginBottom: spacing.sm, minHeight: 44, justifyContent: 'center' },
});
