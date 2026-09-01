/**
 * Shared create/edit item form with progressive sections.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DateOnlyField } from '@/components/forms/DateOnlyField';
import { CategorySelect } from '@/components/inventory/CategorySelect';
import { ItemPhotoPicker } from '@/components/inventory/ItemPhotoPicker';
import { LocationSelect } from '@/components/inventory/LocationSelect';
import { TextField } from '@/components/ui/TextField';
import { Card } from '@/components/ui/Card';
import type { ItemFormValues, PendingPhoto } from '@/src/domain/inventory';
import type { Location } from '@/src/domain/types';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';

type ItemFormProps = {
  values: ItemFormValues;
  onChange: (values: ItemFormValues) => void;
  locations: Location[];
  extraCategories?: string[];
  existingPhotoPath?: string | null;
  pendingPhoto: PendingPhoto | null;
  onPendingPhotoChange: (photo: PendingPhoto | null) => void;
  removeExistingPhoto: boolean;
  onRemoveExistingPhoto: () => void;
  onCreateLocation: (name: string) => Location;
  onRenameLocation: (id: string, name: string) => void;
  onDeleteLocation: (id: string, unlink: boolean) => void;
  getLocationItemCount: (id: string) => number;
  nameError?: string | null;
};

export function ItemForm({
  values,
  onChange,
  locations,
  extraCategories,
  existingPhotoPath,
  pendingPhoto,
  onPendingPhotoChange,
  removeExistingPhoto,
  onRemoveExistingPhoto,
  onCreateLocation,
  onRenameLocation,
  onDeleteLocation,
  getLocationItemCount,
  nameError,
}: ItemFormProps) {
  const colors = useThemeColors();
  const [showExtra, setShowExtra] = useState(
    Boolean(values.brand || values.model || values.serialNumber || values.note),
  );

  const patch = (partial: Partial<ItemFormValues>) => {
    onChange({ ...values, ...partial });
  };

  return (
    <View>
      <Text style={[styles.section, { color: colors.text }]}>Основное</Text>
      <TextField
        label="Название *"
        value={values.name}
        onChangeText={(name) => patch({ name })}
        placeholder="Например: Чайник"
        error={nameError}
      />
      <CategorySelect
        value={values.category}
        customCategory={values.customCategory}
        onChange={(category) => patch({ category })}
        onCustomChange={(customCategory) => patch({ customCategory })}
        extraCategories={extraCategories}
      />
      <LocationSelect
        locations={locations}
        value={values.locationId}
        onChange={(locationId) => patch({ locationId })}
        onCreate={onCreateLocation}
        onRename={onRenameLocation}
        onDelete={onDeleteLocation}
        getItemCount={getLocationItemCount}
      />
      <ItemPhotoPicker
        existingPath={removeExistingPhoto ? null : existingPhotoPath}
        pending={pendingPhoto}
        onChange={onPendingPhotoChange}
        onRemoveExisting={onRemoveExistingPhoto}
      />

      <Card style={styles.card}>
        <Text
          style={[styles.toggle, { color: colors.primary }]}
          onPress={() => setShowExtra((v) => !v)}
          accessibilityRole="button"
        >
          {showExtra ? 'Скрыть дополнительно' : 'Дополнительно'}
        </Text>
        {showExtra ? (
          <>
            <TextField
              label="Бренд"
              value={values.brand}
              onChangeText={(brand) => patch({ brand })}
            />
            <TextField
              label="Модель"
              value={values.model}
              onChangeText={(model) => patch({ model })}
            />
            <TextField
              label="Серийный номер"
              value={values.serialNumber}
              onChangeText={(serialNumber) => patch({ serialNumber })}
            />
            <TextField
              label="Заметка"
              value={values.note}
              onChangeText={(note) => patch({ note })}
              multiline
            />
          </>
        ) : null}
      </Card>

      <Text style={[styles.section, { color: colors.text }]}>Покупка</Text>
      <Card>
        <DateOnlyField
          label="Дата покупки"
          value={values.purchaseDate}
          onChange={(purchaseDate) => patch({ purchaseDate })}
        />
        <TextField
          label="Магазин"
          value={values.seller}
          onChangeText={(seller) => patch({ seller })}
        />
        <TextField
          label="Стоимость, ₽"
          value={values.priceText}
          onChangeText={(priceText) => patch({ priceText })}
          keyboardType="decimal-pad"
          placeholder="12 990,50"
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  card: {
    marginBottom: spacing.md,
  },
  toggle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
});
