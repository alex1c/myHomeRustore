/**
 * DEVELOPMENT-ONLY RuStore screenshot demo dataset.
 *
 * Never import this module from production UI routes.
 * Used by scripts / Jest to build a reproducible SQLite fixture.
 */

import { EMPTY_CONSUMABLE_FORM } from '@/src/domain/consumables';
import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import { EMPTY_MAINTENANCE_FORM } from '@/src/domain/maintenance';
import { EMPTY_WARRANTY_FORM } from '@/src/domain/warranty';
import type { SqlDatabase } from '@/src/db/types';
import { ONBOARDING_SETTING_KEY } from '@/src/monetization/config';
import { DocumentRepository } from '@/src/repositories/documentRepository';
import { LocationRepository } from '@/src/repositories/locationRepository';
import { PropertyRepository } from '@/src/repositories/propertyRepository';
import { SettingsRepository } from '@/src/repositories/settingsRepository';
import { ConsumableService } from '@/src/services/consumableService';
import { InventoryService } from '@/src/services/inventoryService';
import { MaintenanceService } from '@/src/services/maintenanceService';
import {
  MockNotificationAdapter,
  type NotificationAdapter,
} from '@/src/services/notificationAdapter';
import { WarrantyService } from '@/src/services/warrantyService';
import { TodayService } from '@/src/services/todayService';
import { addDaysToDateOnly, toLocalDateOnly } from '@/src/utils/datetime';

export type SeedRustoreDemoResult = {
  propertyId: string;
  locationCount: number;
  itemCount: number;
  warrantyCount: number;
  documentCount: number;
  maintenanceCount: number;
  consumableCount: number;
  todayAttentionCount: number;
};

/**
 * Seeds a realistic Russian household dataset for store screenshots.
 * Uses domain services — never inserts invalid rows directly.
 */
