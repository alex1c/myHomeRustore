/**
 * Backup / restore screen — create archive or preview+confirm replace restore.
 */

import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import type { BackupPreview } from '@/src/domain/backup';
import { AppError } from '@/src/domain/errors';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { Analytics } from '@/src/services/AnalyticsService';
import { InterstitialAdService } from '@/src/services/InterstitialAdService';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { formatRussianDate } from '@/src/utils/formatDate';
import { utcInstantToDateOnly } from '@/src/utils/datetime';

export default function BackupScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { backupService, restoreService } = useDatabase();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [pendingBytes, setPendingBytes] = useState<Uint8Array | null>(null);

  const handleCreate = async () => {
    if (!backupService || busy) return;
    setBusy(true);
    try {
      const result = await backupService.createAndShare();
      Analytics.backupCreated();
      // Show interstitial after backup succeeds (not over the success alert).
      void InterstitialAdService.onBackupCreated();
      const extra =
        result.warnings.length > 0
          ? `\n\nПредупреждения: ${result.warnings.length}`
          : '';
      Alert.alert('Готово', `Резервная копия создана.${extra}`);
    } catch (err) {
      Alert.alert(
        'Ошибка',
        err instanceof AppError
          ? err.message
          : 'Не удалось создать резервную копию',
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePick = async () => {
    if (!restoreService || busy) return;
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: '*/*',
      });
      if (picked.canceled || !picked.assets?.[0]) {
        return;
      }
      const uri = picked.assets[0].uri;
      const { preview: nextPreview, bytes } =
        await restoreService.previewFromUri(uri);
      setPreview(nextPreview);
      setPendingBytes(bytes);
    } catch (err) {
      setPreview(null);
      setPendingBytes(null);
      Alert.alert(
        'Не удалось прочитать копию',
        err instanceof AppError
          ? err.message
          : 'Файл повреждён или имеет неверный формат',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setPendingBytes(null);
  };

  const handleRestore = () => {
    if (!restoreService || !pendingBytes || busy) return;
    Alert.alert(
      'Восстановить данные?',
      'Текущие данные приложения будут заменены данными из резервной копии.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Восстановить',
          style: 'destructive',
          onPress: () => {
            void runRestore();
          },
        },
      ],
    );
  };

  const runRestore = async () => {
    if (!restoreService || !pendingBytes || busy) return;
    setBusy(true);
    try {
      const result = await restoreService.restoreFromBytes(pendingBytes);
      setPreview(null);
      setPendingBytes(null);
      Analytics.restoreCompleted();
      const reminderNote =
        result.permissionDenied || result.remindersFailed > 0
          ? '\n\nДанные восстановлены, но некоторые напоминания не удалось создать.'
          : '';
      // Interstitial only after user dismisses success feedback.
      Alert.alert('Готово', `Данные восстановлены.${reminderNote}`, [
        {
          text: 'OK',
          onPress: () => {
            router.back();
            void InterstitialAdService.onRestoreCompleted();
          },
        },
      ]);
    } catch (err) {
      Alert.alert(
        'Ошибка восстановления',
        err instanceof AppError
          ? err.message
          : 'Не удалось восстановить данные',
      );
    } finally {
      setBusy(false);
    }
  };

  const createdLabel = preview
    ? formatRussianDate(
        utcInstantToDateOnly(preview.manifest.createdAt) ??
          preview.manifest.createdAt.slice(0, 10),
      )
    : '';

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: colors.text }]}>Резервная копия</Text>
      <Text style={[styles.lead, { color: colors.textSecondary }]}>
        Сохраните имущество, гарантии, документы, обслуживание и расходники.
      </Text>

      <Card style={styles.card}>
        <Button
          title="Создать резервную копию"
          onPress={() => {
            void handleCreate();
          }}
          disabled={busy || !backupService}
        />
      </Card>

      <Text style={[styles.section, { color: colors.text }]}>Восстановление</Text>
      <Card style={styles.card}>
        <Button
          title="Выбрать файл резервной копии"
          variant="secondary"
          onPress={() => {
            void handlePick();
          }}
          disabled={busy || !restoreService}
        />
      </Card>

      {busy ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {preview ? (
        <Card style={styles.preview}>
          <Text style={[styles.section, { color: colors.text }]}>
            Резервная копия
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Создана: {createdLabel}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Версия приложения: {preview.manifest.appVersion}
          </Text>
          <Text style={[styles.counts, { color: colors.text }]}>
            {preview.counts.items} вещей
          </Text>
          <Text style={[styles.counts, { color: colors.text }]}>
            {preview.counts.locations} комнат
          </Text>
          <Text style={[styles.counts, { color: colors.text }]}>
            {preview.counts.documents} документов
          </Text>
          <Text style={[styles.counts, { color: colors.text }]}>
            {preview.counts.warranties} гарантий
          </Text>
          <Text style={[styles.counts, { color: colors.text }]}>
            {preview.counts.maintenanceRules} правил обслуживания
          </Text>
          <Text style={[styles.counts, { color: colors.text }]}>
            {preview.counts.consumables} расходников
          </Text>
          <Text style={[styles.warning, { color: colors.warning }]}>
            Восстановление заменит текущие данные.
          </Text>
          <Text style={[styles.warning, { color: colors.warning }]}>
            Текущие данные приложения будут заменены данными из резервной копии.
          </Text>
          <Button
            title="Восстановить"
            onPress={handleRestore}
            disabled={busy}
            style={styles.previewBtn}
          />
          <Button
            title="Отмена"
            variant="ghost"
            onPress={handleCancelPreview}
            disabled={busy}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, marginBottom: spacing.sm },
  lead: { ...typography.body, marginBottom: spacing.lg },
  section: { ...typography.subtitle, marginBottom: spacing.sm, marginTop: spacing.md },
  card: { marginBottom: spacing.md, gap: spacing.sm },
  loading: { paddingVertical: spacing.md, alignItems: 'center' },
  preview: { marginTop: spacing.md, gap: spacing.xs },
  meta: { ...typography.body },
  counts: { ...typography.body, fontWeight: '600' },
  warning: { ...typography.caption, marginTop: spacing.sm },
  previewBtn: { marginTop: spacing.md },
});
