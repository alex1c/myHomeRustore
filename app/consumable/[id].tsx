/**
 * Consumable detail — stock, replace, history.
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
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { DateOnlyField } from '@/components/forms/DateOnlyField';
import { TextField } from '@/components/ui/TextField';
import type { Consumable, ConsumableEvent } from '@/src/domain/types';
import { AppError } from '@/src/domain/errors';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';
import { formatRussianDate } from '@/src/utils/formatDate';
import {
  presentConsumableEvent,
  presentConsumableStatus,
  presentStock,
} from '@/src/utils/consumablePresentation';
import { toLocalDateOnly } from '@/src/utils/datetime';
import { presentInterval } from '@/src/utils/maintenancePresentation';

export default function ConsumableDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { consumableService, inventory } = useDatabase();
  const [consumable, setConsumable] = useState<Consumable | null>(null);
  const [events, setEvents] = useState<ConsumableEvent[]>([]);
  const [itemName, setItemName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDate, setHistoryDate] = useState<string | null>(toLocalDateOnly());
  const [historyNote, setHistoryNote] = useState('');
  const [stockInput, setStockInput] = useState('');

  const load = useCallback(() => {
    if (!consumableService || !inventory || !id) return;
    const c = consumableService.getById(id);
    setConsumable(c);
    if (c) {
      setItemName(inventory.getDetail(c.itemId)?.item.name ?? null);
      setEvents(consumableService.listEvents(id));
      setStockInput(c.stockQuantity != null ? String(c.stockQuantity) : '');
    }
  }, [consumableService, inventory, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const runMarkReplaced = async (allowZero: boolean, date?: string | null, note?: string) => {
    if (!consumableService || !id || busy) return;
    setBusy(true);
    try {
      const result = await consumableService.markReplaced(
        id,
        date ?? toLocalDateOnly(),
        note ?? null,
        { allowZeroStock: allowZero },
      );
      const next = result.consumable.nextDueDate
        ? formatRussianDate(result.consumable.nextDueDate)
        : null;
      let message = 'Замена отмечена';
      if (next) message += `\nСледующая замена — ${next}`;
      if (result.reminders.failedCount > 0 || result.reminders.permissionDenied) {
        message += '\n\nЗамена сохранена, но напоминание создать не удалось.';
      }
      Alert.alert('Готово', message);
      setShowHistory(false);
      load();
    } catch (err) {
      if (err instanceof AppError && err.code === 'STOCK_ZERO_CONFIRM') {
        Alert.alert(
          'В запасе указано 0 шт.',
          'Отметить замену всё равно?',
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Отметить',
              onPress: () => void runMarkReplaced(true, date, note),
            },
          ],
        );
        return;
      }
      Alert.alert('Ошибка', 'Не удалось отметить замену');
    } finally {
      setBusy(false);
    }
  };

  const handleAddStock = () => {
    if (!consumableService || !id) return;
    Alert.alert('Пополнить запас', 'Сколько добавить?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: '+1',
        onPress: () =>
          void consumableService
            .addStock(id, 1)
            .then(() => load())
            .catch(() => Alert.alert('Ошибка', 'Не удалось изменить запас')),
      },
      {
        text: '+3',
        onPress: () =>
          void consumableService
            .addStock(id, 3)
            .then(() => load())
            .catch(() => Alert.alert('Ошибка', 'Не удалось изменить запас')),
      },
      {
        text: '+5',
        onPress: () =>
          void consumableService
            .addStock(id, 5)
            .then(() => load())
            .catch(() => Alert.alert('Ошибка', 'Не удалось изменить запас')),
      },
    ]);
  };

  const handleSetStock = async () => {
    if (!consumableService || !id) return;
    const quantity = Number(stockInput);
    if (!Number.isInteger(quantity) || quantity < 0) {
      Alert.alert('Ошибка', 'Укажите целое число ≥ 0');
      return;
    }
    try {
      await consumableService.setStock(id, quantity);
      load();
    } catch {
      Alert.alert('Ошибка', 'Не удалось изменить запас');
    }
  };

  const confirmDelete = () => {
    if (!consumable) return;
    Alert.alert(
      `Удалить расходник «${consumable.name}»?`,
      'История замен будет удалена.',
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
    if (!consumableService || !id) return;
    try {
      await consumableService.delete(id);
      router.back();
    } catch {
      Alert.alert('Ошибка', 'Не удалось удалить расходник');
    }
  };

  if (!consumable) {
    return (
      <>
        <Stack.Screen options={{ title: 'Расходник' }} />
        <Screen><></></Screen>
      </>
    );
  }

  const status = presentConsumableStatus(consumable);
  const stock = presentStock(consumable);
  const interval = presentInterval(
    consumable.replacementIntervalValue,
    consumable.replacementIntervalUnit,
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: consumable.name,
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
            <Pressable onPress={() => router.push(`/item/${consumable.itemId}`)}>
              <Text style={[styles.itemName, { color: colors.primary }]}>
                {itemName}
              </Text>
            </Pressable>
          ) : null}

          <Card style={styles.section}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Статус</Text>
            <Text style={[styles.value, { color: colors.text }]}>{status.primary}</Text>
            {status.secondary ? (
              <Text style={[styles.detail, { color: colors.textSecondary }]}>
                {status.secondary}
              </Text>
            ) : null}
            {consumable.modelOrArticle ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>Артикул</Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {consumable.modelOrArticle}
                </Text>
              </>
            ) : null}
            {consumable.manufacturer ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Производитель
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {consumable.manufacturer}
                </Text>
              </>
            ) : null}
            {interval ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Период замены
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>{interval}</Text>
              </>
            ) : null}
            {consumable.nextDueDate ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Следующая замена
                </Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {formatRussianDate(consumable.nextDueDate)}
                </Text>
              </>
            ) : null}
            {stock ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>Запас</Text>
                <Text style={[styles.value, { color: colors.text }]}>{stock}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>Запас</Text>
                <Text style={[styles.value, { color: colors.textSecondary }]}>
                  Запас не указан
                </Text>
              </>
            )}
          </Card>

          <Button
            title={busy ? '…' : 'Заменил'}
            onPress={() => void runMarkReplaced(false)}
            disabled={busy}
          />

          {consumable.stockQuantity != null ? (
            <View style={styles.stockActions}>
              <Button title="Пополнить запас" variant="secondary" onPress={handleAddStock} />
              <View style={styles.setStockRow}>
                <TextInput
                  value={stockInput}
                  onChangeText={setStockInput}
                  keyboardType="number-pad"
                  style={[
                    styles.stockField,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                />
                <Button title="Изменить запас" variant="ghost" onPress={() => void handleSetStock()} />
              </View>
            </View>
          ) : null}

          <Button
            title="Редактировать"
            variant="secondary"
            onPress={() => router.push(`/consumable/edit/${consumable.id}`)}
            style={styles.secondary}
          />
          <Button
            title="Добавить замену"
            variant="ghost"
            onPress={() => setShowHistory((v) => !v)}
          />

          {showHistory ? (
            <Card style={styles.section}>
              <DateOnlyField
                label="Дата замены"
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
                  void runMarkReplaced(
                    true,
                    historyDate,
                    historyNote.trim() || undefined,
                  )
                }
                disabled={busy || !historyDate}
              />
            </Card>
          ) : null}

          <Text style={[styles.historyTitle, { color: colors.text }]}>История</Text>
          {events.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              Пока нет записей
            </Text>
          ) : (
            events.map((event) => {
              const presented = presentConsumableEvent(event);
              return (
                <View
                  key={event.id}
                  style={[
                    styles.eventRow,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  <Text style={[styles.eventDate, { color: colors.text }]}>
                    {presented.dateLabel}
                  </Text>
                  <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                    {presented.title}
                  </Text>
                  {presented.detail ? (
                    <Text style={{ color: colors.textMuted, ...typography.caption }}>
                      {presented.detail}
                    </Text>
                  ) : null}
                </View>
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
  itemName: { ...typography.subtitle, marginBottom: spacing.md },
  section: { marginBottom: spacing.md, gap: spacing.xs },
  label: { ...typography.caption, marginTop: spacing.sm },
  value: { ...typography.body },
  detail: { ...typography.caption },
  secondary: { marginTop: spacing.sm },
  stockActions: { marginTop: spacing.sm, gap: spacing.sm },
  setStockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stockField: {
    ...typography.body,
    minHeight: 48,
    minWidth: 72,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  historyTitle: {
    ...typography.subtitle,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  empty: { ...typography.body, marginBottom: spacing.xl },
  eventRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 2,
  },
  eventDate: { ...typography.body, fontWeight: '600' },
});
