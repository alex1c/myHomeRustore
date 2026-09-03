/**
 * Maintenance orchestration — rules, history, mark-done, reminder reschedule.
 *
 * DB transaction covers event + rule updates only.
 * OS notifications run after commit with Phase-3 compensation patterns.
 */

import { AppError } from '@/src/domain/errors';
import type {
  DateOnly,
  IntervalUnit,
  MaintenanceEvent,
  MaintenanceRule,
} from '@/src/domain/types';
import type {
  MaintenanceFormValues,
  MaintenanceListFilters,
} from '@/src/domain/maintenance';
import type { SqlDatabase } from '@/src/db/types';
import { ItemRepository } from '@/src/repositories/itemRepository';
import {
  MaintenanceRepository,
  type MaintenanceListRow,
} from '@/src/repositories/maintenanceRepository';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import { Analytics } from '@/src/services/AnalyticsService';
import type { NotificationAdapter } from '@/src/services/notificationAdapter';
import {
  MaintenanceReminderService,
  type MaintenanceReminderScheduleResult,
} from '@/src/services/maintenanceReminderService';
import {
  computeNextDueDate,
  recomputeNextDueFromLatestCompletion,
  resolveInitialNextDue,
} from '@/src/utils/maintenanceDate';
import {
  toLocalDateOnly,
  utcInstantToDateOnly,
} from '@/src/utils/datetime';
import { daysUntilDateOnly } from '@/src/utils/warrantyDate';

export type MaintenanceSaveResult = {
  rule: MaintenanceRule;
  reminders: MaintenanceReminderScheduleResult;
};

