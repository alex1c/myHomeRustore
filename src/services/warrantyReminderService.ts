/**
 * Warranty reminder scheduling — cancel/reschedule with partial-failure safety.
 */

import { AppError } from '@/src/domain/errors';
import type { SqlDatabase } from '@/src/db/types';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import { WarrantyRepository } from '@/src/repositories/warrantyRepository';
import type { NotificationAdapter } from '@/src/services/notificationAdapter';
import {
  isFutureWarrantyReminderOffset,
  resolveWarrantyEndDate,
  warrantyReminderFireDate,
} from '@/src/utils/warrantyDate';

export type WarrantyReminderScheduleResult = {
  permissionDenied: boolean;
  scheduledCount: number;
  failedCount: number;
};

export class WarrantyReminderService {
  private readonly warranties: WarrantyRepository;
  private readonly reminders: ReminderRepository;
  private readonly items: ItemRepository;

  constructor(
    db: SqlDatabase,
    private readonly notifications: NotificationAdapter,
  ) {
    this.warranties = new WarrantyRepository(db);
    this.reminders = new ReminderRepository(db);
    this.items = new ItemRepository(db);
  }

  /** Cancel OS notifications and delete reminder rows for a warranty. */
  async cancelForWarranty(warrantyId: string): Promise<void> {
    const existing = this.reminders.listByWarrantyId(warrantyId);
    for (const reminder of existing) {
      if (reminder.notificationId) {
        try {
          await this.notifications.cancel(reminder.notificationId);
        } catch {
          // Best-effort cancel — stale OS notifications are acceptable.
        }
      }
    }
    this.reminders.deleteByWarrantyId(warrantyId);
  }

  /**
   * Reschedule warranty reminders from scratch.
   * Only future offsets are scheduled; past offsets are skipped.
   */
  async reschedule(
    warrantyId: string,
    offsets: number[],
    remindersEnabled: boolean,
  ): Promise<WarrantyReminderScheduleResult> {
    await this.cancelForWarranty(warrantyId);

    if (!remindersEnabled || offsets.length === 0) {
      return { permissionDenied: false, scheduledCount: 0, failedCount: 0 };
    }

    const warranty = this.warranties.getById(warrantyId);
    if (!warranty) {
      throw new AppError('Гарантия не найдена', { code: 'NOT_FOUND' });
    }

    const endDate = resolveWarrantyEndDate(warranty);
    if (!endDate) {
      return { permissionDenied: false, scheduledCount: 0, failedCount: 0 };
    }

    const item = this.items.getById(warranty.itemId);
    const itemName = item?.name ?? 'Вещь';

    const allowed = await this.notifications.ensurePermission();
    if (!allowed) {
      return { permissionDenied: true, scheduledCount: 0, failedCount: 0 };
    }

    const futureOffsets = offsets.filter((offset) =>
      isFutureWarrantyReminderOffset(endDate, offset),
    );

    let scheduledCount = 0;
    let failedCount = 0;

    for (const offset of futureOffsets) {
      const fireAt = warrantyReminderFireDate(endDate, offset);
      const dueAt = fireAt.toISOString();

      const reminder = this.reminders.create({
        itemId: warranty.itemId,
        reminderType: 'warranty',
        warrantyId: warranty.id,
        dueAt,
        enabled: true,
        notificationId: null,
      });

      try {
        const notificationId = await this.notifications.schedule({
          title: 'Скоро закончится гарантия',
          body: buildWarrantyReminderBody(itemName, endDate, offset),
          fireAt,
          data: {
            itemId: warranty.itemId,
            warrantyId: warranty.id,
            reminderId: reminder.id,
          },
        });
        this.reminders.updateNotificationState(reminder.id, notificationId, true);
        scheduledCount += 1;
      } catch {
        this.reminders.delete(reminder.id);
        failedCount += 1;
      }
    }

    return { permissionDenied: false, scheduledCount, failedCount };
  }
}

function buildWarrantyReminderBody(
  itemName: string,
  endDate: string,
  offsetDays: number,
): string {
  void endDate;
  if (offsetDays <= 1) {
    return `${itemName} — гарантия заканчивается завтра.`;
  }
  return `${itemName} — гарантия заканчивается через ${offsetDays} дней.`;
}
