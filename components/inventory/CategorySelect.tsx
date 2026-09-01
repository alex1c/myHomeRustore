/**
 * Category selector with optional custom text for "Другое".
 */

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { DEFAULT_CATEGORIES } from '@/src/domain/categories';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

type CategorySelectProps = {
  value: string;
  customCategory: string;
  onChange: (category: string) => void;
  onCustomChange: (text: string) => void;
  extraCategories?: string[];
};

export function CategorySelect({
  value,
  customCategory,
  onChange,
  onCustomChange,
  extraCategories = [],
}: CategorySelectProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  const options = [
    ...DEFAULT_CATEGORIES,
    ...extraCategories.filter(
      (c) => !(DEFAULT_CATEGORIES as readonly string[]).includes(c),
    ),
  ];
  const uniqueOptions = [...new Set(options)];

  const displayValue =
    value === 'Другое' && customCategory.trim() ? customCategory.trim() : value;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Категория</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <Text style={[styles.triggerText, { color: colors.text }]}>{displayValue}</Text>
      </Pressable>

      {value === 'Другое' ? (
        <TextField
          label="Своя категория"
          value={customCategory}
          onChangeText={onCustomChange}
          placeholder="Например: Спорт"
        />
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.title, { color: colors.text }]}>Категория</Text>
            <ScrollView style={styles.list}>
              {uniqueOptions.map((cat) => (
                <Pressable
                  key={cat}
                  style={styles.option}
                  onPress={() => {
                    onChange(cat);
                    setOpen(false);
                  }}
                >
                  <Text style={{ color: colors.text }}>{cat}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button title="Закрыть" variant="ghost" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  label: { ...typography.caption, marginBottom: spacing.xs },
  trigger: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  triggerText: { ...typography.body },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.md,
    maxHeight: '70%',
  },
  title: { ...typography.subtitle, marginBottom: spacing.sm },
  list: { maxHeight: 360 },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
});