export type MarkDoneResult = {
  event: MaintenanceEvent;
  rule: MaintenanceRule;
  reminders: MaintenanceReminderScheduleResult;
};

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class MaintenanceService {
  private readonly db: SqlDatabase;
  private readonly rules: MaintenanceRepository;
  private readonly items: ItemRepository;
  private readonly reminders: ReminderRepository;
  private readonly reminderService: MaintenanceReminderService;

  constructor(db: SqlDatabase, notifications: NotificationAdapter) {
    this.db = db;
    this.rules = new MaintenanceRepository(db);
    this.items = new ItemRepository(db);
    this.reminders = new ReminderRepository(db);
    this.reminderService = new MaintenanceReminderService(db, notifications);
  }

  listByItem(itemId: string): MaintenanceRule[] {
    return this.rules.listRulesByItemId(itemId);
  }

  getRuleById(id: string): MaintenanceRule | null {
    return this.rules.getRuleById(id);
  }

  listEventsForRule(ruleId: string): MaintenanceEvent[] {
    return this.rules.listEventsForRule(ruleId);
  }

  listForProperty(
    propertyId: string,
    filters: MaintenanceListFilters,
    referenceDate: DateOnly = toLocalDateOnly(),
  ): MaintenanceListRow[] {
    return this.rules.listForProperty(propertyId, filters, referenceDate);
  }

  listAttentionForProperty(
    propertyId: string,
    aheadDays: number,
    referenceDate: DateOnly = toLocalDateOnly(),
  ): MaintenanceListRow[] {
    return this.rules.listAttentionForProperty(
      propertyId,
      aheadDays,
      referenceDate,
    );
  }

  async create(
    itemId: string,
    values: MaintenanceFormValues,
  ): Promise<MaintenanceSaveResult> {
    const item = this.items.getById(itemId);
    if (!item) {
      throw new AppError('Вещь не найдена', { code: 'NOT_FOUND' });
    }

    const nextDueDate = resolveInitialNextDue({
      dueMode: values.dueMode,
      nextDueDate: values.nextDueDate,
      intervalValue: values.intervalValue,
      intervalUnit: values.intervalUnit,
    });

    const rule = this.rules.createRule({
      itemId,
      title: values.title,
      intervalValue: values.intervalValue,
      intervalUnit: values.intervalUnit,
      nextDueDate,
      note: optionalText(values.note),
    });

    const reminders = await this.reminderService.reschedule(
      rule.id,
      values.reminderOffsets,
      values.remindersEnabled,
    );

    // Count successful creates only; no titles or notes.
    Analytics.maintenanceCreated();
    return { rule, reminders };
  }

  async update(
    id: string,
    values: MaintenanceFormValues,
  ): Promise<MaintenanceSaveResult> {
    const existing = this.rules.getRuleById(id);
    if (!existing) {
      throw new AppError('Обслуживание не найдено', { code: 'NOT_FOUND' });
    }

    // On edit, explicit next due wins; otherwise keep existing unless dueMode forces recalc.
    let nextDueDate = existing.nextDueDate;
    if (values.dueMode === 'explicit' && values.nextDueDate) {
      nextDueDate = values.nextDueDate;
    } else if (values.nextDueDate) {
      nextDueDate = values.nextDueDate;
    }

    const rule = this.rules.updateRule(id, {
      title: values.title,
      intervalValue: values.intervalValue,
      intervalUnit: values.intervalUnit as IntervalUnit | null,
      nextDueDate,
      note: optionalText(values.note),
      clearInterval:
        values.intervalValue == null || values.intervalUnit == null,
    });

    const reminders = await this.reminderService.reschedule(
      rule.id,
      values.reminderOffsets,
      values.remindersEnabled,
    );

    return { rule, reminders };
  }

  /**
   * Mark done: create event + update next due in one DB transaction,
   * then reschedule notifications outside the transaction.
   */
  async markDone(
    ruleId: string,
    performedDate: DateOnly = toLocalDateOnly(),
    note?: string | null,
  ): Promise<MarkDoneResult> {
    const existing = this.rules.getRuleById(ruleId);
    if (!existing) {
      throw new AppError('Обслуживание не найдено', { code: 'NOT_FOUND' });
    }

    // Capture preferred offsets before next-due changes and reminder cancel.
    const preferred = this.recoverReminderPrefs(ruleId, existing.nextDueDate);

    const { event, rule } = this.db.withTransaction(() => {
      const created = this.rules.createEvent({
        itemId: existing.itemId,
        maintenanceRuleId: ruleId,
        performedDate,
        note: note ?? null,
      });

      const nextDue = computeNextDueDate(
        performedDate,
        existing.intervalValue,
        existing.intervalUnit,
      );

      const updated = this.rules.updateRule(ruleId, {
        lastCompletedDate: performedDate,
        nextDueDate: nextDue,
        clearNextDue: nextDue == null,
      });

      return { event: created, rule: updated };
    });

    const reminders = await this.reminderService.reschedule(
      ruleId,
      preferred.offsets,
      preferred.enabled,
    );

    // Fired after DB commit + reminder reschedule succeed.
    Analytics.maintenanceCompleted();
    return { event, rule, reminders };
  }

  /** Add a historical completion (may be backdated). */
  async addHistoryEvent(
    ruleId: string,
    performedDate: DateOnly,
    note?: string | null,
  ): Promise<MarkDoneResult> {
    return this.markDone(ruleId, performedDate, note);
  }

  async updateEvent(
    eventId: string,
    input: { performedDate?: DateOnly; note?: string | null },
  ): Promise<{ event: MaintenanceEvent; rule: MaintenanceRule | null; reminders: MaintenanceReminderScheduleResult | null }> {
    const existing = this.rules.getEventById(eventId);
    if (!existing) {
      throw new AppError('Запись истории не найдена', { code: 'NOT_FOUND' });
    }

    const ruleId = existing.maintenanceRuleId;
    const wasLatest =
      ruleId != null &&
      this.rules.getLatestEventForRule(ruleId)?.id === eventId;

    const event = this.db.withTransaction(() => {
      const updated = this.rules.updateEvent(eventId, input);
      if (wasLatest && ruleId && input.performedDate) {
        const rule = this.rules.getRuleById(ruleId);
        if (rule) {
          const nextDue = computeNextDueDate(
            input.performedDate,
            rule.intervalValue,
            rule.intervalUnit,
          );
          this.rules.updateRule(ruleId, {
            lastCompletedDate: input.performedDate,
            nextDueDate: nextDue,
            clearNextDue: nextDue == null,
          });
        }
      }
      return updated;
    });

    if (wasLatest && ruleId) {
      const ruleBefore = this.rules.getRuleById(ruleId);
      const preferred = this.recoverReminderPrefs(
        ruleId,
        ruleBefore?.nextDueDate ?? null,
      );
      const reminders = await this.reminderService.reschedule(
        ruleId,
        preferred.offsets,
        preferred.enabled,
      );
      return {
        event,
        rule: this.rules.getRuleById(ruleId),
        reminders,
      };
    }

    return {
      event,
      rule: ruleId ? this.rules.getRuleById(ruleId) : null,
      reminders: null,
    };
  }

  async deleteEvent(eventId: string): Promise<{
    rule: MaintenanceRule | null;
    reminders: MaintenanceReminderScheduleResult | null;
  }> {
    const existing = this.rules.getEventById(eventId);
    if (!existing) {
      throw new AppError('Запись истории не найдена', { code: 'NOT_FOUND' });
    }

    const ruleId = existing.maintenanceRuleId;
    const wasLatest =
      ruleId != null &&
      this.rules.getLatestEventForRule(ruleId)?.id === eventId;

    const preferred =
      ruleId != null
        ? this.recoverReminderPrefs(
            ruleId,
            this.rules.getRuleById(ruleId)?.nextDueDate ?? null,
          )
        : { offsets: [0], enabled: true };

    this.db.withTransaction(() => {
      this.rules.deleteEvent(eventId);
      if (wasLatest && ruleId) {
        const rule = this.rules.getRuleById(ruleId);
        if (!rule) return;
        const latest = this.rules.getLatestEventForRule(ruleId);
        const latestDate = latest
          ? utcInstantToDateOnly(latest.performedAt)
          : null;
        const nextDue = recomputeNextDueFromLatestCompletion({
          rule,
          latestCompletionDate: latestDate,
          fallbackNextDue: latestDate
            ? computeNextDueDate(
                latestDate,
                rule.intervalValue,
                rule.intervalUnit,
              )
            : null,
        });
        this.rules.updateRule(ruleId, {
          lastCompletedDate: latestDate,
          nextDueDate: nextDue,
          clearNextDue: nextDue == null,
        });
      }
    });

    if (wasLatest && ruleId) {
      const reminders = await this.reminderService.reschedule(
        ruleId,
        preferred.offsets,
        preferred.enabled,
      );
      return { rule: this.rules.getRuleById(ruleId), reminders };
    }

    return {
      rule: ruleId ? this.rules.getRuleById(ruleId) : null,
      reminders: null,
    };
  }

  async deleteRule(id: string): Promise<void> {
    await this.reminderService.cancelForRule(id);
    this.rules.deleteRule(id);
  }

  /**
   * Recover reminder offsets from existing rows relative to current next due.
   * Falls back to on-due-day when nothing is scheduled yet.
   */
  private recoverReminderPrefs(
    ruleId: string,
    nextDueDate: DateOnly | null,
  ): { offsets: number[]; enabled: boolean } {
    const rows = this.reminders.listByMaintenanceRuleId(ruleId);
    if (rows.length === 0 || !nextDueDate) {
      return { offsets: [0], enabled: true };
    }

    const offsets = [
      ...new Set(
        rows.map((row) => {
          const fireDateOnly = toLocalDateOnly(new Date(row.dueAt));
          return daysUntilDateOnly(nextDueDate, fireDateOnly);
        }),
      ),
    ].filter((offset) => Number.isInteger(offset) && offset >= 0);

    return {
      offsets: offsets.length > 0 ? offsets : [0],
      enabled: rows.some((row) => row.enabled),
    };
  }
}
