/**
 * Primary photo picker — gallery and optional camera on user action.
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { PendingPhoto } from '@/src/domain/inventory';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';
import { managedUriFromRelativePath } from '@/src/services/managedFileService';

type ItemPhotoPickerProps = {
  /** Existing managed relative path (edit mode). */
  existingPath?: string | null;
  pending?: PendingPhoto | null;
  onChange: (photo: PendingPhoto | null) => void;
  onRemoveExisting?: () => void;
};

export function ItemPhotoPicker({
  existingPath,
  pending,
  onChange,
  onRemoveExisting,
}: ItemPhotoPickerProps) {
  const colors = useThemeColors();
  const [removedExisting, setRemovedExisting] = useState(false);

  const displayUri =
    pending?.localUri ??
    (!removedExisting && existingPath
      ? managedUriFromRelativePath(existingPath)
      : null);

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к фото в настройках устройства.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setRemovedExisting(true);
      onChange({
        localUri: asset.uri,
        mimeType: asset.mimeType ?? null,
        fileName: asset.fileName ?? null,
      });
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к камере в настройках устройства.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setRemovedExisting(true);
      onChange({
        localUri: asset.uri,
        mimeType: asset.mimeType ?? null,
        fileName: asset.fileName ?? null,
      });
    }
  };

  const showOptions = () => {
    const options = ['Галерея', 'Сделать фото', 'Удалить фото', 'Отмена'];
    const cancelIndex = 3;
    const destructiveIndex = displayUri ? 2 : undefined;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          destructiveButtonIndex: destructiveIndex,
        },
        (index) => {
          if (index === 0) void pickFromLibrary();
          if (index === 1) void takePhoto();
          if (index === 2) handleRemove();
        },
      );
      return;
    }

    Alert.alert('Фото', undefined, [
      { text: 'Галерея', onPress: () => void pickFromLibrary() },
      { text: 'Сделать фото', onPress: () => void takePhoto() },
      ...(displayUri
        ? [{ text: 'Удалить фото', style: 'destructive' as const, onPress: handleRemove }]
        : []),
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const handleRemove = () => {
    setRemovedExisting(true);
    onChange(null);
    onRemoveExisting?.();
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Фото</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Выбрать фото"
        onPress={showOptions}
        style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
      >
        {displayUri ? (
          <Image source={{ uri: displayUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.hint, { color: colors.textMuted }]}>Добавить фото</Text>
          </View>
        )}
      </Pressable>
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
  box: {
    width: 120,
    height: 120,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  hint: {
    ...typography.caption,
  },
});
