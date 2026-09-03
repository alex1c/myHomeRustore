/**
 * Domain validation for unpacked «Мой дом» backup archives.
 *
 * Structural ZIP checks live in backupArchive; this module enforces
 * format version, FK integrity, path/file presence, and field invariants
 * before restore mutates the live database.
 */

import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_SETTINGS_WHITELIST,
  type BackupDataJson,
  type BackupManifest,
  type BackupPreviewCounts,
} from '@/src/domain/backup';
import { DOCUMENT_TYPES } from '@/src/domain/documents';
import { AppError } from '@/src/domain/errors';
import type { DocumentType, ReminderType } from '@/src/domain/types';
import type { UnpackedBackup } from '@/src/services/backup/backupArchive';
import { isValidDateOnly } from '@/src/utils/datetime';
import {
  isAllowedManagedRelativePath,
  sanitizeBackupRelativePath,
} from '@/src/utils/pathSafety';

export interface ValidatedBackup {
  manifest: BackupManifest;
  data: BackupDataJson;
  files: Map<string, Uint8Array>;
  counts: BackupPreviewCounts;
  warnings: string[];
}

const ENTITY_COLLECTIONS = [
  'properties',
  'locations',
  'items',
  'purchases',
  'warranties',
  'documents',
  'maintenance_rules',
  'maintenance_events',
  'consumables',
  'consumable_events',
  'reminders',
] as const;

const ALL_COLLECTIONS = [...ENTITY_COLLECTIONS, 'app_settings'] as const;

const WARRANTY_TYPES = new Set([
  'manufacturer',
  'store',
  'extended',
  'other',
]);

const INTERVAL_UNITS = new Set(['day', 'month']);
const STOCK_UNITS = new Set(['pcs', 'set', 'pack']);
const CONSUMABLE_EVENT_TYPES = new Set([
  'replacement',
  'stock_add',
  'stock_set',
]);
const REMINDER_TYPES = new Set<ReminderType>([
  'warranty',
  'maintenance',
  'consumable',
  'custom',
]);
const DOCUMENT_TYPE_SET = new Set<DocumentType>(DOCUMENT_TYPES);
const SETTINGS_WHITELIST = new Set<string>(BACKUP_SETTINGS_WHITELIST);

/** Throw a typed AppError; used for every reject path. */
function reject(message: string, code: string): never {
  throw new AppError(message, { code });
}

/** True when value is a finite safe integer (JSON numbers only). */
function isSafeNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** True when value is a positive safe integer (> 0). */
function isSafePositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** Null or safe integer money amount in minor units. */
function isValidMoneyMinor(value: unknown): boolean {
  return value === null || isSafeNonNegativeInt(value);
}

/** Non-null non-empty string (timestamps, required text ids). */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Null, or a calendar date YYYY-MM-DD that actually exists. */
function isNullOrDateOnly(value: unknown): boolean {
  return value === null || (typeof value === 'string' && isValidDateOnly(value));
}

/**
 * Managed relative path that is safe and allowed under photos/ or documents/.
 * Returns the sanitized path, or null when invalid.
 */
function normalizeManagedPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const safe = sanitizeBackupRelativePath(value);
  if (!safe || safe !== value.replace(/\\/g, '/') || !isAllowedManagedRelativePath(safe)) {
    return null;
  }
  return safe;
}

/**
 * Interval pair: both null, or positive integer + day|month.
 * Rejects half-set combinations.
 */
function isValidIntervalPair(value: unknown, unit: unknown): boolean {
  if (value === null && unit === null) return true;
  if (!isSafePositiveInt(value)) return false;
  return typeof unit === 'string' && INTERVAL_UNITS.has(unit);
}

/**
 * Consumable event quantity invariants (aligned with migration 003 triggers).
 */
