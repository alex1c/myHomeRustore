/**
 * Edit existing inventory item.
 */

import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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
import { minorToPriceInput } from '@/src/utils/money';

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { propertyId } = useActiveProperty();
  const { inventory, locations, items, itemPhotos } = useDatabase();
  const [values, setValues] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);

  const propertyLocations = useMemo(() => {
    if (!propertyId || !locations) return [];
    return locations.listByProperty(propertyId);
  }, [propertyId, locations]);

  const extraCategories = useMemo(() => {
    if (!propertyId || !inventory) return [];
    return inventory.listDistinctCategories(propertyId);
  }, [propertyId, inventory]);

  useFocusEffect(
    useCallback(() => {
      if (!inventory || !id) return;
      queueMicrotask(() => {
        const detail = inventory.getDetail(id);
        if (!detail) return;
        const purchase = detail.purchase;
        const isDefaultCategory = [
          'Бытовая техника',
          'Электроника',
          'Мебель',
          'Инструменты',
          'Сантехника',
          'Климат',
          'Освещение',
          'Посуда',
          'Другое',
        ].includes(detail.item.category);

        setValues({
          name: detail.item.name,
          category: isDefaultCategory ? detail.item.category : 'Другое',
          customCategory: isDefaultCategory ? '' : detail.item.category,
          locationId: detail.item.locationId,
          brand: detail.item.brand ?? '',
          model: detail.item.model ?? '',
          serialNumber: detail.item.serialNumber ?? '',
          note: detail.item.note ?? '',
          purchaseDate: purchase?.purchaseDate ?? null,
          seller: purchase?.seller ?? '',
          priceText:
            purchase?.priceMinor != null ? minorToPriceInput(purchase.priceMinor) : '',
        });
        setExistingPhotoPath(detail.item.primaryPhotoPath);
      });
    }, [inventory, id]),
  );

  const handleSave = async () => {
    if (!id || !inventory || !itemPhotos) return;
    if (!values.name.trim()) {
      setNameError('Введите название вещи');
      return;
    }
    if (saving) return;

    setSaving(true);
    setNameError(null);

    try {
      if (pendingPhoto) {
        await itemPhotos.replacePrimaryPhoto(
          id,
          pendingPhoto.localUri,
          pendingPhoto.mimeType,
        );
        setPendingPhoto(null);
        setRemovePhoto(false);
      } else if (removePhoto && existingPhotoPath) {
        await itemPhotos.removePrimaryPhoto(id);
        setExistingPhotoPath(null);
        setRemovePhoto(false);
      }

      inventory.updateItem(id, values);
      router.back();
    } catch (err) {
      const message =
        err instanceof AppError ? err.message : 'Не удалось сохранить изменения';
      Alert.alert('Ошибка', message);
    } finally {
      setSaving(false);
    }
  };

  if (!propertyId || !locations || !items) {
    return (
      <>
        <Stack.Screen options={{ title: 'Редактировать' }} />
        <Screen><></></Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Редактировать' }} />
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
              existingPhotoPath={existingPhotoPath}
              pendingPhoto={pendingPhoto}
              onPendingPhotoChange={setPendingPhoto}
              removeExistingPhoto={removePhoto}
              onRemoveExistingPhoto={() => setRemovePhoto(true)}
              nameError={nameError}
              onCreateLocation={(name) =>
                locations.createLocation({ propertyId, name })
              }
              onRenameLocation={(locId, name) => locations.updateLocation(locId, name)}
              onDeleteLocation={(locId, unlink) =>
                locations.deleteLocation(locId, { unlinkItems: unlink })
              }
              getLocationItemCount={(locId) => items.countAtLocation(locId)}
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
