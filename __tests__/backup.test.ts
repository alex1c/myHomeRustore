/**
 * Phase 7 backup / restore / export integration tests.
 */

import initSqlJs from 'sql.js';
import { strToU8, zipSync } from 'fflate';

import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupDataJson,
  type BackupManifest,
} from '@/src/domain/backup';
import { EMPTY_CONSUMABLE_FORM } from '@/src/domain/consumables';
import { AppError } from '@/src/domain/errors';
import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import { EMPTY_MAINTENANCE_FORM } from '@/src/domain/maintenance';
import { EMPTY_WARRANTY_FORM } from '@/src/domain/warranty';
import { createDatabaseFromClient } from '@/src/db/database';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { DocumentRepository } from '@/src/repositories/documentRepository';
import { LocationRepository } from '@/src/repositories/locationRepository';
import {
  packBackupArchive,
  unpackBackupArchive,
} from '@/src/services/backup/backupArchive';
import {
  acquireBackupLock,
  resetBackupLockForTests,
} from '@/src/services/backup/backupLock';
import { BackupService } from '@/src/services/backup/backupService';
import { validateUnpackedBackup } from '@/src/services/backup/backupValidator';
import { ExportService } from '@/src/services/backup/exportService';
import { MemoryManagedStore } from '@/src/services/backup/managedStore';
import { RestoreService } from '@/src/services/backup/restoreService';
import { ConsumableService } from '@/src/services/consumableService';
import {
  getDataEpoch,
  subscribeDataReset,
} from '@/src/services/dataReset';
import { InventoryService } from '@/src/services/inventoryService';
import { MaintenanceService } from '@/src/services/maintenanceService';
import { MockNotificationAdapter } from '@/src/services/notificationAdapter';
import { WarrantyService } from '@/src/services/warrantyService';

type SqlJsStatic = Awaited<ReturnType<typeof initSqlJs>>;

let SQL: SqlJsStatic;

beforeAll(async () => {
  SQL = await initSqlJs();
});

beforeEach(() => {
  resetBackupLockForTests();
});

afterEach(() => {
  resetBackupLockForTests();
});

/** Open a migrated in-memory DB (includes the default property). */
function openDb(): SqlDatabase {
  return createDatabaseFromClient(createSqlJsAdapter(new SQL.Database()));
}

function defaultPropertyId(db: SqlDatabase): string {
  return db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
}

function countItems(db: SqlDatabase): number {
  return db.getFirst<{ c: number }>('SELECT COUNT(*) AS c FROM items')!.c;
}

function itemNames(db: SqlDatabase): string[] {
  return db
    .getAll<{ name: string }>('SELECT name FROM items ORDER BY name COLLATE NOCASE')
    .map((row) => row.name);
}

function bytesEqual(a: Uint8Array | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Proxy that can force withTransaction to fail after files are staged. */
function wrapDbFailingTransaction(
  real: SqlDatabase,
  shouldFail: () => boolean,
): SqlDatabase {
  return {
    exec: (sql) => real.exec(sql),
    run: (sql, params) => real.run(sql, params),
    getAll: (sql, params) => real.getAll(sql, params),
    getFirst: (sql, params) => real.getFirst(sql, params),
    getUserVersion: () => real.getUserVersion(),
    setUserVersion: (version) => real.setUserVersion(version),
    withTransaction<T>(fn: () => T): T {
      if (shouldFail()) {
        throw new Error('boom');
      }
      return real.withTransaction(fn);
    },
  };
}

/** Minimal valid BackupDataJson used by craft/pack helper tests. */
function minimalBackupData(
  overrides: Partial<BackupDataJson> = {},
): BackupDataJson {
  const now = '2026-09-03T12:00:00.000Z';
  const propertyId = 'prop-minimal-1';
  return {
    properties: [
      {
        id: propertyId,
        name: 'Дом',
        type: 'home',
        note: null,
        created_at: now,
        updated_at: now,
      },
    ],
    locations: [],
    items: [],
    purchases: [],
    warranties: [],
    documents: [],
    maintenance_rules: [],
    maintenance_events: [],
    consumables: [],
    consumable_events: [],
    reminders: [],
    app_settings: [{ key: 'activePropertyId', value: propertyId }],
    ...overrides,
  };
}

function minimalManifest(
  overrides: Partial<BackupManifest> = {},
): BackupManifest {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: '2026-09-03T12:00:00.000Z',
    appVersion: '1.0.0',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    backupId: 'backup-minimal-1',
    ...overrides,
  };
}

