/**
 * Document file picker — gallery, camera, or file (PDF).
 */

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { PendingDocumentFile } from '@/src/services/documentService';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

type DocumentFilePickerProps = {
  onPick: (file: PendingDocumentFile) => void;
  label?: string;
};

const LARGE_FILE_BYTES = 20 * 1024 * 1024;

export function DocumentFilePicker({
  onPick,
  label = 'Выбрать файл',
}: DocumentFilePickerProps) {
  const colors = useThemeColors();

  const warnLargeFile = (size: number | null | undefined): boolean => {
    if (size != null && size > LARGE_FILE_BYTES) {
      Alert.alert(
        'Большой файл',
        'Файл очень большой. Импорт может занять время и место в памяти.',
      );
      return true;
    }
    return false;
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к фото в настройках устройства.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      warnLargeFile(asset.fileSize);
      onPick({
        sourceUri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        originalName: asset.fileName ?? null,
        fileSize: asset.fileSize ?? null,
      });
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к камере в настройках устройства.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onPick({
        sourceUri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        originalName: asset.fileName ?? 'photo.jpg',
        fileSize: asset.fileSize ?? null,
      });
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      warnLargeFile(asset.size);
      onPick({
        sourceUri: asset.uri,
        mimeType: asset.mimeType ?? null,
        originalName: asset.name ?? null,
        fileSize: asset.size ?? null,
      });
    }
  };

  const showOptions = () => {
    const options = ['Галерея', 'Сделать фото', 'Файл (PDF и др.)', 'Отмена'];
    const cancelIndex = 3;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        (index) => {
          if (index === 0) void pickFromLibrary();
          if (index === 1) void takePhoto();
          if (index === 2) void pickFile();
        },
      );
      return;
    }

    Alert.alert('Документ', undefined, [
      { text: 'Галерея', onPress: () => void pickFromLibrary() },
      { text: 'Сделать фото', onPress: () => void takePhoto() },
      { text: 'Файл', onPress: () => void pickFile() },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        onPress={showOptions}
        style={[
          styles.box,
          { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
        ]}
      >
        <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Фото, камера или файл
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  box: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
  },
});
