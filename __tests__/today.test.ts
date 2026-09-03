/**
 * Smart Today aggregation, ranking, boundaries, and home overview tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import { EMPTY_CONSUMABLE_FORM } from '@/src/domain/consumables';
import { EMPTY_MAINTENANCE_FORM } from '@/src/domain/maintenance';
import { EMPTY_WARRANTY_FORM } from '@/src/domain/warranty';
import {
  TODAY_ATTENTION_PREVIEW_LIMIT,
  TODAY_UPCOMING_LIMIT,
} from '@/src/domain/today';
import { InventoryService } from '@/src/services/inventoryService';
import { ConsumableService } from '@/src/services/consumableService';
import { MaintenanceService } from '@/src/services/maintenanceService';
import { WarrantyService } from '@/src/services/warrantyService';
import { TodayService } from '@/src/services/todayService';
import { MockNotificationAdapter } from '@/src/services/notificationAdapter';
import { DocumentRepository } from '@/src/repositories/documentRepository';
import {
  buildTodayAttention,
  buildUpcomingAttention,
  summarizeAttention,
  takeAttentionPreview,
} from '@/src/utils/todayAttention';
import {
  todayGreeting,
  todayHeadline,
  todaySummaryLine,
} from '@/src/utils/todayPresentation';
import { addDaysToDateOnly, toLocalDateOnly } from '@/src/utils/datetime';
import type { WarrantyAttentionRow } from '@/src/repositories/warrantyRepository';
import type { MaintenanceListRow } from '@/src/repositories/maintenanceRepository';
import type { ConsumableListRow } from '@/src/repositories/consumableRepository';
import type { MaintenanceRule, Warranty } from '@/src/domain/types';

function dueIn(days: number): string {
  return addDaysToDateOnly(toLocalDateOnly(), days);
}

function fakeWarranty(
  id: string,
  itemName: string,
  daysUntilEnd: number,
): WarrantyAttentionRow {
  return {
    warranty: {
      id,
      itemId: 'item-1',
      type: 'manufacturer',
      provider: null,
      startDate: null,
      durationMonths: null,
      endDate: dueIn(daysUntilEnd),
      note: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Warranty,
    itemId: 'item-1',
    itemName,
    resolvedEndDate: dueIn(daysUntilEnd),
    daysUntilEnd,
  };
}

function fakeMaintenance(
  id: string,
  title: string,
  itemName: string,
  daysUntilDue: number,
): MaintenanceListRow {
  return {
    rule: {
      id,
      itemId: 'item-1',
      title,
      intervalValue: 30,
      intervalUnit: 'day',
      lastCompletedDate: null,
      nextDueDate: dueIn(daysUntilDue),
      enabled: true,
      note: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as MaintenanceRule,
    itemId: 'item-1',
    itemName,
    itemBrand: null,
    itemModel: null,
    daysUntilDue,
  };
}

function fakeConsumable(
  id: string,
  name: string,
  itemName: string,
  opts: {
    stockQuantity: number | null;
    daysUntilDue: number | null;
  },
): ConsumableListRow {
  const nextDueDate =
    opts.daysUntilDue == null ? null : dueIn(opts.daysUntilDue);
  return {
    consumable: {
      id,
      itemId: 'item-1',
      name,
      modelOrArticle: null,
      manufacturer: null,
      replacementIntervalValue: null,
      replacementIntervalUnit: null,
      lastReplacedDate: null,
      nextDueDate,
      stockQuantity: opts.stockQuantity,
      stockUnit: 'pcs',
      priceMinor: null,
      note: null,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    itemId: 'item-1',
    itemName,
    itemBrand: null,
    itemModel: null,
    daysUntilDue: opts.daysUntilDue,
  };
}

describe('todayAttention ranking', () => {
  test('orders mixed attention deterministically', () => {
    const attention = buildTodayAttention({
      warranties: [fakeWarranty('w1', 'TV', 3)],
      maintenance: [
        fakeMaintenance('m-over', 'Очистить фильтр', 'AC', -10),
        fakeMaintenance('m-soon', 'Проверить', 'AC', 1),
      ],
      consumables: [
        fakeConsumable('c-stock', 'Батарейки', 'Sensor', {
          stockQuantity: 0,
          daysUntilDue: null,
        }),
        fakeConsumable('c-soon', 'Фильтр', 'Coffee', {
          stockQuantity: 2,
          daysUntilDue: 10,
        }),
      ],
    });

    expect(attention.map((item) => item.id)).toEqual([
      'maintenance:m-over',
      'consumable:c-stock',
      'warranty:w1',
      'maintenance:m-soon',
      'consumable:c-soon',
    ]);
  });

  test('stock0 + overdue consumable is a single card', () => {
    const attention = buildTodayAttention({
      warranties: [],
      maintenance: [],
      consumables: [
        fakeConsumable('hepa', 'HEPA-фильтр', 'Robot', {
          stockQuantity: 0,
          daysUntilDue: -5,
        }),
      ],
    });

    expect(attention).toHaveLength(1);
    expect(attention[0]!.id).toBe('consumable:hepa');
    expect(attention[0]!.statusText).toContain('Запас закончился');
    expect(attention[0]!.statusText).toContain('просрочена');
    expect(summarizeAttention(attention)).toEqual({
      overdue: 1,
      warranties: 0,
      maintenance: 0,
      consumables: 1,
    });
  });

  test('preview limit leaves remaining count', () => {
    const maintenance = Array.from({ length: 8 }, (_, index) =>
      fakeMaintenance(`m${index}`, `Task ${index}`, 'Item', -index - 1),
    );
    const attention = buildTodayAttention({
      warranties: [],
      maintenance,
      consumables: [],
    });
    expect(attention).toHaveLength(8);
    const preview = takeAttentionPreview(attention);
    expect(preview).toHaveLength(TODAY_ATTENTION_PREVIEW_LIMIT);
    expect(attention.length - preview.length).toBe(3);
  });

  test('upcoming excludes items already in attention preview', () => {
    const attention = buildTodayAttention({
      warranties: [
        fakeWarranty('w-far', 'TV', 20),
        fakeWarranty('w-near', 'Fridge', 10),
      ],
      maintenance: [
        fakeMaintenance('m1', 'A', 'Item', -2),
        fakeMaintenance('m2', 'B', 'Item', -1),
        fakeMaintenance('m3', 'C', 'Item', 0),
        fakeMaintenance('m4', 'D', 'Item', 2),
        fakeMaintenance('m5', 'E', 'Item', 3),
        fakeMaintenance('m6', 'F', 'Item', 9),
      ],
      consumables: [],
    });

    const upcoming = buildUpcomingAttention(attention);
    const previewIds = new Set(
      takeAttentionPreview(attention).map((item) => item.id),
    );
    expect(upcoming.length).toBeLessThanOrEqual(TODAY_UPCOMING_LIMIT);
    for (const item of upcoming) {
      expect(previewIds.has(item.id)).toBe(false);
      expect(item.severity).toBe('upcoming');
    }
  });
});

describe('todayPresentation', () => {
  test('greeting and empty headline', () => {
    expect(todayGreeting(9)).toBe('Доброе утро');
    expect(todayGreeting(15)).toBe('Добрый день');
    expect(todayHeadline(0)).toContain('под контролем');
    expect(todayHeadline(4)).toContain('4');
    expect(todaySummaryLine([])).toBeNull();
  });
});

describe('TodayService', () => {
  async function setup() {
    const SQL = await initSqlJs();
    const db = createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
    const propertyId = db.getFirst<{ id: string }>(
      'SELECT id FROM properties LIMIT 1',
    )!.id;
    const notifications = new MockNotificationAdapter();
    return {
      db,
      propertyId,
      inventory: new InventoryService(db),
      warranties: new WarrantyService(db, notifications),
      maintenance: new MaintenanceService(db, notifications),
      consumables: new ConsumableService(db, notifications),
      documents: new DocumentRepository(db),
      today: new TodayService(db),
    };
  }

  test('fresh DB has empty attention and zero counts', async () => {
    const { propertyId, today } = await setup();
    const overview = today.getOverview(propertyId);
    expect(overview.attention).toEqual([]);
    expect(overview.attentionCount).toBe(0);
    expect(overview.upcoming).toEqual([]);
    expect(overview.recent).toEqual([]);
    expect(overview.counts.items).toBe(0);
    expect(overview.counts.documents).toBe(0);
  });

  test('one item only shows home summary without attention', async () => {
    const { propertyId, inventory, today } = await setup();
    inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Телевизор LG',
    });
    const overview = today.getOverview(propertyId);
    expect(overview.attentionCount).toBe(0);
    expect(overview.counts.items).toBe(1);
    expect(overview.recent).toHaveLength(1);
    expect(overview.recent[0]!.title).toContain('Телевизор LG');
  });

  test('title-only consumable and null stock are not attention', async () => {
    const { propertyId, inventory, consumables, today } = await setup();
    const item = inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Robot',
    });
    await consumables.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA',
      trackStock: false,
      stockQuantity: null,
      dueMode: 'none',
      nextDueDate: null,
      remindersEnabled: false,
    });
    const overview = today.getOverview(propertyId);
    expect(overview.attention).toEqual([]);
  });

  test('attention boundaries for warranty / maintenance / consumable', async () => {
    const { propertyId, inventory, warranties, maintenance, consumables, today } =
      await setup();
    const item = inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Device',
    });

    await warranties.create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      startDate: null,
      durationMonths: null,
      endDate: dueIn(30),
      remindersEnabled: false,
    });
    await warranties.create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      startDate: null,
      durationMonths: null,
      endDate: dueIn(31),
      remindersEnabled: false,
    });

    await maintenance.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Due14',
      dueMode: 'explicit',
      nextDueDate: dueIn(14),
      remindersEnabled: false,
    });
    await maintenance.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Due15',
      dueMode: 'explicit',
      nextDueDate: dueIn(15),
      remindersEnabled: false,
    });
    await maintenance.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Overdue',
      dueMode: 'explicit',
      nextDueDate: dueIn(-3),
      remindersEnabled: false,
    });

    await consumables.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Soon14',
      dueMode: 'explicit',
      nextDueDate: dueIn(14),
      intervalValue: 3,
      intervalUnit: 'month',
      remindersEnabled: false,
    });
    await consumables.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Soon15',
      dueMode: 'explicit',
      nextDueDate: dueIn(15),
      intervalValue: 3,
      intervalUnit: 'month',
      remindersEnabled: false,
    });
    await consumables.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'EmptyStock',
      trackStock: true,
      stockQuantity: 0,
      dueMode: 'none',
      remindersEnabled: false,
    });

    const overview = today.getOverview(propertyId);
    const titles = overview.attention.map((item) => item.title);

    expect(titles.some((title) => title.includes('производител') || title.includes('Производитель'))).toBe(
      true,
    );
    expect(overview.attention.some((item) => item.daysUntil === 31)).toBe(false);
    expect(titles).toContain('Due14');
    expect(titles).not.toContain('Due15');
    expect(titles).toContain('Overdue');
    expect(titles).toContain('Soon14');
    expect(titles).not.toContain('Soon15');
    expect(titles).toContain('EmptyStock');
    expect(overview.attentionCount).toBe(overview.attention.length);
  });

  test('large mix is deterministic and deduped', async () => {
    const { propertyId, inventory, warranties, maintenance, consumables, today } =
      await setup();
    const item = inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Robot',
    });

    for (let i = 0; i < 3; i += 1) {
      await warranties.create(item.id, {
        ...EMPTY_WARRANTY_FORM,
        endDate: dueIn(2 + i),
        durationMonths: null,
        remindersEnabled: false,
      });
    }
    for (let i = 0; i < 4; i += 1) {
      await maintenance.create(item.id, {
        ...EMPTY_MAINTENANCE_FORM,
        title: `Maint ${i}`,
        dueMode: 'explicit',
        nextDueDate: dueIn(-5 + i),
        remindersEnabled: false,
      });
    }
    await consumables.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'HEPA',
      trackStock: true,
      stockQuantity: 0,
      dueMode: 'explicit',
      nextDueDate: dueIn(-2),
      intervalValue: 3,
      intervalUnit: 'month',
      remindersEnabled: false,
    });

    const first = today.getOverview(propertyId);
    const second = today.getOverview(propertyId);
    expect(first.attention.map((item) => item.id)).toEqual(
      second.attention.map((item) => item.id),
    );
    const consumableCards = first.attention.filter(
      (item) => item.kind === 'consumable',
    );
    expect(consumableCards).toHaveLength(1);
    expect(first.attention[0]!.kind).toBe('maintenance');
  });

  test('recent activity includes item, maintenance, consumable replacement, document', async () => {
    const {
      propertyId,
      inventory,
      maintenance,
      consumables,
      documents,
      today,
    } = await setup();
    const item = inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Кофемашина',
    });
    const rule = await maintenance.create(item.id, {
      ...EMPTY_MAINTENANCE_FORM,
      title: 'Очистить',
      dueMode: 'explicit',
      nextDueDate: dueIn(-1),
      remindersEnabled: false,
    });
    await maintenance.markDone(rule.rule.id);
    const cons = await consumables.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Фильтр воды',
      trackStock: true,
      stockQuantity: 2,
      dueMode: 'explicit',
      nextDueDate: dueIn(5),
      intervalValue: 2,
      intervalUnit: 'month',
      remindersEnabled: false,
    });
    await consumables.markReplaced(cons.consumable.id);
    documents.create({
      itemId: item.id,
      type: 'receipt',
      title: 'Чек',
      filePath: 'documents/receipt.pdf',
    });

    const overview = today.getOverview(propertyId);
    const kinds = overview.recent.map((row) => row.kind);
    expect(kinds).toContain('item_added');
    expect(kinds).toContain('maintenance_done');
    expect(kinds).toContain('consumable_replaced');
    expect(kinds).toContain('document_added');
    expect(overview.recent.length).toBeLessThanOrEqual(5);
  });

  test('stock_add events are not shown in recent activity', async () => {
    const { propertyId, inventory, consumables, today } = await setup();
    const item = inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'DW',
    });
    const cons = await consumables.create(item.id, {
      ...EMPTY_CONSUMABLE_FORM,
      name: 'Таблетки',
      trackStock: true,
      stockQuantity: 1,
      dueMode: 'none',
      remindersEnabled: false,
    });
    await consumables.addStock(cons.consumable.id, 4);
    const overview = today.getOverview(propertyId);
    expect(
      overview.recent.some((row) => row.kind === 'consumable_replaced'),
    ).toBe(false);
  });
});