/** Pack a valid minimal archive (optionally with files). */
function packMinimal(
  overrides: {
    manifest?: Partial<BackupManifest>;
    data?: Partial<BackupDataJson>;
    files?: Map<string, Uint8Array>;
  } = {},
): Uint8Array {
  return packBackupArchive({
    manifest: minimalManifest(overrides.manifest),
    data: minimalBackupData(overrides.data),
    files: overrides.files ?? new Map(),
  });
}

/**
 * Seed a realistic multi-entity dataset for roundtrip coverage.
 * Returns photo/doc byte maps keyed by the original managed paths.
 */
async function seedRichDataset(
  db: SqlDatabase,
  store: MemoryManagedStore,
  notifications: MockNotificationAdapter,
): Promise<{
  propertyId: string;
  photoBytes: Map<string, Uint8Array>;
  docBytes: Map<string, Uint8Array>;
  itemNames: string[];
}> {
  const propertyId = defaultPropertyId(db);
  const locations = new LocationRepository(db);
  const inventory = new InventoryService(db);
  const documents = new DocumentRepository(db);
  const warranties = new WarrantyService(db, notifications);
  const maintenance = new MaintenanceService(db, notifications);
  const consumables = new ConsumableService(db, notifications);

  const kitchen = locations.createLocation({
    propertyId,
    name: 'Кухня',
    sortOrder: 1,
  });
  const living = locations.createLocation({
    propertyId,
    name: 'Гостиная',
    sortOrder: 2,
  });

  const photoFridge = 'photos/fridge-a.jpg';
  const photoTv = 'photos/tv-b.jpg';
  const fridgePhotoBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const tvPhotoBytes = new Uint8Array([0xff, 0xd8, 0xff, 10, 20, 30]);
  store.seed(photoFridge, fridgePhotoBytes);
  store.seed(photoTv, tvPhotoBytes);

  const fridge = inventory.createItem(
    propertyId,
    {
      ...EMPTY_ITEM_FORM,
      name: 'Холодильник',
      category: 'Кухня',
      locationId: kitchen.id,
      brand: 'LG',
      purchaseDate: '2025-06-01',
      seller: 'М.Видео',
      priceText: '54990',
    },
    photoFridge,
  );
  const tv = inventory.createItem(
    propertyId,
    {
      ...EMPTY_ITEM_FORM,
      name: 'Телевизор',
      category: 'ТВ и аудио',
      locationId: living.id,
      brand: 'Samsung',
      purchaseDate: '2024-11-15',
      seller: 'DNS',
      priceText: '79990',
    },
    photoTv,
  );

  const receiptPath = 'documents/receipt-uuid-1.pdf';
  const manualPath = 'documents/manual-uuid-2.pdf';
  const receiptBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1]);
  const manualBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 2]);
  store.seed(receiptPath, receiptBytes);
  store.seed(manualPath, manualBytes);

  // Same original_name is fine — managed paths must stay distinct.
  documents.create({
    itemId: fridge.id,
    type: 'receipt',
    title: 'Чек',
    filePath: receiptPath,
    originalName: 'receipt.pdf',
    mimeType: 'application/pdf',
    fileSize: receiptBytes.byteLength,
  });
  documents.create({
    itemId: fridge.id,
    type: 'manual',
    title: 'Инструкция',
    filePath: manualPath,
    originalName: 'receipt.pdf',
    mimeType: 'application/pdf',
    fileSize: manualBytes.byteLength,
  });

  await warranties.create(fridge.id, {
    ...EMPTY_WARRANTY_FORM,
    type: 'manufacturer',
    provider: 'LG',
    startDate: '2025-06-01',
    durationMonths: 24,
    reminderOffsets: [30, 7],
    remindersEnabled: true,
  });
  await warranties.create(tv.id, {
    ...EMPTY_WARRANTY_FORM,
    type: 'store',
    provider: 'DNS',
    startDate: '2024-11-15',
    durationMonths: 36,
    reminderOffsets: [30],
    remindersEnabled: true,
  });

  const rule = await maintenance.create(fridge.id, {
    ...EMPTY_MAINTENANCE_FORM,
    title: 'Разморозка',
    intervalValue: 90,
    intervalUnit: 'day',
    dueMode: 'explicit',
    nextDueDate: '2026-10-01',
    remindersEnabled: true,
  });
  await maintenance.markDone(rule.rule.id, '2026-09-01');

  const consumable = await consumables.create(tv.id, {
    ...EMPTY_CONSUMABLE_FORM,
    name: 'Батарейки ПДУ',
    trackStock: true,
    stockQuantity: 2,
    stockUnit: 'pcs',
    intervalValue: 6,
    intervalUnit: 'month',
    dueMode: 'explicit',
    nextDueDate: '2027-03-01',
    remindersEnabled: true,
  });
  await consumables.markReplaced(consumable.consumable.id, '2026-09-02');

  return {
    propertyId,
    photoBytes: new Map([
      [photoFridge, fridgePhotoBytes],
      [photoTv, tvPhotoBytes],
    ]),
    docBytes: new Map([
      [receiptPath, receiptBytes],
      [manualPath, manualBytes],
    ]),
    itemNames: ['Телевизор', 'Холодильник'],
  };
}

