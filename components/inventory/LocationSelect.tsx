/**
 * Location selector with inline create and manage actions.
 */

import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import type { Location } from '@/src/domain/types';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { radii, spacing, typography } from '@/src/theme/tokens';

type LocationSelectProps = {
  label?: string;
  locations: Location[];
  value: string | null;
  onChange: (locationId: string | null) => void;
  onCreate: (name: string) => Location;
  onRename: (locationId: string, name: string) => void;
  onDelete: (locationId: string, unlinkItems: boolean) => void;
  getItemCount: (locationId: string) => number;
};

export function LocationSelect({
  label = 'Комната / место',
  locations,
  value,
  onChange,
  onCreate,
  onRename,
  onDelete,
  getItemCount,
}: LocationSelectProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'pick' | 'add' | 'manage'>('pick');
  const [newName, setNewName] = useState('');
  const [manageId, setManageId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const selectedLabel =
    value == null
      ? 'Без места'
      : locations.find((l) => l.id === value)?.name ?? 'Без места';

  const close = () => {
    setOpen(false);
    setMode('pick');
    setNewName('');
    setManageId(null);
  };

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert('Введите название места');
      return;
    }
    const created = onCreate(trimmed);
    onChange(created.id);
    close();
  };

  const startManage = (location: Location) => {
    setManageId(location.id);
    setRenameText(location.name);
    setMode('manage');
  };

  const handleRename = () => {
    if (!manageId) return;
    onRename(manageId, renameText);
    setMode('pick');
    setManageId(null);
  };

  const handleDelete = (location: Location) => {
    const count = getItemCount(location.id);
    if (count === 0) {
      onDelete(location.id, false);
      if (value === location.id) onChange(null);
      setMode('pick');
      return;
    }
    Alert.alert(
      `Удалить «${location.name}»?`,
      `${count} вещей будут перенесены в «Без места».`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            onDelete(location.id, true);
            if (value === location.id) onChange(null);
            setMode('pick');
          },
        },
      ],
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <Text style={[styles.triggerText, { color: colors.text }]}>{selectedLabel}</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            {mode === 'pick' ? (
              <>
                <Text style={[styles.title, { color: colors.text }]}>Выберите место</Text>
                <ScrollView style={styles.list}>
                  <Pressable
                    style={styles.option}
                    onPress={() => {
                      onChange(null);
                      close();
                    }}
                  >
                    <Text style={{ color: colors.text }}>Без места</Text>
                  </Pressable>
                  {locations.map((loc) => (
                    <Pressable
                      key={loc.id}
                      style={styles.optionRow}
                      onPress={() => {
                        onChange(loc.id);
                        close();
                      }}
                      onLongPress={() => startManage(loc)}
                    >
                      <Text style={{ color: colors.text, flex: 1 }}>{loc.name}</Text>
                      <Text style={{ color: colors.textMuted, ...typography.caption }}>
                        удерж. → изменить
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Button title="+ Добавить место" variant="secondary" onPress={() => setMode('add')} />
                <Button title="Закрыть" variant="ghost" onPress={close} />
              </>
            ) : null}

            {mode === 'add' ? (
              <>
                <Text style={[styles.title, { color: colors.text }]}>Новое место</Text>
                <TextField
                  label="Название"
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  placeholder="Кухня"
                />
                <Button title="Сохранить" onPress={handleCreate} />
                <Button title="Назад" variant="ghost" onPress={() => setMode('pick')} />
              </>
            ) : null}

            {mode === 'manage' && manageId ? (
              <>
                <Text style={[styles.title, { color: colors.text }]}>Изменить место</Text>
                <TextField label="Название" value={renameText} onChangeText={setRenameText} />
                <Button title="Сохранить" onPress={handleRename} />
                <Button
                  title="Удалить место"
                  variant="secondary"
                  onPress={() => {
                    const loc = locations.find((l) => l.id === manageId);
                    if (loc) handleDelete(loc);
                  }}
                />
                <Button title="Назад" variant="ghost" onPress={() => setMode('pick')} />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.caption, marginBottom: spacing.xs },
  trigger: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  triggerText: { ...typography.body },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.md,
    maxHeight: '80%',
    gap: spacing.sm,
  },
  title: { ...typography.subtitle, marginBottom: spacing.sm },
  list: { maxHeight: 320 },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  optionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
});
