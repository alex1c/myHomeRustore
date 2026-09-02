/**
 * Maintenance create/edit form — title presets, interval, due mode, reminders.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateOnlyField } from '@/components/forms/DateOnlyField';
import { TextField } from '@/components/ui/TextField';
import {
  ALL_MAINTENANCE_REMINDER_OFFSETS,
  MAINTENANCE_TITLE_PRESETS,
  type MaintenanceFormValues,
} from '@/src/domain/maintenance';
import type { IntervalUnit } from '@/src/domain/types';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

const DAY_PRESETS = [7, 30, 90] as const;
const MONTH_PRESETS = [1, 3, 6, 12] as const;

type MaintenanceFormProps = {
  values: MaintenanceFormValues;
  onChange: (values: MaintenanceFormValues) => void;
};

export function MaintenanceForm({ values, onChange }: MaintenanceFormProps) {
  const colors = useThemeColors();

  const patch = (partial: Partial<MaintenanceFormValues>) => {
    onChange({ ...values, ...partial });
  };

  const selectInterval = (intervalValue: number, intervalUnit: IntervalUnit) => {
    patch({ intervalValue, intervalUnit });
  };

  const toggleOffset = (offset: number) => {
    const has = values.reminderOffsets.includes(offset);
    const next = has
      ? values.reminderOffsets.filter((o) => o !== offset)
      : [...values.reminderOffsets, offset].sort((a, b) => b - a);
    patch({ reminderOffsets: next });
  };

  const offsetLabel = (offset: number): string => {
    if (offset === 0) return 'В день';
    return `За ${offset} дн.`;
  };

  return (
    <View>
      <Text style={[styles.section, { color: colors.textSecondary }]}>Название</Text>
      <View style={styles.chipRow}>
        {MAINTENANCE_TITLE_PRESETS.map((preset) => {
          const selected = values.title === preset;
          return (
            <Pressable
              key={preset}
              accessibilityRole="button"
              onPress={() =>
                patch({ title: preset === 'Другое' ? values.title : preset })
              }
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
                {preset}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label="Название работы"
        value={values.title}
        onChangeText={(title) => patch({ title })}
        placeholder="Очистить фильтр"
      />

      <TextField
        label="Заметка (необязательно)"
        value={values.note}
        onChangeText={(note) => patch({ note })}
        multiline
      />

      <Text style={[styles.section, { color: colors.textSecondary }]}>
        Периодичность
      </Text>
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

      <TextField
        label="Свой интервал (число)"
        value={
          values.intervalValue != null &&
          !DAY_PRESETS.includes(values.intervalValue as (typeof DAY_PRESETS)[number]) &&
          !(
            values.intervalUnit === 'month' &&
            MONTH_PRESETS.includes(values.intervalValue as (typeof MONTH_PRESETS)[number])
          )
            ? String(values.intervalValue)
            : ''
        }
        onChangeText={(text) => {
          const parsed = Number(text);
          if (Number.isInteger(parsed) && parsed > 0) {
            patch({
              intervalValue: parsed,
              intervalUnit: values.intervalUnit ?? 'day',
            });
          }
        }}
        keyboardType="number-pad"
        placeholder="14"
      />

      <View style={styles.chipRow}>
        <Pressable
          onPress={() => patch({ intervalUnit: 'day' })}
          style={[
            styles.chip,
            {
              borderColor:
                values.intervalUnit === 'day' ? colors.primary : colors.border,
              backgroundColor:
                values.intervalUnit === 'day' ? colors.primarySoft : colors.surface,
            },
          ]}
        >
          <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>
            Ед.: дни
          </Text>
        </Pressable>
        <Pressable
          onPress={() => patch({ intervalUnit: 'month' })}
          style={[
            styles.chip,
            {
              borderColor:
                values.intervalUnit === 'month' ? colors.primary : colors.border,
              backgroundColor:
                values.intervalUnit === 'month'
                  ? colors.primarySoft
                  : colors.surface,
            },
          ]}
        >
          <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>
            Ед.: месяцы
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.section, { color: colors.textSecondary }]}>
        Когда следующее
      </Text>
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
          <Text
            style={[
              styles.chipLabel,
              {
                color:
                  values.dueMode === 'from_today'
                    ? colors.primary
                    : colors.textSecondary,
              },
            ]}
          >
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
          <Text
            style={[
              styles.chipLabel,
              {
                color:
                  values.dueMode === 'explicit'
                    ? colors.primary
                    : colors.textSecondary,
              },
            ]}
          >
            Указать дату
          </Text>
        </Pressable>
      </View>

      {values.dueMode === 'explicit' ? (
        <DateOnlyField
          label="Следующее обслуживание"
          value={values.nextDueDate}
          onChange={(nextDueDate) => patch({ nextDueDate, dueMode: 'explicit' })}
        />
      ) : null}

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: values.remindersEnabled }}
        onPress={() => patch({ remindersEnabled: !values.remindersEnabled })}
        style={styles.reminderToggle}
      >
        <Text style={[styles.section, { color: colors.text }]}>Напомнить</Text>
        <Text style={{ color: colors.textSecondary, ...typography.caption }}>
          {values.remindersEnabled ? 'Включено' : 'Выключено'}
        </Text>
      </Pressable>

      {values.remindersEnabled ? (
        <View style={styles.chipRow}>
          {ALL_MAINTENANCE_REMINDER_OFFSETS.map((offset) => {
            const selected = values.reminderOffsets.includes(offset);
            return (
              <Pressable
                key={offset}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleOffset(offset)}
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
                  {selected ? '✓ ' : ''}
                  {offsetLabel(offset)}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
  hint: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
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
  chipLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  reminderToggle: {
    marginBottom: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
});