function isValidConsumableEventQuantities(
  eventType: string,
  quantityDelta: unknown,
  stockBefore: unknown,
  stockAfter: unknown,
): boolean {
  if (eventType === 'replacement') {
    // Untracked stock: all quantity fields omitted.
    if (
      quantityDelta === null &&
      stockBefore === null &&
      stockAfter === null
    ) {
      return true;
    }
    // Tracked: delta = after - before; after is before or before-1
    // (before-1 when stock > 0; both 0 when already empty).
    if (
      !Number.isSafeInteger(stockBefore) ||
      !Number.isSafeInteger(stockAfter) ||
      !Number.isSafeInteger(quantityDelta)
    ) {
      return false;
    }
    const before = stockBefore as number;
    const after = stockAfter as number;
    const delta = quantityDelta as number;
    if (before < 0 || after < 0) return false;
    if (delta !== after - before) return false;
    return after === before || after === before - 1;
  }

  if (eventType === 'stock_add') {
    if (
      !Number.isSafeInteger(stockBefore) ||
      !Number.isSafeInteger(stockAfter) ||
      !Number.isSafeInteger(quantityDelta)
    ) {
      return false;
    }
    const before = stockBefore as number;
    const after = stockAfter as number;
    const delta = quantityDelta as number;
    return before >= 0 && delta > 0 && after === before + delta;
  }

  if (eventType === 'stock_set') {
    if (!isSafeNonNegativeInt(stockAfter)) return false;
    // before/delta may both be null, or both integers with delta = after - before.
    if (stockBefore === null && quantityDelta === null) return true;
    if (
      !Number.isSafeInteger(stockBefore) ||
      !Number.isSafeInteger(quantityDelta)
    ) {
      return false;
    }
    const before = stockBefore as number;
    const delta = quantityDelta as number;
    return before >= 0 && delta === (stockAfter as number) - before;
  }

  return false;
}

/** Collect entity ids; reject duplicates or missing/non-string ids. */
function collectIds(
  rows: Record<string, unknown>[],
  collectionName: string,
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (!isNonEmptyString(row.id)) {
      reject(
        `Некорректный идентификатор в коллекции ${collectionName}`,
        'INVALID_ID',
      );
    }
    if (ids.has(row.id)) {
      reject(
        `Дублирующийся идентификатор в коллекции ${collectionName}`,
        'DUPLICATE_ID',
      );
    }
    ids.add(row.id);
  }
  return ids;
}

/** Ensure created_at / updated_at (and optional extras) are non-empty strings. */
function assertTimestamps(
  row: Record<string, unknown>,
  label: string,
  extraFields: string[] = [],
): void {
  const fields = ['created_at', 'updated_at', ...extraFields];
  for (const field of fields) {
    if (!isNonEmptyString(row[field])) {
      reject(`Некорректная метка времени (${field}) у ${label}`, 'INVALID_TIMESTAMP');
    }
  }
}

function countOf(data: BackupDataJson): BackupPreviewCounts {
  return {
    properties: data.properties.length,
    locations: data.locations.length,
    items: data.items.length,
    purchases: data.purchases.length,
    warranties: data.warranties.length,
    documents: data.documents.length,
    maintenanceRules: data.maintenance_rules.length,
    maintenanceEvents: data.maintenance_events.length,
    consumables: data.consumables.length,
    consumableEvents: data.consumable_events.length,
    reminders: data.reminders.length,
  };
}

/** Normalize manifest.warnings into a string array (ignore malformed shapes). */
function readManifestWarnings(manifest: BackupManifest): string[] {
  const raw = manifest.warnings;
  if (!Array.isArray(raw)) return [];
  if (!raw.every((entry) => typeof entry === 'string')) return [];
  return [...raw];
}

/** Deep-clone JSON data so restore can clear non-portable fields safely. */
function cloneBackupData(data: BackupDataJson): BackupDataJson {
  return JSON.parse(JSON.stringify(data)) as BackupDataJson;
}

/**
 * Validate formatVersion and dispatch to a version-specific checker.
 * Throws before mutating any caller-owned structures.
 */
