/**
 * Calendar date field using native date picker (local date, no UTC shift).
 */

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';
import { formatRussianDate } from '@/src/utils/formatDate';
import { isValidDateOnly, toLocalDateOnly } from '@/src/utils/datetime';

type DateOnlyFieldProps = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
};

function parseLocalDate(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function DateOnlyField({ label, value, onChange }: DateOnlyFieldProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const pickerDate =
    value && isValidDateOnly(value) ? parseLocalDate(value) : new Date();

  const handleChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
    }
    if (date) {
      onChange(toLocalDateOnly(date));
    }
  };

  const clear = () => onChange(null);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={[
            styles.input,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Text style={{ color: value ? colors.text : colors.textMuted, ...typography.body }}>
            {value ? formatRussianDate(value) : 'Не указана'}
          </Text>
        </Pressable>
        {value ? (
          <Pressable accessibilityRole="button" onPress={clear} style={styles.clear}>
            <Text style={{ color: colors.primary, ...typography.caption }}>Очистить</Text>
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  clear: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
});
