/**
 * Warranty orchestration — create/update/delete with reminder rescheduling.
 */

import { AppError } from '@/src/domain/errors';
import type { Warranty } from '@/src/domain/types';
import type { WarrantyFormValues, WarrantyType } from '@/src/domain/warranty';
import type { SqlDatabase } from '@/src/db/types';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { PurchaseRepository } from '@/src/repositories/purchaseRepository';
import { WarrantyRepository } from '@/src/repositories/warrantyRepository';
import type { NotificationAdapter } from '@/src/services/notificationAdapter';
import {
  WarrantyReminderService,
  type WarrantyReminderScheduleResult,
} from '@/src/services/warrantyReminderService';
import { resolveWarrantyEndDate } from '@/src/utils/warrantyDate';

export type WarrantySaveResult = {
  warranty: Warranty;
  reminders: WarrantyReminderScheduleResult;
};

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveStorageFields(values: WarrantyFormValues): {
  endDate: string | null;
  durationMonths: number | null;
} {
  if (values.endDate) {
    return { endDate: values.endDate, durationMonths: null };
  }
  if (values.durationMonths != null && values.durationMonths > 0) {
    return { endDate: null, durationMonths: values.durationMonths };
  }
  throw new AppError('Укажите срок гарантии или дату окончания');
}

export class WarrantyService {
  private readonly warranties: WarrantyRepository;
  private readonly items: ItemRepository;
  private readonly purchases: PurchaseRepository;
  private readonly reminderService: WarrantyReminderService;

  constructor(db: SqlDatabase, notifications: NotificationAdapter) {
    this.warranties = new WarrantyRepository(db);
    this.items = new ItemRepository(db);
    this.purchases = new PurchaseRepository(db);
    this.reminderService = new WarrantyReminderService(db, notifications);
  }

  listByItem(itemId: string): Warranty[] {
    return this.warranties.listByItemId(itemId);
  }

  getById(id: string): Warranty | null {
    return this.warranties.getById(id);
  }

  getDefaultStartDate(itemId: string): string | null {
    const purchase = this.purchases.getByItemId(itemId);
    return purchase?.purchaseDate ?? null;
  }

  async create(itemId: string, values: WarrantyFormValues): Promise<WarrantySaveResult> {
    const item = this.items.getById(itemId);
    if (!item) {
      throw new AppError('Вещь не найдена', { code: 'NOT_FOUND' });
    }

    const { endDate, durationMonths } = resolveStorageFields(values);
    const warranty = this.warranties.create({
      itemId,
      type: values.type as WarrantyType,
      provider: optionalText(values.provider),
      startDate: values.startDate,
      endDate,
      durationMonths,
      note: optionalText(values.note),
    });

    const reminders = await this.reminderService.reschedule(
      warranty.id,
      values.reminderOffsets,
      values.remindersEnabled,
    );

    return { warranty, reminders };
  }

  async update(id: string, values: WarrantyFormValues): Promise<WarrantySaveResult> {
    const existing = this.warranties.getById(id);
    if (!existing) {
      throw new AppError('Гарантия не найдена', { code: 'NOT_FOUND' });
    }

    const { endDate, durationMonths } = resolveStorageFields(values);
    const warranty = this.warranties.update(id, {
      type: values.type as WarrantyType,
      provider: optionalText(values.provider),
      startDate: values.startDate,
      endDate,
      durationMonths,
      note: optionalText(values.note),
      clearEndDate: endDate === null,
      clearDuration: durationMonths === null,
    });

    const reminders = await this.reminderService.reschedule(
      warranty.id,
      values.reminderOffsets,
      values.remindersEnabled,
    );

    return { warranty, reminders };
  }

  async delete(id: string): Promise<void> {
    await this.reminderService.cancelForWarranty(id);
    this.warranties.delete(id);
  }

  resolveEndDate(warranty: Warranty): string | null {
    return resolveWarrantyEndDate(warranty);
  }
}