export function validateUnpackedBackup(unpacked: UnpackedBackup): ValidatedBackup {
  const { manifest, data, files } = unpacked;

  if (typeof manifest !== 'object' || manifest === null) {
    reject('Некорректный манифест резервной копии', 'INVALID_MANIFEST');
  }

  if (manifest.format !== BACKUP_FORMAT) {
    reject('Это не резервная копия «Мой дом»', 'WRONG_FORMAT');
  }

  const formatVersion = manifest.formatVersion;
  if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion)) {
    reject('Некорректная версия формата резервной копии', 'INVALID_FORMAT_VERSION');
  }

  // Newer app wrote this archive — we cannot safely interpret it.
  if (formatVersion > BACKUP_FORMAT_VERSION) {
    reject(
      'Эта резервная копия создана более новой версией приложения.',
      'UNSUPPORTED_FORMAT_VERSION',
    );
  }

  if (formatVersion < 1) {
    reject('Некорректная версия формата резервной копии', 'INVALID_FORMAT_VERSION');
  }

  switch (formatVersion) {
    case 1:
      validateBackupDataV1(data, files);
      break;
    default:
      // Reserved for future format versions once BACKUP_FORMAT_VERSION advances.
      reject(
        'Неподдерживаемая версия формата резервной копии',
        'UNSUPPORTED_FORMAT_VERSION',
      );
  }

  // Clone only after validation succeeds, then strip device-local notification ids.
  const cloned = cloneBackupData(data);
  for (const reminder of cloned.reminders) {
    reminder.notification_id = null;
  }

  return {
    manifest,
    data: cloned,
    files,
    counts: countOf(cloned),
    warnings: readManifestWarnings(manifest),
  };
}

/**
 * Full domain validation for formatVersion === 1 payloads.
 */
