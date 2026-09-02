/**
 * Maintenance repository — rules and performed service events.
 */

import { AppError } from '@/src/domain/errors';
import { createEntityIdSync } from '@/src/domain/ids';
import type {
  DateOnly,
  IntervalUnit,
  MaintenanceEvent,
  MaintenanceRule,
} from '@/src/domain/types';
import type { MaintenanceListFilters } from '@/src/domain/maintenance';
import type { SqlDatabase } from '@/src/db/types';
import {
  dateOnlyToUtcNoon,
  nowUtcInstant,
  utcInstantToDateOnly,
} from '@/src/utils/datetime';
import { daysUntilDateOnly } from '@/src/utils/warrantyDate';
import { computeMaintenanceDueKind } from '@/src/utils/maintenanceDate';

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

export type MaintenanceListRow = {
  rule: MaintenanceRule;
  itemId: string;
  itemName: string;
  itemBrand: string | null;
  itemModel: string | null;
  daysUntilDue: number | null;
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

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

export class MaintenanceRepository {
  constructor(private readonly db: SqlDatabase) {}

  createRule(input: {
    itemId: string;
    title: string;
    intervalValue?: number | null;
    intervalUnit?: IntervalUnit | null;
    nextDueDate?: DateOnly | null;
    lastCompletedDate?: DateOnly | null;
    note?: string | null;
    enabled?: boolean;
  }): MaintenanceRule {
    const title = input.title.trim();
    if (!title) {
      throw new AppError('Введите название работы');
    }
    const now = nowUtcInstant();
    const id = createEntityIdSync();
    this.db.run(
      `INSERT INTO maintenance_rules
       (id, item_id, title, interval_value, interval_unit, last_completed_date,
        next_due_date, enabled, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.itemId,
        title,
        input.intervalValue ?? null,
        input.intervalUnit ?? null,
        input.lastCompletedDate ?? null,
        input.nextDueDate ?? null,
        input.enabled === false ? 0 : 1,
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

  listRulesByItemId(itemId: string): MaintenanceRule[] {
    const rows = this.db.getAll<RuleRow>(
      `SELECT * FROM maintenance_rules WHERE item_id = ?
       ORDER BY
         CASE WHEN next_due_date IS NULL THEN 1 ELSE 0 END,
         next_due_date ASC,
         created_at DESC`,
      [itemId],
    );
    return rows.map(mapRule);
  }

  updateRule(
    id: string,
    input: {
      title?: string;
      intervalValue?: number | null;
      intervalUnit?: IntervalUnit | null;
      nextDueDate?: DateOnly | null;
      lastCompletedDate?: DateOnly | null;
      note?: string | null;
      enabled?: boolean;
      clearNextDue?: boolean;
      clearInterval?: boolean;
    },
  ): MaintenanceRule {
    const existing = this.getRuleById(id);
    if (!existing) {
      throw new AppError('Обслуживание не найдено', { code: 'NOT_FOUND' });
    }

    const title =
      input.title !== undefined ? input.title.trim() : existing.title;
    if (!title) {
      throw new AppError('Введите название работы');
    }

    const nextDueDate = input.clearNextDue
      ? null
      : input.nextDueDate !== undefined
        ? input.nextDueDate
        : existing.nextDueDate;

    const intervalValue = input.clearInterval
      ? null
      : input.intervalValue !== undefined
        ? input.intervalValue
        : existing.intervalValue;
    const intervalUnit = input.clearInterval
      ? null
      : input.intervalUnit !== undefined
        ? input.intervalUnit
        : existing.intervalUnit;

    const now = nowUtcInstant();
    this.db.run(
      `UPDATE maintenance_rules SET
        title = ?,
        interval_value = ?,
        interval_unit = ?,
        last_completed_date = ?,
        next_due_date = ?,
        enabled = ?,
        note = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        title,
        intervalValue,
        intervalUnit,
        input.lastCompletedDate !== undefined
          ? input.lastCompletedDate
          : existing.lastCompletedDate,
        nextDueDate,
        input.enabled !== undefined
          ? input.enabled
            ? 1
            : 0
          : existing.enabled
            ? 1
            : 0,
        input.note !== undefined ? input.note : existing.note,
        now,
        id,
      ],
    );
    return this.getRuleById(id)!;
  }

  deleteRule(id: string): void {
    const existing = this.getRuleById(id);
    if (!existing) {
      throw new AppError('Обслуживание не найдено', { code: 'NOT_FOUND' });
    }
    // Events referencing this rule are SET NULL by FK; delete them explicitly
    // so history for the rule is removed with the rule.
    this.db.run(
      'DELETE FROM maintenance_events WHERE maintenance_rule_id = ?',
      [id],
    );
    this.db.run('DELETE FROM maintenance_rules WHERE id = ?', [id]);
  }

  createEvent(input: {
    itemId: string;
    maintenanceRuleId?: string | null;
    /** Calendar date of the work; stored as noon-UTC instant. */
    performedDate: DateOnly;
    costMinor?: number | null;
    note?: string | null;
  }): MaintenanceEvent {
    if (!utcInstantToDateOnly(dateOnlyToUtcNoon(input.performedDate))) {
      throw new AppError('Некорректная дата выполнения');
    }
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
          dateOnlyToUtcNoon(input.performedDate),
          input.costMinor ?? null,
          input.note ?? null,
          now,
          now,
        ],
      );
    } catch (err) {
      throw new AppError('Не удалось сохранить выполнение', { cause: err });
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

  listEventsForRule(ruleId: string): MaintenanceEvent[] {
    const rows = this.db.getAll<EventRow>(
      `SELECT * FROM maintenance_events
       WHERE maintenance_rule_id = ?
       ORDER BY performed_at DESC, created_at DESC`,
      [ruleId],
    );
    return rows.map(mapEvent);
  }

  listEventsForItem(itemId: string): MaintenanceEvent[] {
    const rows = this.db.getAll<EventRow>(
      'SELECT * FROM maintenance_events WHERE item_id = ? ORDER BY performed_at DESC',
      [itemId],
    );
    return rows.map(mapEvent);
  }

  getLatestEventForRule(ruleId: string): MaintenanceEvent | null {
    const row = this.db.getFirst<EventRow>(
      `SELECT * FROM maintenance_events
       WHERE maintenance_rule_id = ?
       ORDER BY performed_at DESC, created_at DESC
       LIMIT 1`,
      [ruleId],
    );
    return row ? mapEvent(row) : null;
  }

  updateEvent(
    id: string,
    input: { performedDate?: DateOnly; note?: string | null },
  ): MaintenanceEvent {
    const existing = this.getEventById(id);
    if (!existing) {
      throw new AppError('Запись истории не найдена', { code: 'NOT_FOUND' });
    }
    const performedAt =
      input.performedDate !== undefined
        ? dateOnlyToUtcNoon(input.performedDate)
        : existing.performedAt;
    const now = nowUtcInstant();
    this.db.run(
      `UPDATE maintenance_events SET
        performed_at = ?,
        note = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        performedAt,
        input.note !== undefined ? input.note : existing.note,
        now,
        id,
      ],
    );
    return this.getEventById(id)!;
  }

  deleteEvent(id: string): MaintenanceEvent {
    const existing = this.getEventById(id);
    if (!existing) {
      throw new AppError('Запись истории не найдена', { code: 'NOT_FOUND' });
    }
    this.db.run('DELETE FROM maintenance_events WHERE id = ?', [id]);
    return existing;
  }

  /**
   * Property-scoped list with item join (no N+1).
   * Status filtering is applied in memory for clear calendar semantics.
   */
  listForProperty(
    propertyId: string,
    filters: MaintenanceListFilters,
    referenceDate: DateOnly,
  ): MaintenanceListRow[] {
    const params: (string | number)[] = [propertyId];
    let sql = `
      SELECT r.*,
        i.name AS item_name,
        i.brand AS item_brand,
        i.model AS item_model
      FROM maintenance_rules r
      JOIN items i ON i.id = r.item_id
      WHERE i.property_id = ? AND i.status = 'active' AND r.enabled = 1
    `;

    const search = filters.search.trim();
    if (search) {
      const like = `%${escapeLike(search)}%`;
      sql += ` AND (
        r.title LIKE ? ESCAPE '\\' OR
        i.name LIKE ? ESCAPE '\\' OR
        IFNULL(i.brand, '') LIKE ? ESCAPE '\\' OR
        IFNULL(i.model, '') LIKE ? ESCAPE '\\'
      )`;
      params.push(like, like, like, like);
    }

    sql += ' ORDER BY r.next_due_date IS NULL, r.next_due_date ASC';

    const rows = this.db.getAll<
      RuleRow & {
        item_name: string;
        item_brand: string | null;
        item_model: string | null;
      }
    >(sql, params);

    const mapped: MaintenanceListRow[] = rows.map((row) => {
      const rule = mapRule(row);
      const daysUntilDue =
        rule.nextDueDate != null
          ? daysUntilDateOnly(rule.nextDueDate, referenceDate)
          : null;
      return {
        rule,
        itemId: rule.itemId,
        itemName: row.item_name,
        itemBrand: row.item_brand,
        itemModel: row.item_model,
        daysUntilDue,
      };
    });

    let filtered = mapped;
    if (filters.filter === 'overdue') {
      filtered = mapped.filter((row) => {
        const kind = computeMaintenanceDueKind(row.rule.nextDueDate, referenceDate);
        return kind === 'overdue';
      });
    } else if (filters.filter === 'upcoming') {
      filtered = mapped.filter((row) => {
        const kind = computeMaintenanceDueKind(row.rule.nextDueDate, referenceDate);
        return kind === 'today' || kind === 'tomorrow' || kind === 'upcoming';
      });
    }

    return filtered.sort((a, b) => {
      const ad = a.daysUntilDue;
      const bd = b.daysUntilDue;
      if (ad == null && bd == null) return 0;
      if (ad == null) return 1;
      if (bd == null) return -1;
      return ad - bd;
    });
  }

  /** Today attention: all overdue + due within aheadDays (inclusive). */
  listAttentionForProperty(
    propertyId: string,
    aheadDays: number,
    referenceDate: DateOnly,
  ): MaintenanceListRow[] {
    const all = this.listForProperty(
      propertyId,
      { search: '', filter: 'all' },
      referenceDate,
    );
    return all
      .filter((row) => {
        if (row.daysUntilDue == null) return false;
        return row.daysUntilDue <= aheadDays;
      })
      .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0));
  }
}
