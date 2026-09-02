/**
 * Consumable reminder scheduling — cancel/reschedule with compensation.
 */

import { AppError } from '@/src/domain/errors';
import type { SqlDatabase } from '@/src/db/types';
import { ConsumableRepository } from '@/src/repositories/consumableRepository';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import type { NotificationAdapter } from '@/src/services/notificationAdapter';
import {
  isFutureMaintenanceReminderOffset,
  maintenanceReminderFireDate,
} from '@/src/utils/maintenanceDate';

export type ConsumableReminderScheduleResult = {
  permissionDenied: boolean;
  scheduledCount: number;
  failedCount: number;
};

export class ConsumableReminderService {
  private readonly consumables: ConsumableRepository;
  private readonly reminders: ReminderRepository;
  private readonly items: ItemRepository;

  constructor(
    db: SqlDatabase,
    private readonly notifications: NotificationAdapter,
  ) {
    this.consumables = new ConsumableRepository(db);
    this.reminders = new ReminderRepository(db);
    this.items = new ItemRepository(db);
  }

  async cancelForConsumable(consumableId: string): Promise<void> {
    const existing = this.reminders.listByConsumableId(consumableId);
    for (const reminder of existing) {
      if (reminder.notificationId) {
        try {
          await this.notifications.cancel(reminder.notificationId);
        } catch {
          // Best-effort cancel.
        }
      }
    }
    this.reminders.deleteByConsumableId(consumableId);
  }

  async reschedule(
    consumableId: string,
    offsets: number[],
    remindersEnabled: boolean,
  ): Promise<ConsumableReminderScheduleResult> {
    await this.cancelForConsumable(consumableId);

    if (!remindersEnabled || offsets.length === 0) {
      return { permissionDenied: false, scheduledCount: 0, failedCount: 0 };
    }

    const consumable = this.consumables.getById(consumableId);
    if (!consumable) {
      throw new AppError('Расходник не найден', { code: 'NOT_FOUND' });
    }
    if (!consumable.nextDueDate) {
      return { permissionDenied: false, scheduledCount: 0, failedCount: 0 };
    }

    const item = this.items.getById(consumable.itemId);
    const itemName = item?.name ?? 'Вещь';

    const allowed = await this.notifications.ensurePermission();
    if (!allowed) {
      return { permissionDenied: true, scheduledCount: 0, failedCount: 0 };
    }

    const futureOffsets = [...new Set(offsets)].filter(
      (offset) =>
        Number.isInteger(offset) &&
        offset >= 0 &&
        isFutureMaintenanceReminderOffset(consumable.nextDueDate!, offset),
    );

    let scheduledCount = 0;
    let failedCount = 0;

    for (const offset of futureOffsets) {
      const fireAt = maintenanceReminderFireDate(consumable.nextDueDate, offset);
      const dueAt = fireAt.toISOString();
      let notificationId: string | null = null;
      try {
        notificationId = await this.notifications.schedule({
          title: 'Пора заменить расходник',
          body: `${consumable.name} — ${itemName}.`,
          fireAt,
          data: {
            itemId: consumable.itemId,
            consumableId: consumable.id,
          },
        });
        this.reminders.create({
          itemId: consumable.itemId,
          reminderType: 'consumable',
          consumableId: consumable.id,
          dueAt,
          enabled: true,
          notificationId,
        });
        scheduledCount += 1;
      } catch {
        if (notificationId) {
          try {
            await this.notifications.cancel(notificationId);
          } catch {
            // DB never claims unpersisted notification.
          }
        }
        failedCount += 1;
      }
    }

    return { permissionDenied: false, scheduledCount, failedCount };
  }
}
