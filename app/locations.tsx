/**
 * Standalone rooms/locations manager — list, add, rename, delete.
 * Deleting a location unlinks items (they become «Без места»).
 */

import { Stack } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { AppError } from '@/src/domain/errors';
import { useActiveProperty } from '@/src/hooks/useActiveProperty';
import { usePropertyLocations } from '@/src/hooks/usePropertyLocations';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

export default function LocationsScreen() {
  const colors = useThemeColors();
  const { propertyId } = useActiveProperty();
  const { items } = useDatabase();
  const {
    list,
    refresh,
    repository: locations,
  } = usePropertyLocations(propertyId);

  const [mode, setMode] = useState<'list' | 'add' | 'rename'>('list');
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setMode('list');
    setName('');
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!propertyId || !locations) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Введите название места');
      return;
    }
    try {
      locations.createLocation({ propertyId, name: trimmed });
      refresh();
      resetForm();
    } catch (err) {
      const message =
        err instanceof AppError ? err.message : 'Не удалось создать место';
      Alert.alert('Ошибка', message);
    }
  };

  const handleRename = () => {
    if (!locations || !editingId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Введите название места');
      return;
    }
    try {
      locations.updateLocation(editingId, trimmed);
      refresh();
      resetForm();
    } catch (err) {
      const message =
        err instanceof AppError ? err.message : 'Не удалось переименовать место';
      Alert.alert('Ошибка', message);
    }
  };

  const handleDelete = (locationId: string, locationName: string) => {
    if (!locations || !items) return;
    const count = items.countAtLocation(locationId);
    const message =
      count > 0
        ? `${count} вещей будут перенесены в «Без места».`
        : 'Место будет удалено. Вещи не удаляются.';

    Alert.alert(`Удалить «${locationName}»?`, message, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          try {
            locations.deleteLocation(locationId, { unlinkItems: true });
            refresh();
            resetForm();
          } catch (err) {
            const msg =
              err instanceof AppError ? err.message : 'Не удалось удалить место';
            Alert.alert('Ошибка', msg);
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Комнаты и места' }} />
      <Screen>
        {mode === 'list' ? (
          <>
            {list.length === 0 ? (
              <EmptyState
                title="Мест пока нет"
                message="Добавьте комнаты и места хранения, чтобы быстрее находить вещи."
              />
            ) : (
              <FlatList
                data={list}
                keyExtractor={(loc) => loc.id}
                contentContainerStyle={styles.list}
                renderItem={({ item: loc }) => {
                  const count = items?.countAtLocation(loc.id) ?? 0;
                  return (
                    <View
                      style={[
                        styles.row,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <View style={styles.rowText}>
                        <Text style={[styles.rowTitle, { color: colors.text }]}>
                          {loc.name}
                        </Text>
                        <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                          {count === 0
                            ? 'Нет вещей'
                            : count === 1
                              ? '1 вещь'
                              : `${count} вещей`}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setEditingId(loc.id);
                          setName(loc.name);
                          setMode('rename');
                        }}
                        style={styles.action}
                      >
                        <Text style={{ color: colors.primary }}>Изменить</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => handleDelete(loc.id, loc.name)}
                        style={styles.action}
                      >
                        <Text style={{ color: colors.danger }}>Удалить</Text>
                      </Pressable>
                    </View>
                  );
                }}
              />
            )}
            <Button
              title="+ Добавить место"
              onPress={() => {
                setName('');
                setMode('add');
              }}
              style={styles.footerBtn}
            />
          </>
        ) : null}

        {mode === 'add' ? (
          <View style={styles.form}>
            <Text style={[styles.formTitle, { color: colors.text }]}>
              Новое место
            </Text>
            <TextField
              label="Название"
              value={name}
              onChangeText={setName}
              autoFocus
              placeholder="Кухня"
            />
            <Button title="Сохранить" onPress={handleCreate} />
            <Button title="Отмена" variant="ghost" onPress={resetForm} />
          </View>
        ) : null}

        {mode === 'rename' ? (
          <View style={styles.form}>
            <Text style={[styles.formTitle, { color: colors.text }]}>
              Переименовать
            </Text>
            <TextField
              label="Название"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <Button title="Сохранить" onPress={handleRename} />
            <Button title="Отмена" variant="ghost" onPress={resetForm} />
          </View>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.body, fontWeight: '600' },
  rowMeta: { ...typography.caption, marginTop: 2 },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  footerBtn: { marginTop: spacing.md, marginBottom: spacing.md },
  form: { gap: spacing.sm },
  formTitle: { ...typography.subtitle, marginBottom: spacing.sm },
});
