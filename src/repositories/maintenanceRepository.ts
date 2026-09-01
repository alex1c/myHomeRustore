/**
 * Maintenance repository — rules and performed service events.
 */

import { AppError } from '@/src/domain/errors';
import { createEntityIdSync } from '@/src/domain/ids';
import type { MaintenanceEvent, MaintenanceRule } from '@/src/domain/types';
import type { SqlDatabase } from '@/src/db/types';
import { nowUtcInstant } from '@/src/utils/datetime';

type RuleRow = {
  id: string;
  item_id: string;
  title: string;
  interval_value: number | null;
  interval_unit: string | null;
  last_completed_date: string | null;
  next_due_date: string | null;
  enabled: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  item_id: string;
  maintenance_rule_id: string | null;
  performed_at: string;
  cost_minor: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function mapRule(row: RuleRow): MaintenanceRule {
  return {
    id: row.id,
    itemId: row.item_id,
    title: row.title,
    intervalValue: row.interval_value,
    intervalUnit: row.interval_unit as MaintenanceRule['intervalUnit'],
    lastCompletedDate: row.last_completed_date,
    nextDueDate: row.next_due_date,
    enabled: row.enabled === 1,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: EventRow): MaintenanceEvent {
  return {
    id: row.id,
    itemId: row.item_id,
    maintenanceRuleId: row.maintenance_rule_id,
    performedAt: row.performed_at,
    costMinor: row.cost_minor,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MaintenanceRepository {
  constructor(private readonly db: SqlDatabase) {}

  createRule(input: {
    itemId: string;
    title: string;
    intervalValue?: number | null;
    intervalUnit?: string | null;
    nextDueDate?: string | null;
    note?: string | null;
  }): MaintenanceRule {
    const now = nowUtcInstant();
    const id = createEntityIdSync();
    this.db.run(
      `INSERT INTO maintenance_rules
       (id, item_id, title, interval_value, interval_unit, last_completed_date,
        next_due_date, enabled, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 1, ?, ?, ?)`,
      [
        id,
        input.itemId,
        input.title.trim(),
        input.intervalValue ?? null,
        input.intervalUnit ?? null,
        input.nextDueDate ?? null,
        input.note ?? null,
        now,
        now,
      ],
    );
    return this.getRuleById(id)!;
  }

  getRuleById(id: string): MaintenanceRule | null {
    const row = this.db.getFirst<RuleRow>(
      'SELECT * FROM maintenance_rules WHERE id = ?',
      [id],
    );
    return row ? mapRule(row) : null;
  }

  createEvent(input: {
    itemId: string;
    maintenanceRuleId?: string | null;
    performedAt?: string;
    costMinor?: number | null;
    note?: string | null;
  }): MaintenanceEvent {
    const now = nowUtcInstant();
    const id = createEntityIdSync();
    try {
      this.db.run(
        `INSERT INTO maintenance_events
         (id, item_id, maintenance_rule_id, performed_at, cost_minor, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.itemId,
          input.maintenanceRuleId ?? null,
          input.performedAt ?? now,
          input.costMinor ?? null,
          input.note ?? null,
          now,
          now,
        ],
      );
    } catch (err) {
      throw new AppError('Failed to create maintenance event', { cause: err });
    }
    return this.getEventById(id)!;
  }

  getEventById(id: string): MaintenanceEvent | null {
    const row = this.db.getFirst<EventRow>(
      'SELECT * FROM maintenance_events WHERE id = ?',
      [id],
    );
    return row ? mapEvent(row) : null;
  }

  listEventsForItem(itemId: string): MaintenanceEvent[] {
    const rows = this.db.getAll<EventRow>(
      'SELECT * FROM maintenance_events WHERE item_id = ? ORDER BY performed_at DESC',
      [itemId],
    );
    return rows.map(mapEvent);
  }
}
