/**
 * Open or share a managed document file.
 */

import * as Sharing from 'expo-sharing';
import { Alert, Linking } from 'react-native';

import type { Document } from '@/src/domain/types';
import {
  managedFileExists,
  managedUriFromRelativePath,
} from '@/src/services/managedFileService';

function isImageMime(mime: string | null): boolean {
  return mime?.startsWith('image/') ?? false;
}

export async function openDocumentFile(
  document: Document,
  onImageOpen: (uri: string) => void,
): Promise<void> {
  const uri = managedUriFromRelativePath(document.filePath);
  if (!uri) {
    Alert.alert('Ошибка', 'Не удалось открыть файл.');
    return;
  }
  try {
    if (!(await managedFileExists(document.filePath))) {
      Alert.alert('Файл не найден', 'Документ отсутствует в хранилище приложения.');
      return;
    }
  } catch {
    Alert.alert('Ошибка', 'Не удалось проверить файл документа.');
    return;
  }

  if (isImageMime(document.mimeType)) {
    onImageOpen(uri);
    return;
  }

  try {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: document.mimeType ?? undefined,
        dialogTitle: document.title,
      });
      return;
    }

    const opened = await Linking.openURL(uri);
    if (!opened) {
      Alert.alert('Ошибка', 'Не удалось открыть файл. Установите приложение для просмотра.');
    }
  } catch {
    Alert.alert('Ошибка', 'Не удалось открыть файл.');
  }
}
