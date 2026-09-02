/**
 * Warranty create/edit form — short UX with duration or end-date modes.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateOnlyField } from '@/components/forms/DateOnlyField';
import { TextField } from '@/components/ui/TextField';
import {
  ALL_WARRANTY_REMINDER_OFFSETS,
  DEFAULT_WARRANTY_REMINDER_OFFSETS,
  WARRANTY_DURATION_PRESETS,
  WARRANTY_TYPES,
  WARRANTY_TYPE_LABELS,
  type WarrantyFormValues,
  type WarrantyType,
} from '@/src/domain/warranty';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

type DurationMode = 'months' | 'end_date';

type WarrantyFormProps = {
  values: WarrantyFormValues;
  onChange: (values: WarrantyFormValues) => void;
};

export function WarrantyForm({ values, onChange }: WarrantyFormProps) {
  const colors = useThemeColors();
  const [durationMode, setDurationMode] = useState<DurationMode>(
    values.endDate ? 'end_date' : 'months',
  );
  const [customMonths, setCustomMonths] = useState(
    values.durationMonths != null &&
      !WARRANTY_DURATION_PRESETS.includes(
        values.durationMonths as (typeof WARRANTY_DURATION_PRESETS)[number],
      )
      ? String(values.durationMonths)
      : '',
  );

  const patch = (partial: Partial<WarrantyFormValues>) => {
    onChange({ ...values, ...partial });
  };

  const selectType = (type: WarrantyType) => patch({ type });

  const selectDurationPreset = (months: number) => {
    setDurationMode('months');
    patch({ durationMonths: months, endDate: null });
  };

  const switchToEndDate = () => {
    setDurationMode('end_date');
    patch({ endDate: values.endDate, durationMonths: null });
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
      <Text style={[styles.section, { color: colors.textSecondary }]}>Тип</Text>
      <View style={styles.typeRow}>
        {WARRANTY_TYPES.map((type) => {
          const selected = values.type === type;
          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectType(type)}
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
                {WARRANTY_TYPE_LABELS[type]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label="Кто предоставляет (необязательно)"
        value={values.provider}
        onChangeText={(provider) => patch({ provider })}
        placeholder="LG, DNS, М.Видео…"
      />

      <DateOnlyField
        label="Начало гарантии"
        value={values.startDate}
        onChange={(startDate) => patch({ startDate })}
      />

      <Text style={[styles.section, { color: colors.textSecondary }]}>Срок</Text>
      <View style={styles.typeRow}>
        {WARRANTY_DURATION_PRESETS.map((months) => {
          const selected =
            durationMode === 'months' && values.durationMonths === months;
          return (
            <Pressable
              key={months}
              accessibilityRole="button"
              onPress={() => selectDurationPreset(months)}
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
        label="Свой срок (месяцев)"
        value={customMonths}
        onChangeText={(text) => {
          setCustomMonths(text);
          const parsed = Number(text);
          if (Number.isInteger(parsed) && parsed > 0) {
            setDurationMode('months');
            patch({ durationMonths: parsed, endDate: null });
          }
        }}
        keyboardType="number-pad"
        placeholder="18"
      />

      <Pressable
        accessibilityRole="button"
        onPress={switchToEndDate}
        style={[
          styles.endDateToggle,
          {
            borderColor:
              durationMode === 'end_date' ? colors.primary : colors.border,
            backgroundColor:
              durationMode === 'end_date' ? colors.primarySoft : colors.surface,
          },
        ]}
      >
        <Text
          style={{
            color:
              durationMode === 'end_date' ? colors.primary : colors.textSecondary,
            ...typography.body,
          }}
        >
          Указать дату окончания
        </Text>
      </Pressable>

      {durationMode === 'end_date' ? (
        <DateOnlyField
          label="Действует до"
          value={values.endDate}
          onChange={(endDate) => patch({ endDate, durationMonths: null })}
        />
      ) : null}

      <TextField
        label="Заметка (необязательно)"
        value={values.note}
        onChangeText={(note) => patch({ note })}
        multiline
      />

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: values.remindersEnabled }}
        onPress={() => patch({ remindersEnabled: !values.remindersEnabled })}
        style={styles.reminderToggle}
      >
        <Text style={[styles.section, { color: colors.text }]}>
          Напомнить об окончании
        </Text>
        <Text style={{ color: colors.textSecondary, ...typography.caption }}>
          {values.remindersEnabled ? 'Включено' : 'Выключено'}
        </Text>
      </Pressable>

      {values.remindersEnabled ? (
        <View style={styles.typeRow}>
          {ALL_WARRANTY_REMINDER_OFFSETS.map((offset) => {
            const selected = values.reminderOffsets.includes(offset);
            const isDefault = DEFAULT_WARRANTY_REMINDER_OFFSETS.includes(
              offset as (typeof DEFAULT_WARRANTY_REMINDER_OFFSETS)[number],
            );
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
                  {isDefault ? '✓ ' : ''}За {offset} дн.
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
  typeRow: {
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
  endDateToggle: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  reminderToggle: {
    marginBottom: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
});
