/**
 * CSV export screen — human-readable shares, not a backup.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import type { CsvExportKind } from '@/src/services/backup/exportService';
import { useActiveProperty } from '@/src/hooks/useActiveProperty';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';

const EXPORTS: { kind: CsvExportKind; title: string }[] = [
  { kind: 'inventory', title: 'Имущество CSV' },
  { kind: 'warranties', title: 'Гарантии CSV' },
  { kind: 'maintenance', title: 'Обслуживание CSV' },
  { kind: 'consumables', title: 'Расходники CSV' },
];

export default function ExportScreen() {
  const colors = useThemeColors();
  const { exportService } = useDatabase();
  const { propertyId } = useActiveProperty();
  const [busy, setBusy] = useState(false);

  const handleExport = async (kind: CsvExportKind) => {
    if (!exportService || busy) return;
    setBusy(true);
    let uri: string | null = null;
    try {
      const csv = exportService.buildCsv(kind, propertyId);
      const fileName = exportService.fileName(kind);
      const cache =
        FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
      const dir = `${cache}export-temp/`;
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      uri = `${dir}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Экспорт данных',
          UTI: 'public.comma-separated-values-text',
        });
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось экспортировать данные');
    } finally {
      if (uri) {
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {
          // best-effort cleanup
        }
      }
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: colors.text }]}>Экспорт данных</Text>
      <Text style={[styles.lead, { color: colors.textSecondary }]}>
        Читаемые CSV-файлы для Excel. Это не полная резервная копия.
      </Text>

      <Card style={styles.card}>
        {EXPORTS.map((item) => (
          <Button
            key={item.kind}
            title={item.title}
            variant="secondary"
            disabled={busy || !exportService}
            onPress={() => {
              void handleExport(item.kind);
            }}
            style={styles.btn}
          />
        ))}
      </Card>

      {busy ? <ActivityIndicator color={colors.primary} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, marginBottom: spacing.sm },
  lead: { ...typography.body, marginBottom: spacing.lg },
  card: { gap: spacing.sm },
  btn: { marginBottom: spacing.xs },
});
