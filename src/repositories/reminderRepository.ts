/**
 * Reminder repository — persisted notification schedule metadata.
 */

import { createEntityIdSync } from '@/src/domain/ids';
import type { Reminder, ReminderType } from '@/src/domain/types';
import type { SqlDatabase } from '@/src/db/types';
import { nowUtcInstant } from '@/src/utils/datetime';

type ReminderRow = {
  id: string;
  item_id: string;
  reminder_type: string;
  warranty_id: string | null;
  maintenance_rule_id: string | null;
  consumable_id: string | null;
  due_at: string;
  notification_id: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    itemId: row.item_id,
    reminderType: row.reminder_type as ReminderType,
    warrantyId: row.warranty_id,
    maintenanceRuleId: row.maintenance_rule_id,
    consumableId: row.consumable_id,
    dueAt: row.due_at,
    notificationId: row.notification_id,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ReminderCreateInput {
  itemId: string;
  reminderType: ReminderType;
  warrantyId?: string | null;
  maintenanceRuleId?: string | null;
  consumableId?: string | null;
  dueAt: string;
  notificationId?: string | null;
  enabled?: boolean;
}

export class ReminderRepository {
  constructor(private readonly db: SqlDatabase) {}

  getById(id: string): Reminder | null {
    const row = this.db.getFirst<ReminderRow>(
      'SELECT * FROM reminders WHERE id = ?',
      [id],
    );
    return row ? mapRow(row) : null;
  }

  listByWarrantyId(warrantyId: string): Reminder[] {
    const rows = this.db.getAll<ReminderRow>(
      `SELECT * FROM reminders
       WHERE warranty_id = ? AND reminder_type = 'warranty'
       ORDER BY due_at ASC`,
      [warrantyId],
    );
    return rows.map(mapRow);
  }

  listByMaintenanceRuleId(ruleId: string): Reminder[] {
    const rows = this.db.getAll<ReminderRow>(
      `SELECT * FROM reminders
       WHERE maintenance_rule_id = ? AND reminder_type = 'maintenance'
       ORDER BY due_at ASC`,
      [ruleId],
    );
    return rows.map(mapRow);
  }

  listByConsumableId(consumableId: string): Reminder[] {
    const rows = this.db.getAll<ReminderRow>(
      `SELECT * FROM reminders
       WHERE consumable_id = ? AND reminder_type = 'consumable'
       ORDER BY due_at ASC`,
      [consumableId],
    );
    return rows.map(mapRow);
  }

  listNotificationIdsByItemId(itemId: string): string[] {
    return this.db
      .getAll<{ notification_id: string }>(
        `SELECT notification_id FROM reminders
         WHERE item_id = ? AND notification_id IS NOT NULL`,
        [itemId],
      )
      .map((row) => row.notification_id);
  }

  create(input: ReminderCreateInput): Reminder {
    const id = createEntityIdSync();
    const now = nowUtcInstant();
    this.db.run(
      `INSERT INTO reminders
       (id, item_id, reminder_type, warranty_id, maintenance_rule_id, consumable_id,
        due_at, notification_id, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.itemId,
        input.reminderType,
        input.warrantyId ?? null,
        input.maintenanceRuleId ?? null,
        input.consumableId ?? null,
        input.dueAt,
        input.notificationId ?? null,
        input.enabled === false ? 0 : 1,
        now,
        now,
      ],
    );
    return this.getById(id)!;
  }

  updateNotificationState(
    id: string,
    notificationId: string | null,
    enabled: boolean,
  ): Reminder {
    const now = nowUtcInstant();
    this.db.run(
      `UPDATE reminders SET notification_id = ?, enabled = ?, updated_at = ? WHERE id = ?`,
      [notificationId, enabled ? 1 : 0, now, id],
    );
    return this.getById(id)!;
  }

  deleteByWarrantyId(warrantyId: string): Reminder[] {
    const existing = this.listByWarrantyId(warrantyId);
    this.db.run(
      `DELETE FROM reminders WHERE warranty_id = ? AND reminder_type = 'warranty'`,
      [warrantyId],
    );
    return existing;
  }

  deleteByMaintenanceRuleId(ruleId: string): Reminder[] {
    const existing = this.listByMaintenanceRuleId(ruleId);
    this.db.run(
      `DELETE FROM reminders
       WHERE maintenance_rule_id = ? AND reminder_type = 'maintenance'`,
      [ruleId],
    );
    return existing;
  }

  deleteByConsumableId(consumableId: string): Reminder[] {
    const existing = this.listByConsumableId(consumableId);
    this.db.run(
      `DELETE FROM reminders
       WHERE consumable_id = ? AND reminder_type = 'consumable'`,
      [consumableId],
    );
    return existing;
  }

  delete(id: string): void {
    this.db.run('DELETE FROM reminders WHERE id = ?', [id]);
  }
}