describe('backup pack/unpack', () => {
  test('roundtrips a minimal valid archive', () => {
    const files = new Map<string, Uint8Array>([
      ['photos/a.jpg', new Uint8Array([1, 2, 3])],
    ]);
    const data = minimalBackupData({
      items: [
        {
          id: 'item-1',
          property_id: 'prop-minimal-1',
          location_id: null,
          category: 'Другое',
          name: 'Лампочка',
          brand: null,
          model: null,
          serial_number: null,
          note: null,
          primary_photo_path: 'photos/a.jpg',
          status: 'active',
          created_at: '2026-09-03T12:00:00.000Z',
          updated_at: '2026-09-03T12:00:00.000Z',
        },
      ],
    });
    const bytes = packBackupArchive({
      manifest: minimalManifest(),
      data,
      files,
    });
    const unpacked = unpackBackupArchive(bytes);
    expect(unpacked.manifest.format).toBe(BACKUP_FORMAT);
    expect(unpacked.data.items).toHaveLength(1);
    expect(unpacked.files.get('photos/a.jpg')).toEqual(files.get('photos/a.jpg'));
    expect(() => validateUnpackedBackup(unpacked)).not.toThrow();
  });
});

describe('backup restore export', () => {
  test('roundtrip restores entities, files, reminders, and bumps data epoch', async () => {
    const db = openDb();
    const store = new MemoryManagedStore();
    const notifications = new MockNotificationAdapter();
    const seeded = await seedRichDataset(db, store, notifications);

    const epochBefore = getDataEpoch();
    let notifiedEpoch: number | null = null;
    const unsubscribe = subscribeDataReset((epoch) => {
      notifiedEpoch = epoch;
    });

    const { bytes, warnings } = await new BackupService(db, store).createArchiveBytes();
    expect(warnings.length).toBe(0);

    const db2 = openDb();
    const store2 = new MemoryManagedStore();
    const notifications2 = new MockNotificationAdapter();
    const result = await new RestoreService(
      db2,
      notifications2,
      store2,
    ).restoreFromBytes(bytes);

    unsubscribe();

    expect(itemNames(db2).sort()).toEqual(seeded.itemNames.sort());
    expect(result.counts.items).toBe(2);
    expect(getDataEpoch()).toBeGreaterThan(epochBefore);
    expect(notifiedEpoch).toBe(getDataEpoch());

    // Restored paths are rewritten; compare bytes via DB paths + store2.
    const restoredItems = db2.getAll<{
      name: string;
      primary_photo_path: string | null;
    }>('SELECT name, primary_photo_path FROM items ORDER BY name');
    expect(restoredItems).toHaveLength(2);
    for (const item of restoredItems) {
      expect(item.primary_photo_path).toBeTruthy();
      const restoredBytes = await store2.readRelative(item.primary_photo_path!);
      const original =
        item.name === 'Холодильник'
          ? seeded.photoBytes.get('photos/fridge-a.jpg')!
          : seeded.photoBytes.get('photos/tv-b.jpg')!;
      expect(bytesEqual(restoredBytes, original)).toBe(true);
    }

    const restoredDocs = db2.getAll<{ file_path: string; original_name: string | null }>(
      'SELECT file_path, original_name FROM documents ORDER BY file_path',
    );
    expect(restoredDocs).toHaveLength(2);
    expect(restoredDocs.every((d) => d.original_name === 'receipt.pdf')).toBe(true);
    expect(new Set(restoredDocs.map((d) => d.file_path)).size).toBe(2);

    // Byte payloads survive path rewriting (match by content, ignore new paths).
    const serialize = (bytes: Uint8Array) => Array.from(bytes).join(',');
    const restoredDocPayloads: string[] = [];
    for (const doc of restoredDocs) {
      const restoredBytes = await store2.readRelative(doc.file_path);
      expect(restoredBytes).not.toBeNull();
      restoredDocPayloads.push(serialize(restoredBytes!));
    }
    const originalDocPayloads = [...seeded.docBytes.values()].map(serialize);
    expect(restoredDocPayloads.sort()).toEqual(originalDocPayloads.sort());

    // After restore, OS notification ids start null then some are re-scheduled.
    const reminderRows = db2.getAll<{
      notification_id: string | null;
      due_at: string;
    }>('SELECT notification_id, due_at FROM reminders');
    expect(reminderRows.length).toBeGreaterThan(0);
    const now = Date.now();
    const futureCount = reminderRows.filter(
      (row) => Date.parse(row.due_at) > now,
    ).length;
    if (futureCount > 0) {
      expect(notifications2.scheduled.length).toBeGreaterThan(0);
      expect(
        reminderRows.some((row) => row.notification_id != null),
      ).toBe(true);
    }

    const locations = db2
      .getAll<{ name: string }>('SELECT name FROM locations ORDER BY name')
      .map((row) => row.name);
    expect(locations).toEqual(['Гостиная', 'Кухня']);
  });

  test('replace mode removes old items and orphaned managed files', async () => {
    // Target DB currently holds an old TV + photo that the backup does not include.
    const db = openDb();
    const store = new MemoryManagedStore();
    const inventory = new InventoryService(db);
    const propertyId = defaultPropertyId(db);
    const oldPhoto = 'photos/old-tv.jpg';
    const oldBytes = new Uint8Array([9, 9, 9]);
    store.seed(oldPhoto, oldBytes);
    inventory.createItem(
      propertyId,
      { ...EMPTY_ITEM_FORM, name: 'Старый телевизор' },
      oldPhoto,
    );
    expect(await store.readRelative(oldPhoto)).not.toBeNull();

    // Backup source: different item set without the old TV.
    const srcDb = openDb();
    const srcStore = new MemoryManagedStore();
    const srcNotifications = new MockNotificationAdapter();
    const srcInventory = new InventoryService(srcDb);
    const srcPropertyId = defaultPropertyId(srcDb);
    const newPhoto = 'photos/new-lamp.jpg';
    const newBytes = new Uint8Array([7, 7, 7]);
    srcStore.seed(newPhoto, newBytes);
    srcInventory.createItem(
      srcPropertyId,
      { ...EMPTY_ITEM_FORM, name: 'Лампа' },
      newPhoto,
    );
    const { bytes } = await new BackupService(srcDb, srcStore).createArchiveBytes();

    await new RestoreService(
      db,
      srcNotifications,
      store,
    ).restoreFromBytes(bytes);

    expect(itemNames(db)).toEqual(['Лампа']);
    expect(itemNames(db)).not.toContain('Старый телевизор');
    expect(await store.readRelative(oldPhoto)).toBeNull();

    const restoredPhoto = db.getFirst<{ primary_photo_path: string | null }>(
      'SELECT primary_photo_path FROM items WHERE name = ?',
      ['Лампа'],
    )!.primary_photo_path;
    expect(restoredPhoto).toBeTruthy();
    expect(bytesEqual(await store.readRelative(restoredPhoto!), newBytes)).toBe(
      true,
    );
  });

  test('missing file during backup succeeds with warning and null photo after restore', async () => {
    const db = openDb();
    const store = new MemoryManagedStore();
    const inventory = new InventoryService(db);
    const propertyId = defaultPropertyId(db);
    inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Без файла',
    });
    // Point at a managed path that was never written to the store.
    db.run('UPDATE items SET primary_photo_path = ? WHERE name = ?', [
      'photos/missing.jpg',
      'Без файла',
    ]);

    const { bytes, warnings } = await new BackupService(db, store).createArchiveBytes();
    expect(warnings.some((w) => w.includes('photos/missing.jpg'))).toBe(true);

    const db2 = openDb();
    const store2 = new MemoryManagedStore();
    await new RestoreService(
      db2,
      new MockNotificationAdapter(),
      store2,
    ).restoreFromBytes(bytes);

    const photo = db2.getFirst<{ primary_photo_path: string | null }>(
      'SELECT primary_photo_path FROM items WHERE name = ?',
      ['Без файла'],
    )!.primary_photo_path;
    expect(photo).toBeNull();
  });

  test('corrupt zip / truncated / missing manifest / invalid JSON reject without mutating DB', async () => {
    const db = openDb();
    const store = new MemoryManagedStore();
    const inventory = new InventoryService(db);
    inventory.createItem(defaultPropertyId(db), {
      ...EMPTY_ITEM_FORM,
      name: 'Keep me',
    });
    const before = countItems(db);
    const restore = new RestoreService(db, new MockNotificationAdapter(), store);

    const randomBytes = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(restore.previewFromBytes(randomBytes)).rejects.toMatchObject({
      code: 'INVALID_ZIP',
    });
    await expect(restore.restoreFromBytes(randomBytes)).rejects.toMatchObject({
      code: 'INVALID_ZIP',
    });

    const valid = packMinimal();
    const truncated = valid.slice(0, Math.max(4, Math.floor(valid.length / 3)));
    await expect(restore.previewFromBytes(truncated)).rejects.toBeInstanceOf(
      AppError,
    );
    expect(countItems(db)).toBe(before);

    const noManifest = zipSync({
      'data.json': strToU8(JSON.stringify(minimalBackupData())),
    });
    await expect(restore.previewFromBytes(noManifest)).rejects.toMatchObject({
      code: 'MISSING_MANIFEST',
    });

    const badJson = zipSync({
      'manifest.json': strToU8('{not-json'),
      'data.json': strToU8(JSON.stringify(minimalBackupData())),
    });
    await expect(restore.previewFromBytes(badJson)).rejects.toMatchObject({
      code: 'INVALID_JSON',
    });

    expect(countItems(db)).toBe(before);
    expect(itemNames(db)).toEqual(['Keep me']);
  });

  test('wrong format is rejected', async () => {
    const bytes = packMinimal({
      manifest: { format: 'other-app' as typeof BACKUP_FORMAT },
    });
    const restore = new RestoreService(
      openDb(),
      new MockNotificationAdapter(),
      new MemoryManagedStore(),
    );
    await expect(restore.previewFromBytes(bytes)).rejects.toMatchObject({
      code: 'WRONG_FORMAT',
    });
  });

  test('future formatVersion 999 message mentions новой версией', async () => {
    const bytes = packMinimal({
      manifest: { formatVersion: 999 },
    });
    const restore = new RestoreService(
      openDb(),
      new MockNotificationAdapter(),
      new MemoryManagedStore(),
    );
    await expect(restore.previewFromBytes(bytes)).rejects.toThrow(
      /новой версией/,
    );
    await expect(restore.previewFromBytes(bytes)).rejects.toMatchObject({
      code: 'UNSUPPORTED_FORMAT_VERSION',
    });
  });

  test('duplicate item IDs fail validation', () => {
    const bytes = packMinimal({
      data: {
        items: [
          {
            id: 'dup',
            property_id: 'prop-minimal-1',
            location_id: null,
            category: 'Другое',
            name: 'A',
            brand: null,
            model: null,
            serial_number: null,
            note: null,
            primary_photo_path: null,
            status: 'active',
            created_at: '2026-09-03T12:00:00.000Z',
            updated_at: '2026-09-03T12:00:00.000Z',
          },
          {
            id: 'dup',
            property_id: 'prop-minimal-1',
            location_id: null,
            category: 'Другое',
            name: 'B',
            brand: null,
            model: null,
            serial_number: null,
            note: null,
            primary_photo_path: null,
            status: 'active',
            created_at: '2026-09-03T12:00:00.000Z',
            updated_at: '2026-09-03T12:00:00.000Z',
          },
        ],
      },
    });
    const unpacked = unpackBackupArchive(bytes);
    expect(() => validateUnpackedBackup(unpacked)).toThrow(AppError);
    try {
      validateUnpackedBackup(unpacked);
    } catch (err) {
      expect(err).toMatchObject({ code: 'DUPLICATE_ID' });
    }
  });

  test('invalid FK (document item_id missing) rejects before mutation', async () => {
    const db = openDb();
    const store = new MemoryManagedStore();
    const inventory = new InventoryService(db);
    inventory.createItem(defaultPropertyId(db), {
      ...EMPTY_ITEM_FORM,
      name: 'Survivor',
    });
    const before = countItems(db);

    const docPath = 'documents/orphan.pdf';
    const bytes = packMinimal({
      data: {
        documents: [
          {
            id: 'doc-1',
            item_id: 'missing-item',
            type: 'receipt',
            title: 'Orphan',
            file_path: docPath,
            mime_type: 'application/pdf',
            original_name: 'x.pdf',
            file_size: 3,
            created_at: '2026-09-03T12:00:00.000Z',
            updated_at: '2026-09-03T12:00:00.000Z',
          },
        ],
      },
      files: new Map([[docPath, new Uint8Array([1, 2, 3])]]),
    });

    await expect(
      new RestoreService(db, new MockNotificationAdapter(), store).restoreFromBytes(
        bytes,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_FK' });
    expect(countItems(db)).toBe(before);
    expect(itemNames(db)).toEqual(['Survivor']);
  });

  test('unsafe archive entry path and data path are rejected', async () => {
    const evilZip = zipSync({
      'manifest.json': strToU8(JSON.stringify(minimalManifest())),
      'data.json': strToU8(JSON.stringify(minimalBackupData())),
      'files/../../evil': new Uint8Array([1]),
    });
    await expect(
      new RestoreService(
        openDb(),
        new MockNotificationAdapter(),
        new MemoryManagedStore(),
      ).previewFromBytes(evilZip),
    ).rejects.toMatchObject({ code: 'UNSAFE_PATH' });

    // Mutate after pack — packBackupArchive only guards files/ entry keys.
    const unpacked = unpackBackupArchive(
      packMinimal({
        data: {
          items: [
            {
              id: 'item-unsafe',
              property_id: 'prop-minimal-1',
              location_id: null,
              category: 'Другое',
              name: 'Bad path',
              brand: null,
              model: null,
              serial_number: null,
              note: null,
              primary_photo_path: null,
              status: 'active',
              created_at: '2026-09-03T12:00:00.000Z',
              updated_at: '2026-09-03T12:00:00.000Z',
            },
          ],
        },
      }),
    );
    unpacked.data.items[0]!.primary_photo_path = '../../x';
    expect(() => validateUnpackedBackup(unpacked)).toThrow(AppError);
    try {
      validateUnpackedBackup(unpacked);
    } catch (err) {
      expect(err).toMatchObject({ code: 'UNSAFE_PATH' });
    }
  });

  test('DB failure after staging rolls back files and leaves old DB intact', async () => {
    const realDb = openDb();
    const store = new MemoryManagedStore();
    const inventory = new InventoryService(realDb);
    const propertyId = defaultPropertyId(realDb);
    const oldPhoto = 'photos/old-keep.jpg';
    const oldBytes = new Uint8Array([4, 5, 6]);
    store.seed(oldPhoto, oldBytes);
    inventory.createItem(
      propertyId,
      { ...EMPTY_ITEM_FORM, name: 'Старые данные' },
      oldPhoto,
    );

    const srcDb = openDb();
    const srcStore = new MemoryManagedStore();
    const srcInventory = new InventoryService(srcDb);
    const newPhoto = 'photos/incoming.jpg';
    const newBytes = new Uint8Array([8, 8, 8]);
    srcStore.seed(newPhoto, newBytes);
    srcInventory.createItem(
      defaultPropertyId(srcDb),
      { ...EMPTY_ITEM_FORM, name: 'Новые данные' },
      newPhoto,
    );
    const { bytes } = await new BackupService(srcDb, srcStore).createArchiveBytes();

    let fail = false;
    const wrapped = wrapDbFailingTransaction(realDb, () => fail);
    fail = true;

    await expect(
      new RestoreService(
        wrapped,
        new MockNotificationAdapter(),
        store,
      ).restoreFromBytes(bytes),
    ).rejects.toMatchObject({ code: 'DB_RESTORE_FAILED' });

    expect(itemNames(realDb)).toEqual(['Старые данные']);
    expect(bytesEqual(await store.readRelative(oldPhoto), oldBytes)).toBe(true);

    // Staged new files must be cleaned up on failure (no orphan incoming paths).
    const remaining = await store.listRelativePaths();
    expect(remaining).toEqual([oldPhoto]);
    expect(remaining.every((p) => !p.includes('incoming'))).toBe(true);
  });

  test('reminder reconstruction drops old OS notification ids and schedules future ones', async () => {
    const srcDb = openDb();
    const srcStore = new MemoryManagedStore();
    const srcNotifications = new MockNotificationAdapter();
    const inventory = new InventoryService(srcDb);
    const warranties = new WarrantyService(srcDb, srcNotifications);
    const item = inventory.createItem(defaultPropertyId(srcDb), {
      ...EMPTY_ITEM_FORM,
      name: 'Пылесос',
    });
    await warranties.create(item.id, {
      ...EMPTY_WARRANTY_FORM,
      startDate: '2026-01-01',
      durationMonths: 24,
      reminderOffsets: [30, 7],
      remindersEnabled: true,
    });

    // Force a portable-unsafe OS id into the live DB, then inject it into archive.
    srcDb.run(`UPDATE reminders SET notification_id = ?`, ['old-os-id']);
    const { bytes } = await new BackupService(srcDb, srcStore).createArchiveBytes();
    const unpacked = unpackBackupArchive(bytes);
    expect(unpacked.data.reminders.length).toBeGreaterThan(0);
    for (const reminder of unpacked.data.reminders) {
      reminder.notification_id = 'old-os-id';
    }
    const tainted = packBackupArchive({
      manifest: unpacked.manifest,
      data: unpacked.data,
      files: unpacked.files,
    });

    const db2 = openDb();
    const store2 = new MemoryManagedStore();
    const notifications2 = new MockNotificationAdapter();
    await new RestoreService(db2, notifications2, store2).restoreFromBytes(tainted);

    const ids = db2
      .getAll<{ notification_id: string | null }>(
        'SELECT notification_id FROM reminders',
      )
      .map((row) => row.notification_id);
    expect(ids.every((id) => id !== 'old-os-id')).toBe(true);

    const futureReminders = db2.getAll<{ due_at: string }>(
      'SELECT due_at FROM reminders WHERE enabled = 1',
    );
    const hasFuture = futureReminders.some(
      (row) => Date.parse(row.due_at) > Date.now(),
    );
    if (hasFuture) {
      expect(notifications2.scheduled.length).toBeGreaterThan(0);
      expect(notifications2.scheduled.every((s) => s.id !== 'old-os-id')).toBe(
        true,
      );
    }
  });

  test('double restore / backup while lock held throws BUSY', async () => {
    const db = openDb();
    const store = new MemoryManagedStore();
    acquireBackupLock('restore');

    await expect(
      new BackupService(db, store).createArchiveBytes(),
    ).rejects.toMatchObject({ code: 'BUSY' });

    await expect(
      new RestoreService(
        db,
        new MockNotificationAdapter(),
        store,
      ).restoreFromBytes(packMinimal()),
    ).rejects.toMatchObject({ code: 'BUSY' });
  });

  test('export CSV escapes formula injection in item names', () => {
    const db = openDb();
    new InventoryService(db).createItem(defaultPropertyId(db), {
      ...EMPTY_ITEM_FORM,
      name: '=CMD',
    });
    const csv = new ExportService(db).buildCsv('inventory');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("'=CMD");
    expect(csv).not.toMatch(/(^|[\r\n;])=CMD/);
  });

  test('previewFromBytes does not mutate the database', async () => {
    const db = openDb();
    const store = new MemoryManagedStore();
    new InventoryService(db).createItem(defaultPropertyId(db), {
      ...EMPTY_ITEM_FORM,
      name: 'Untouched',
    });
    const before = countItems(db);

    const srcDb = openDb();
    const srcStore = new MemoryManagedStore();
    new InventoryService(srcDb).createItem(defaultPropertyId(srcDb), {
      ...EMPTY_ITEM_FORM,
      name: 'From backup',
    });
    const { bytes } = await new BackupService(srcDb, srcStore).createArchiveBytes();

    const preview = await new RestoreService(
      db,
      new MockNotificationAdapter(),
      store,
    ).previewFromBytes(bytes);

    expect(preview.counts.items).toBe(1);
    expect(countItems(db)).toBe(before);
    expect(itemNames(db)).toEqual(['Untouched']);
  });
});
