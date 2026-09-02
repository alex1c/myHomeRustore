/**
 * Maintenance rule detail — status, history, mark done, edit, delete.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import type { MaintenanceEvent, MaintenanceRule } from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { formatRussianDate } from '@/src/utils/formatDate';
import {
  presentInterval,
  presentMaintenanceStatus,
} from '@/src/utils/maintenancePresentation';
import { toLocalDateOnly, utcInstantToDateOnly } from '@/src/utils/datetime';
import { DateOnlyField } from '@/components/forms/DateOnlyField';
import { TextField } from '@/components/ui/TextField';

export default function MaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { maintenanceService, inventory } = useDatabase();
  const [rule, setRule] = useState<MaintenanceRule | null>(null);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [itemName, setItemName] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [historyDate, setHistoryDate] = useState<string | null>(toLocalDateOnly());
  const [historyNote, setHistoryNote] = useState('');

  const load = useCallback(() => {
    if (!maintenanceService || !inventory || !id) return;
    const r = maintenanceService.getRuleById(id);
    setRule(r);
    if (r) {
      setItemName(inventory.getDetail(r.itemId)?.item.name ?? null);
      setEvents(maintenanceService.listEventsForRule(id));
    }
  }, [maintenanceService, inventory, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleMarkDone = async (performedDate?: string | null, note?: string) => {
    if (!maintenanceService || !id || marking) return;
    setMarking(true);
    try {
      const result = await maintenanceService.markDone(
        id,
        performedDate ?? toLocalDateOnly(),
        note ?? null,
      );
      const next = result.rule.nextDueDate
        ? formatRussianDate(result.rule.nextDueDate)
        : null;
      let message = 'Отмечено выполненным';
      if (next) {
        message += `\nСледующее обслуживание — ${next}`;
      }
      if (result.reminders.failedCount > 0 || result.reminders.permissionDenied) {
        message +=
          '\n\nВыполнено, но новое напоминание создать не удалось.';
      }
      Alert.alert('Готово', message);
      setShowHistoryForm(false);
      setHistoryNote('');
      load();
    } catch {
      Alert.alert('Ошибка', 'Не удалось отметить выполнение');
    } finally {
      setMarking(false);
    }
  };

  const confirmDelete = () => {
    if (!rule) return;
    Alert.alert(
      `Удалить обслуживание «${rule.title}»?`,
      'История этой работы будет удалена.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => void handleDelete(),
        },
      ],
    );
  };

  const handleDelete = async () => {
    if (!maintenanceService || !id) return;
    try {
      await maintenanceService.deleteRule(id);
      router.back();
    } catch {
      Alert.alert('Ошибка', 'Не удалось удалить обслуживание');
    }
  };

  const confirmDeleteEvent = (event: MaintenanceEvent) => {
    Alert.alert('Удалить запись истории?', 'Дата следующего обслуживания может быть пересчитана.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => void handleDeleteEvent(event.id),
      },
    ]);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!maintenanceService) return;
    try {
      await maintenanceService.deleteEvent(eventId);
      load();
    } catch {
      Alert.alert('Ошибка', 'Не удалось удалить запись');
    }
  };

  if (!rule) {
    return (
      <>
        <Stack.Screen options={{ title: 'Обслуживание' }} />
        <Screen><></></Screen>
      </>
    );
  }

  const status = presentMaintenanceStatus(rule.nextDueDate);
  const interval = presentInterval(rule.intervalValue, rule.intervalUnit);

  return (
    <>
      <Stack.Screen
        options={{
          title: rule.title,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={confirmDelete}
              style={styles.headerBtn}
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          ),
        }}
      />
      <Screen scroll>
        <ScrollView>
          {itemName ? (
            <Pressable onPress={() => router.push(`/item/${rule.itemId}`)}>
              <Text style={[styles.itemName, { color: colors.primary }]}>
                {itemName}
              </Text>
            </Pressable>
          ) : null}

          <Card style={styles.section}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Статус</Text>
            <Text style={[styles.value, { color: colors.text }]}>{status.label}</Text>
            {status.detail ? (
              <Text style={[styles.detail, { color: colors.textSecondary }]}>
                {status.detail}
              </Text>
            ) : null}
            {interval ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Периодичность
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>{interval}</Text>
              </>
            ) : null}
            {rule.nextDueDate ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Следующее
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {formatRussianDate(rule.nextDueDate)}
                </Text>
              </>
            ) : null}
            {rule.lastCompletedDate ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Последнее выполнение
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {formatRussianDate(rule.lastCompletedDate)}
                </Text>
              </>
            ) : null}
            {rule.note ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>Заметка</Text>
                <Text style={[styles.value, { color: colors.textSecondary }]}>
                  {rule.note}
                </Text>
              </>
            ) : null}
          </Card>

          <Button
            title={marking ? '…' : 'Готово'}
            onPress={() => void handleMarkDone()}
            disabled={marking}
          />

          <Button
            title="Редактировать"
            variant="secondary"
            onPress={() => router.push(`/maintenance/edit/${rule.id}`)}
            style={styles.secondary}
          />

          <Button
            title="Добавить в историю"
            variant="ghost"
            onPress={() => setShowHistoryForm((v) => !v)}
          />

          {showHistoryForm ? (
            <Card style={styles.section}>
              <DateOnlyField
                label="Дата выполнения"
                value={historyDate}
                onChange={setHistoryDate}
              />
              <TextField
                label="Заметка"
                value={historyNote}
                onChangeText={setHistoryNote}
              />
              <Button
                title="Сохранить в историю"
                onPress={() =>
                  void handleMarkDone(historyDate, historyNote.trim() || undefined)
                }
                disabled={marking || !historyDate}
              />
            </Card>
          ) : null}

          <Text style={[styles.historyTitle, { color: colors.text }]}>История</Text>
          {events.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              Пока нет выполнений
            </Text>
          ) : (
            events.map((event) => {
              const date = utcInstantToDateOnly(event.performedAt);
              return (
                <Pressable
                  key={event.id}
                  onLongPress={() => confirmDeleteEvent(event)}
                  style={[
                    styles.eventRow,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  <View style={styles.eventMain}>
                    <Text style={[styles.eventDate, { color: colors.text }]}>
                      {date ? formatRussianDate(date) : event.performedAt}
                    </Text>
                    <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                      Выполнено
                    </Text>
                    {event.note ? (
                      <Text style={{ color: colors.textMuted, ...typography.caption }}>
                        {event.note}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    ...typography.subtitle,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  value: {
    ...typography.body,
  },
  detail: {
    ...typography.caption,
  },
  secondary: {
    marginTop: spacing.sm,
  },
  historyTitle: {
    ...typography.subtitle,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  empty: {
    ...typography.body,
    marginBottom: spacing.xl,
  },
  eventRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  eventMain: {
    gap: 2,
  },
  eventDate: {
    ...typography.body,
    fontWeight: '600',
  },
});
