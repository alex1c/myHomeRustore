/**
 * Documents tab — placeholder for receipts and files (Phase 2+).
 */

import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { typography } from '@/src/theme/tokens';

export default function DocumentsScreen() {
  const colors = useThemeColors();

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: colors.text }]}>Документы</Text>
      <EmptyState
        title="Нет документов"
        message="Чеки, гарантии и инструкции будут храниться здесь."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    marginBottom: 8,
  },
});