export async function seedRustoreDemo(
  db: SqlDatabase,
  options?: {
    referenceDate?: string;
    notifications?: NotificationAdapter;
  },
): Promise<SeedRustoreDemoResult> {
  const today = options?.referenceDate ?? toLocalDateOnly();
  const notifications = options?.notifications ?? new MockNotificationAdapter();

  const properties = new PropertyRepository(db);
  const locations = new LocationRepository(db);
  const settings = new SettingsRepository(db);
  const inventory = new InventoryService(db);
  const warranties = new WarrantyService(db, notifications);
  const maintenance = new MaintenanceService(db, notifications);
  const consumables = new ConsumableService(db, notifications);
  const documents = new DocumentRepository(db);
  const todayService = new TodayService(db);

  const property = properties.ensureDefaultProperty();
  // Skip first-run onboarding when this DB is applied on device.
  settings.set(ONBOARDING_SETTING_KEY, '1');
  settings.setActivePropertyId(property.id);
  // Default property is already named «Мой дом».

  const living = locations.createLocation({
    propertyId: property.id,
    name: 'Гостиная',
    sortOrder: 1,
  });
  const kitchen = locations.createLocation({
    propertyId: property.id,
    name: 'Кухня',
    sortOrder: 2,
  });
  const bedroom = locations.createLocation({
    propertyId: property.id,
    name: 'Спальня',
    sortOrder: 3,
  });
  locations.createLocation({
    propertyId: property.id,
    name: 'Прихожая',
    sortOrder: 4,
  });

  const robot = inventory.createItem(property.id, {
    ...EMPTY_ITEM_FORM,
    name: 'Робот-пылесос',
    category: 'Бытовая техника',
    locationId: living.id,
    brand: 'Dreame',
    model: 'L20 Ultra',
    purchaseDate: '2026-08-15',
    seller: 'DNS',
    priceText: '54990',
  });

  const coffee = inventory.createItem(property.id, {
    ...EMPTY_ITEM_FORM,
    name: 'Кофемашина',
    category: 'Бытовая техника',
    locationId: kitchen.id,
    brand: 'DeLonghi',
    model: 'Dinamica',
    purchaseDate: '2026-06-12',
    seller: 'М.Видео',
    priceText: '69990',
  });

  const tv = inventory.createItem(property.id, {
    ...EMPTY_ITEM_FORM,
    name: 'Телевизор',
    category: 'Электроника',
    locationId: living.id,
    brand: 'LG',
    model: 'OLED C4',
    purchaseDate: '2026-07-20',
    seller: 'DNS',
    priceText: '129990',
  });

  const ac = inventory.createItem(property.id, {
    ...EMPTY_ITEM_FORM,
    name: 'Кондиционер',
    category: 'Климат',
    locationId: bedroom.id,
    brand: 'Haier',
    model: 'Flexis',
  });

  inventory.createItem(property.id, {
    ...EMPTY_ITEM_FORM,
    name: 'Фильтр воды',
    category: 'Сантехника',
    locationId: kitchen.id,
    brand: 'Аквафор',
  });

  // TV manufacturer warranty (24 months from purchase).
  await warranties.create(tv.id, {
    ...EMPTY_WARRANTY_FORM,
    type: 'manufacturer',
    provider: 'LG',
    startDate: '2026-07-20',
    durationMonths: 24,
    endDate: null,
    remindersEnabled: false,
    reminderOffsets: [],
  });

  // Robot manufacturer + store extended warranties.
  await warranties.create(robot.id, {
    ...EMPTY_WARRANTY_FORM,
    type: 'manufacturer',
    provider: 'Dreame',
    startDate: '2026-08-15',
    durationMonths: 24,
    endDate: null,
    remindersEnabled: false,
    reminderOffsets: [],
  });
  await warranties.create(robot.id, {
    ...EMPTY_WARRANTY_FORM,
    type: 'store',
    provider: 'DNS',
    startDate: '2026-08-15',
    durationMonths: 36,
    endDate: null,
    remindersEnabled: false,
    reminderOffsets: [],
  });

  // Expiring soon warranty for Smart Today (~9 days).
  await warranties.create(coffee.id, {
    ...EMPTY_WARRANTY_FORM,
    type: 'store',
    provider: 'М.Видео',
    startDate: addDaysToDateOnly(today, -356),
    durationMonths: null,
    endDate: addDaysToDateOnly(today, 9),
    remindersEnabled: false,
    reminderOffsets: [],
  });

  // Document metadata only — list UI shows titles without binary files.
  const docSpecs: {
    itemId: string;
    type: 'receipt' | 'manual' | 'warranty';
    title: string;
    file: string;
  }[] = [
    {
      itemId: robot.id,
      type: 'receipt',
      title: 'Чек — Робот-пылесос',
      file: 'documents/demo-receipt-robot.pdf',
    },
    {
      itemId: robot.id,
      type: 'manual',
      title: 'Инструкция — Робот-пылесос',
      file: 'documents/demo-manual-robot.pdf',
    },
    {
      itemId: tv.id,
      type: 'receipt',
      title: 'Чек — Телевизор',
      file: 'documents/demo-receipt-tv.pdf',
    },
    {
      itemId: tv.id,
      type: 'warranty',
      title: 'Гарантийный талон — Телевизор',
      file: 'documents/demo-warranty-tv.pdf',
    },
    {
      itemId: coffee.id,
      type: 'manual',
      title: 'Инструкция — Кофемашина',
      file: 'documents/demo-manual-coffee.pdf',
    },
  ];

  for (const spec of docSpecs) {
    documents.create({
      itemId: spec.itemId,
      type: spec.type,
      title: spec.title,
      filePath: spec.file,
      mimeType: 'application/pdf',
      originalName: `${spec.title}.pdf`,
      fileSize: 2048,
    });
  }

  // Maintenance: upcoming / overdue mix for Today.
  const robotBrushes = await maintenance.create(robot.id, {
    ...EMPTY_MAINTENANCE_FORM,
    title: 'Очистить щётки',
    intervalValue: 30,
    intervalUnit: 'day',
    dueMode: 'explicit',
    nextDueDate: addDaysToDateOnly(today, 5),
    remindersEnabled: false,
    reminderOffsets: [],
  });

  await maintenance.create(coffee.id, {
    ...EMPTY_MAINTENANCE_FORM,
    title: 'Очистить от накипи',
    intervalValue: 60,
    intervalUnit: 'day',
    dueMode: 'explicit',
    nextDueDate: addDaysToDateOnly(today, -3),
    remindersEnabled: false,
    reminderOffsets: [],
  });

  await maintenance.create(ac.id, {
    ...EMPTY_MAINTENANCE_FORM,
    title: 'Очистить фильтр',
    intervalValue: 90,
    intervalUnit: 'day',
    dueMode: 'explicit',
    nextDueDate: addDaysToDateOnly(today, 10),
    remindersEnabled: false,
    reminderOffsets: [],
  });

  // Completed history so activity / detail feel lived-in.
  await maintenance.markDone(
    robotBrushes.rule.id,
    addDaysToDateOnly(today, -25),
  );
  // markDone advances next due — restore the screenshot-friendly due date.
  await maintenance.update(robotBrushes.rule.id, {
    ...EMPTY_MAINTENANCE_FORM,
    title: 'Очистить щётки',
    intervalValue: 30,
    intervalUnit: 'day',
    dueMode: 'explicit',
    nextDueDate: addDaysToDateOnly(today, 5),
    remindersEnabled: false,
    reminderOffsets: [],
  });

  const coffeeCheck = await maintenance.create(coffee.id, {
    ...EMPTY_MAINTENANCE_FORM,
    title: 'Проверить помол',
    intervalValue: 90,
    intervalUnit: 'day',
    dueMode: 'explicit',
    nextDueDate: addDaysToDateOnly(today, 40),
    remindersEnabled: false,
    reminderOffsets: [],
  });
  await maintenance.markDone(
    coffeeCheck.rule.id,
    addDaysToDateOnly(today, -14),
  );

  await consumables.create(robot.id, {
    ...EMPTY_CONSUMABLE_FORM,
    name: 'HEPA-фильтр',
    trackStock: true,
    stockQuantity: 2,
    stockUnit: 'pcs',
    intervalValue: 90,
    intervalUnit: 'day',
    dueMode: 'explicit',
    nextDueDate: addDaysToDateOnly(today, 12),
    remindersEnabled: false,
    reminderOffsets: [],
  });

  await consumables.create(robot.id, {
    ...EMPTY_CONSUMABLE_FORM,
    name: 'Боковая щётка',
    trackStock: true,
    stockQuantity: 1,
    stockUnit: 'pcs',
    intervalValue: 120,
    intervalUnit: 'day',
    dueMode: 'explicit',
    nextDueDate: addDaysToDateOnly(today, 45),
    remindersEnabled: false,
    reminderOffsets: [],
  });

  await consumables.create(coffee.id, {
    ...EMPTY_CONSUMABLE_FORM,
    name: 'Фильтр воды',
    trackStock: true,
    stockQuantity: 0,
    stockUnit: 'pcs',
    intervalValue: 60,
    intervalUnit: 'day',
    dueMode: 'explicit',
    nextDueDate: addDaysToDateOnly(today, 20),
    remindersEnabled: false,
    reminderOffsets: [],
  });

  const overview = todayService.getOverview(property.id, today);

  return {
    propertyId: property.id,
    locationCount: locations.countByProperty(property.id),
    itemCount: inventory.count(property.id),
    warrantyCount: 4,
    documentCount: docSpecs.length,
    maintenanceCount: 4,
    consumableCount: 3,
    todayAttentionCount: overview.attentionCount,
  };
}
