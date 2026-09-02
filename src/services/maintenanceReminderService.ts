/**
 * Maintenance reminder scheduling — cancel/reschedule with compensation.
 * Reuses NotificationAdapter; does not affect warranty reminders.
 */

import { AppError } from '@/src/domain/errors';
import type { SqlDatabase } from '@/src/db/types';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { MaintenanceRepository } from '@/src/repositories/maintenanceRepository';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import type { NotificationAdapter } from '@/src/services/notificationAdapter';
import {
  isFutureMaintenanceReminderOffset,
  maintenanceReminderFireDate,
} from '@/src/utils/maintenanceDate';

export type MaintenanceReminderScheduleResult = {
  permissionDenied: boolean;
  scheduledCount: number;
  failedCount: number;
};

export class MaintenanceReminderService {
  private readonly rules: MaintenanceRepository;
  private readonly reminders: ReminderRepository;
  private readonly items: ItemRepository;

  constructor(
    db: SqlDatabase,
    private readonly notifications: NotificationAdapter,
  ) {
    this.rules = new MaintenanceRepository(db);
    this.reminders = new ReminderRepository(db);
    this.items = new ItemRepository(db);
  }

  async cancelForRule(ruleId: string): Promise<void> {
    const existing = this.reminders.listByMaintenanceRuleId(ruleId);
    for (const reminder of existing) {
      if (reminder.notificationId) {
        try {
          await this.notifications.cancel(reminder.notificationId);
        } catch {
          // Best-effort cancel.
        }
      }
    }
    this.reminders.deleteByMaintenanceRuleId(ruleId);
  }

  async reschedule(
    ruleId: string,
    offsets: number[],
    remindersEnabled: boolean,
  ): Promise<MaintenanceReminderScheduleResult> {
    await this.cancelForRule(ruleId);

    if (!remindersEnabled || offsets.length === 0) {
      return { permissionDenied: false, scheduledCount: 0, failedCount: 0 };
    }

    const rule = this.rules.getRuleById(ruleId);
    if (!rule) {
      throw new AppError('Обслуживание не найдено', { code: 'NOT_FOUND' });
    }
    if (!rule.nextDueDate) {
      return { permissionDenied: false, scheduledCount: 0, failedCount: 0 };
    }

    const item = this.items.getById(rule.itemId);
    const itemName = item?.name ?? 'Вещь';

    const allowed = await this.notifications.ensurePermission();
    if (!allowed) {
      return { permissionDenied: true, scheduledCount: 0, failedCount: 0 };
    }

    const futureOffsets = [...new Set(offsets)].filter(
      (offset) =>
        Number.isInteger(offset) &&
        offset >= 0 &&
        isFutureMaintenanceReminderOffset(rule.nextDueDate!, offset),
    );

    let scheduledCount = 0;
    let failedCount = 0;

    for (const offset of futureOffsets) {
      const fireAt = maintenanceReminderFireDate(rule.nextDueDate, offset);
      const dueAt = fireAt.toISOString();

      let notificationId: string | null = null;
      try {
        notificationId = await this.notifications.schedule({
          title: 'Пора выполнить обслуживание',
          body: `${rule.title} — ${itemName}.`,
          fireAt,
          data: {
            itemId: rule.itemId,
            maintenanceRuleId: rule.id,
          },
        });
        this.reminders.create({
          itemId: rule.itemId,
          reminderType: 'maintenance',
          maintenanceRuleId: rule.id,
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
            // DB never claims an unpersisted notification.
          }
        }
        failedCount += 1;
      }
    }

    return { permissionDenied: false, scheduledCount, failedCount };
  }
}
