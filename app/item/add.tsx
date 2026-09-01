/**
 * Create new inventory item.
 */

import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import { ItemForm } from '@/components/inventory/ItemForm';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import type { ItemFormValues, PendingPhoto } from '@/src/domain/inventory';
import { AppError } from '@/src/domain/errors';
import { useActiveProperty } from '@/src/hooks/useActiveProperty';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { spacing } from '@/src/theme/tokens';

export default function AddItemScreen() {
  const router = useRouter();
  const { propertyId } = useActiveProperty();
  const { inventory, locations, items, itemPhotos } = useDatabase();
  const [values, setValues] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const propertyLocations = useMemo(() => {
    if (!propertyId || !locations) return [];
    return locations.listByProperty(propertyId);
  }, [propertyId, locations]);

  const extraCategories = useMemo(() => {
    if (!propertyId || !inventory) return [];
    return inventory.listDistinctCategories(propertyId);
  }, [propertyId, inventory]);

  const handleSave = async () => {
    if (!propertyId || !inventory || !itemPhotos) return;
    if (!values.name.trim()) {
      setNameError('Введите название вещи');
      return;
    }
    if (saving) return;

    setSaving(true);
    setNameError(null);
    let importedPath: string | null = null;

    try {
      if (pendingPhoto) {
        importedPath = await itemPhotos.importPhotoForNewItem(
          pendingPhoto.localUri,
          pendingPhoto.mimeType,
        );
      }

      const item = inventory.createItem(propertyId, values, importedPath);
      router.replace(`/item/${item.id}`);
    } catch (err) {
      if (importedPath) {
        await itemPhotos.cleanupImportedPhoto(importedPath);
      }
      const message =
        err instanceof AppError ? err.message : 'Не удалось сохранить вещь';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  if (!propertyId || !locations || !items) {
    return (
      <>
        <Stack.Screen options={{ title: 'Новая вещь' }} />
        <Screen><></></Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Новая вещь' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen scroll contentStyle={styles.content}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <ItemForm
              values={values}
              onChange={setValues}
              locations={propertyLocations}
              extraCategories={extraCategories}
              pendingPhoto={pendingPhoto}
              onPendingPhotoChange={setPendingPhoto}
              removeExistingPhoto={false}
              onRemoveExistingPhoto={() => {}}
              nameError={nameError}
              onCreateLocation={(name) =>
                locations.createLocation({ propertyId, name })
              }
              onRenameLocation={(id, name) => locations.updateLocation(id, name)}
              onDeleteLocation={(id, unlink) =>
                locations.deleteLocation(id, { unlinkItems: unlink })
              }
              getLocationItemCount={(id) => items.countAtLocation(id)}
            />
            <Button
              title={saving ? 'Сохранение…' : 'Сохранить'}
              onPress={() => void handleSave()}
              disabled={saving}
              style={styles.save}
            />
          </ScrollView>
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xxl },
  save: { marginTop: spacing.md, marginBottom: spacing.xl },
});