function validateBackupDataV1(
  data: BackupDataJson,
  files: Map<string, Uint8Array>,
): void {
  if (typeof data !== 'object' || data === null) {
    reject('Некорректные данные резервной копии', 'INVALID_DATA');
  }

  // Every expected collection must be a real array (including empty ones).
  for (const key of ALL_COLLECTIONS) {
    if (!Array.isArray((data as unknown as Record<string, unknown>)[key])) {
      reject(`Коллекция ${key} должна быть массивом`, 'INVALID_DATA');
    }
  }

  // App invariant: at least one property must exist.
  if (data.properties.length < 1) {
    reject('В резервной копии нет объектов недвижимости', 'EMPTY_PROPERTIES');
  }

  // Rows must be plain objects (defensive against JSON arrays-of-primitives).
  for (const key of ALL_COLLECTIONS) {
    const rows = (data as unknown as Record<string, unknown>)[key] as unknown[];
    for (const row of rows) {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        reject(`Некорректная запись в коллекции ${key}`, 'INVALID_DATA');
      }
    }
  }

  const propertyIds = collectIds(data.properties, 'properties');
  const locationIds = collectIds(data.locations, 'locations');
  const itemIds = collectIds(data.items, 'items');
  collectIds(data.purchases, 'purchases');
  const warrantyIds = collectIds(data.warranties, 'warranties');
  collectIds(data.documents, 'documents');
  const ruleIds = collectIds(data.maintenance_rules, 'maintenance_rules');
  collectIds(data.maintenance_events, 'maintenance_events');
  const consumableIds = collectIds(data.consumables, 'consumables');
  collectIds(data.consumable_events, 'consumable_events');
  collectIds(data.reminders, 'reminders');

  // --- properties ---
  for (const property of data.properties) {
    assertTimestamps(property, `property ${String(property.id)}`);
  }

  // --- locations ---
  const locationPropertyById = new Map<string, string>();
  for (const location of data.locations) {
    assertTimestamps(location, `location ${String(location.id)}`);
    if (!isNonEmptyString(location.property_id) || !propertyIds.has(location.property_id)) {
      reject(
        `Локация ${String(location.id)} ссылается на неизвестный объект`,
        'INVALID_FK',
      );
    }
    locationPropertyById.set(location.id as string, location.property_id);
  }
  // Parent must exist and belong to the same property (second pass after map built).
  for (const location of data.locations) {
    const parentId = location.parent_location_id;
    if (parentId === null || parentId === undefined) continue;
    if (!isNonEmptyString(parentId) || !locationIds.has(parentId)) {
      reject(
        `Локация ${String(location.id)} ссылается на неизвестную родительскую локацию`,
        'INVALID_FK',
      );
    }
    if (locationPropertyById.get(parentId) !== location.property_id) {
      reject(
        `Родительская локация принадлежит другому объекту (${String(location.id)})`,
        'INVALID_FK',
      );
    }
  }

  // --- items ---
  const usedPhotoPaths = new Set<string>();
  for (const item of data.items) {
    assertTimestamps(item, `item ${String(item.id)}`);
    if (!isNonEmptyString(item.property_id) || !propertyIds.has(item.property_id)) {
      reject(
        `Вещь ${String(item.id)} ссылается на неизвестный объект`,
        'INVALID_FK',
      );
    }

    const locationId = item.location_id;
    if (locationId !== null && locationId !== undefined) {
      if (!isNonEmptyString(locationId) || !locationIds.has(locationId)) {
        reject(
          `Вещь ${String(item.id)} ссылается на неизвестную локацию`,
          'INVALID_FK',
        );
      }
      if (locationPropertyById.get(locationId) !== item.property_id) {
        reject(
          `Локация вещи принадлежит другому объекту (${String(item.id)})`,
          'INVALID_FK',
        );
      }
    }

    const photoPath = item.primary_photo_path;
    if (photoPath !== null && photoPath !== undefined) {
      const safe = normalizeManagedPath(photoPath);
      if (!safe) {
        reject(
          `Небезопасный путь фото у вещи ${String(item.id)}`,
          'UNSAFE_PATH',
        );
      }
      if (!files.has(safe)) {
        reject(
          `В архиве нет файла фото: ${safe}`,
          'MISSING_FILE',
        );
      }
      if (usedPhotoPaths.has(safe)) {
        reject(
          `Повторяющийся путь primary_photo_path: ${safe}`,
          'DUPLICATE_PATH',
        );
      }
      usedPhotoPaths.add(safe);
    }
  }

  // --- purchases ---
  for (const purchase of data.purchases) {
    assertTimestamps(purchase, `purchase ${String(purchase.id)}`);
    if (!isNonEmptyString(purchase.item_id) || !itemIds.has(purchase.item_id)) {
      reject(
        `Покупка ${String(purchase.id)} ссылается на неизвестную вещь`,
        'INVALID_FK',
      );
    }
    if (!isNullOrDateOnly(purchase.purchase_date ?? null)) {
      reject(
        `Некорректная дата покупки у ${String(purchase.id)}`,
        'INVALID_DATE',
      );
    }
    if (!isValidMoneyMinor(purchase.price_minor ?? null)) {
      reject(
        `Некорректная цена у покупки ${String(purchase.id)}`,
        'INVALID_MONEY',
      );
    }
  }

  // --- warranties ---
  const warrantyItemById = new Map<string, string>();
  for (const warranty of data.warranties) {
    assertTimestamps(warranty, `warranty ${String(warranty.id)}`);
    if (!isNonEmptyString(warranty.item_id) || !itemIds.has(warranty.item_id)) {
      reject(
        `Гарантия ${String(warranty.id)} ссылается на неизвестную вещь`,
        'INVALID_FK',
      );
    }
    warrantyItemById.set(warranty.id as string, warranty.item_id);

    if (typeof warranty.type !== 'string' || !WARRANTY_TYPES.has(warranty.type)) {
      reject(
        `Некорректный тип гарантии у ${String(warranty.id)}`,
        'INVALID_WARRANTY',
      );
    }
    if (!isNullOrDateOnly(warranty.start_date ?? null)) {
      reject(
        `Некорректная дата начала гарантии у ${String(warranty.id)}`,
        'INVALID_DATE',
      );
    }
    if (!isNullOrDateOnly(warranty.end_date ?? null)) {
      reject(
        `Некорректная дата окончания гарантии у ${String(warranty.id)}`,
        'INVALID_DATE',
      );
    }
    // When both calendar bounds are present, start must not be after end.
    if (
      typeof warranty.start_date === 'string' &&
      typeof warranty.end_date === 'string' &&
      isValidDateOnly(warranty.start_date) &&
      isValidDateOnly(warranty.end_date) &&
      warranty.start_date > warranty.end_date
    ) {
      reject(
        `Дата начала гарантии позже даты окончания (${String(warranty.id)})`,
        'INVALID_WARRANTY',
      );
    }
  }

  // --- documents ---
  const usedDocumentPaths = new Set<string>();
  for (const document of data.documents) {
    assertTimestamps(document, `document ${String(document.id)}`);
    if (!isNonEmptyString(document.item_id) || !itemIds.has(document.item_id)) {
      reject(
        `Документ ${String(document.id)} ссылается на неизвестную вещь`,
        'INVALID_FK',
      );
    }
    if (
      typeof document.type !== 'string' ||
      !DOCUMENT_TYPE_SET.has(document.type as DocumentType)
    ) {
      reject(
        `Некорректный тип документа у ${String(document.id)}`,
        'INVALID_DOCUMENT_TYPE',
      );
    }

    const filePath = normalizeManagedPath(document.file_path);
    if (!filePath) {
      reject(
        `Небезопасный путь файла документа ${String(document.id)}`,
        'UNSAFE_PATH',
      );
    }
    if (!files.has(filePath)) {
      reject(
        `В архиве нет файла документа: ${filePath}`,
        'MISSING_FILE',
      );
    }
    if (usedDocumentPaths.has(filePath)) {
      reject(
        `Повторяющийся путь документа: ${filePath}`,
        'DUPLICATE_PATH',
      );
    }
    usedDocumentPaths.add(filePath);
  }

  // --- maintenance_rules ---
  const ruleItemById = new Map<string, string>();
  for (const rule of data.maintenance_rules) {
    assertTimestamps(rule, `maintenance_rule ${String(rule.id)}`);
    if (!isNonEmptyString(rule.item_id) || !itemIds.has(rule.item_id)) {
      reject(
        `Правило обслуживания ${String(rule.id)} ссылается на неизвестную вещь`,
        'INVALID_FK',
      );
    }
    ruleItemById.set(rule.id as string, rule.item_id);

    if (!isValidIntervalPair(rule.interval_value ?? null, rule.interval_unit ?? null)) {
      reject(
        `Некорректный интервал обслуживания у ${String(rule.id)}`,
        'INVALID_INTERVAL',
      );
    }
    if (!isNullOrDateOnly(rule.last_completed_date ?? null)) {
      reject(
        `Некорректная дата последнего обслуживания у ${String(rule.id)}`,
        'INVALID_DATE',
      );
    }
    if (!isNullOrDateOnly(rule.next_due_date ?? null)) {
      reject(
        `Некорректная дата следующего обслуживания у ${String(rule.id)}`,
        'INVALID_DATE',
      );
    }
  }

  // --- maintenance_events ---
  for (const event of data.maintenance_events) {
    assertTimestamps(event, `maintenance_event ${String(event.id)}`, [
      'performed_at',
    ]);
    if (!isNonEmptyString(event.item_id) || !itemIds.has(event.item_id)) {
      reject(
        `Событие обслуживания ${String(event.id)} ссылается на неизвестную вещь`,
        'INVALID_FK',
      );
    }
    const ruleId = event.maintenance_rule_id;
    if (ruleId !== null && ruleId !== undefined) {
      if (!isNonEmptyString(ruleId) || !ruleIds.has(ruleId)) {
        reject(
          `Событие обслуживания ${String(event.id)} ссылается на неизвестное правило`,
          'INVALID_FK',
        );
      }
      if (ruleItemById.get(ruleId) !== event.item_id) {
        reject(
          `Правило обслуживания принадлежит другой вещи (${String(event.id)})`,
          'INVALID_FK',
        );
      }
    }
    if (!isValidMoneyMinor(event.cost_minor ?? null)) {
      reject(
        `Некорректная стоимость обслуживания у ${String(event.id)}`,
        'INVALID_MONEY',
      );
    }
  }

  // --- consumables ---
  const consumableItemById = new Map<string, string>();
  for (const consumable of data.consumables) {
    assertTimestamps(consumable, `consumable ${String(consumable.id)}`);
    if (
      !isNonEmptyString(consumable.item_id) ||
      !itemIds.has(consumable.item_id)
    ) {
      reject(
        `Расходник ${String(consumable.id)} ссылается на неизвестную вещь`,
        'INVALID_FK',
      );
    }
    consumableItemById.set(consumable.id as string, consumable.item_id);

    if (
      !isValidIntervalPair(
        consumable.replacement_interval_value ?? null,
        consumable.replacement_interval_unit ?? null,
      )
    ) {
      reject(
        `Некорректный интервал замены у расходника ${String(consumable.id)}`,
        'INVALID_INTERVAL',
      );
    }
    if (!isNullOrDateOnly(consumable.last_replaced_date ?? null)) {
      reject(
        `Некорректная дата замены у расходника ${String(consumable.id)}`,
        'INVALID_DATE',
      );
    }
    if (!isNullOrDateOnly(consumable.next_due_date ?? null)) {
      reject(
        `Некорректная дата следующей замены у расходника ${String(consumable.id)}`,
        'INVALID_DATE',
      );
    }
    if (!isValidMoneyMinor(consumable.price_minor ?? null)) {
      reject(
        `Некорректная цена расходника ${String(consumable.id)}`,
        'INVALID_MONEY',
      );
    }

    // stock_quantity and stock_unit must be null together, or tracked pair.
    const stockQty = consumable.stock_quantity ?? null;
    const stockUnit = consumable.stock_unit ?? null;
    const qtyNull = stockQty === null;
    const unitNull = stockUnit === null;
    if (qtyNull !== unitNull) {
      reject(
        `Запас и единица расходника должны задаваться вместе (${String(consumable.id)})`,
        'INVALID_STOCK',
      );
    }
    if (!qtyNull) {
      if (!isSafeNonNegativeInt(stockQty)) {
        reject(
          `Некорректное количество запаса у расходника ${String(consumable.id)}`,
          'INVALID_STOCK',
        );
      }
      if (typeof stockUnit !== 'string' || !STOCK_UNITS.has(stockUnit)) {
        reject(
          `Некорректная единица запаса у расходника ${String(consumable.id)}`,
          'INVALID_STOCK',
        );
      }
    }
  }

  // --- consumable_events ---
  for (const event of data.consumable_events) {
    assertTimestamps(event, `consumable_event ${String(event.id)}`, [
      'replaced_at',
    ]);
    if (!isNonEmptyString(event.item_id) || !itemIds.has(event.item_id)) {
      reject(
        `Событие расходника ${String(event.id)} ссылается на неизвестную вещь`,
        'INVALID_FK',
      );
    }
    if (
      !isNonEmptyString(event.consumable_id) ||
      !consumableIds.has(event.consumable_id)
    ) {
      reject(
        `Событие расходника ${String(event.id)} ссылается на неизвестный расходник`,
        'INVALID_FK',
      );
    }
    if (consumableItemById.get(event.consumable_id) !== event.item_id) {
      reject(
        `Расходник принадлежит другой вещи (${String(event.id)})`,
        'INVALID_FK',
      );
    }

    const eventType = event.event_type;
    if (typeof eventType !== 'string' || !CONSUMABLE_EVENT_TYPES.has(eventType)) {
      reject(
        `Некорректный тип события расходника ${String(event.id)}`,
        'INVALID_STOCK',
      );
    }
    if (
      !isValidConsumableEventQuantities(
        eventType,
        event.quantity_delta ?? null,
        event.stock_before ?? null,
        event.stock_after ?? null,
      )
    ) {
      reject(
        `Некорректное изменение запаса в событии ${String(event.id)}`,
        'INVALID_STOCK',
      );
    }
    if (!isValidMoneyMinor(event.cost_minor ?? null)) {
      reject(
        `Некорректная стоимость события расходника ${String(event.id)}`,
        'INVALID_MONEY',
      );
    }
  }

  // --- reminders (CHECK semantics from schema) ---
  for (const reminder of data.reminders) {
    assertTimestamps(reminder, `reminder ${String(reminder.id)}`, ['due_at']);
    if (!isNonEmptyString(reminder.item_id) || !itemIds.has(reminder.item_id)) {
      reject(
        `Напоминание ${String(reminder.id)} ссылается на неизвестную вещь`,
        'INVALID_FK',
      );
    }

    const reminderType = reminder.reminder_type;
    if (typeof reminderType !== 'string' || !REMINDER_TYPES.has(reminderType as ReminderType)) {
      reject(
        `Некорректный тип напоминания ${String(reminder.id)}`,
        'INVALID_REMINDER',
      );
    }

    const warrantyId = reminder.warranty_id ?? null;
    const maintenanceRuleId = reminder.maintenance_rule_id ?? null;
    const consumableId = reminder.consumable_id ?? null;

    const hasWarranty = warrantyId !== null;
    const hasRule = maintenanceRuleId !== null;
    const hasConsumable = consumableId !== null;

    if (reminderType === 'warranty') {
      if (!hasWarranty || hasRule || hasConsumable) {
        reject(
          `Напоминание гарантии ${String(reminder.id)} имеет неверный набор ссылок`,
          'INVALID_REMINDER',
        );
      }
      if (!isNonEmptyString(warrantyId) || !warrantyIds.has(warrantyId)) {
        reject(
          `Напоминание ${String(reminder.id)} ссылается на неизвестную гарантию`,
          'INVALID_FK',
        );
      }
      if (warrantyItemById.get(warrantyId) !== reminder.item_id) {
        reject(
          `Гарантия напоминания принадлежит другой вещи (${String(reminder.id)})`,
          'INVALID_FK',
        );
      }
    } else if (reminderType === 'maintenance') {
      if (hasWarranty || !hasRule || hasConsumable) {
        reject(
          `Напоминание обслуживания ${String(reminder.id)} имеет неверный набор ссылок`,
          'INVALID_REMINDER',
        );
      }
      if (!isNonEmptyString(maintenanceRuleId) || !ruleIds.has(maintenanceRuleId)) {
        reject(
          `Напоминание ${String(reminder.id)} ссылается на неизвестное правило`,
          'INVALID_FK',
        );
      }
      if (ruleItemById.get(maintenanceRuleId) !== reminder.item_id) {
        reject(
          `Правило напоминания принадлежит другой вещи (${String(reminder.id)})`,
          'INVALID_FK',
        );
      }
    } else if (reminderType === 'consumable') {
      if (hasWarranty || hasRule || !hasConsumable) {
        reject(
          `Напоминание расходника ${String(reminder.id)} имеет неверный набор ссылок`,
          'INVALID_REMINDER',
        );
      }
      if (!isNonEmptyString(consumableId) || !consumableIds.has(consumableId)) {
        reject(
          `Напоминание ${String(reminder.id)} ссылается на неизвестный расходник`,
          'INVALID_FK',
        );
      }
      if (consumableItemById.get(consumableId) !== reminder.item_id) {
        reject(
          `Расходник напоминания принадлежит другой вещи (${String(reminder.id)})`,
          'INVALID_FK',
        );
      }
    } else if (reminderType === 'custom') {
      if (hasWarranty || hasRule || hasConsumable) {
        reject(
          `Произвольное напоминание ${String(reminder.id)} не должно иметь целевых ссылок`,
          'INVALID_REMINDER',
        );
      }
    }
  }

  // --- app_settings (whitelist only) ---
  const seenSettingKeys = new Set<string>();
  for (const setting of data.app_settings) {
    if (!isNonEmptyString(setting.key) || typeof setting.value !== 'string') {
      reject('Некорректная запись app_settings', 'INVALID_SETTINGS');
    }
    if (!SETTINGS_WHITELIST.has(setting.key)) {
      reject(
        `Ключ настроек не из белого списка: ${setting.key}`,
        'INVALID_SETTINGS',
      );
    }
    if (seenSettingKeys.has(setting.key)) {
      reject(
        `Дублирующийся ключ настроек: ${setting.key}`,
        'DUPLICATE_ID',
      );
    }
    seenSettingKeys.add(setting.key);

    if (setting.key === 'activePropertyId') {
      if (!propertyIds.has(setting.value)) {
        reject(
          'activePropertyId ссылается на неизвестный объект',
          'INVALID_FK',
        );
      }
    }
  }
}
