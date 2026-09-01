/**
 * Inventory repository and service tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { DEFAULT_INVENTORY_FILTERS, EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { LocationRepository } from '@/src/repositories/locationRepository';
import { PurchaseRepository } from '@/src/repositories/purchaseRepository';
import { InventoryService } from '@/src/services/inventoryService';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('inventory', () => {
  test('create item with purchase and list', async () => {
    const db = await openTestDb();
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;

    const item = inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Чайник',
      category: 'Бытовая техника',
      priceText: '1 299,50',
      seller: 'DNS',
      purchaseDate: '2026-08-15',
    });

    expect(item.name).toBe('Чайник');
    const detail = inventory.getDetail(item.id);
    expect(detail?.purchase?.priceMinor).toBe(129950);
    expect(detail?.purchase?.seller).toBe('DNS');

    const rows = inventory.list(propertyId, DEFAULT_INVENTORY_FILTERS);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.priceMinor).toBe(129950);
  });

  test('update item and purchase', async () => {
    const db = await openTestDb();
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;

    const item = inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Пылесос',
      priceText: '10000',
    });

    inventory.updateItem(item.id, {
      ...EMPTY_ITEM_FORM,
      name: 'Пылесос Dreame',
      category: 'Бытовая техника',
      customCategory: '',
      locationId: null,
      brand: 'Dreame',
      model: 'L10s',
      serialNumber: '',
      note: '',
      purchaseDate: '2026-08-15',
      seller: 'М.Видео',
      priceText: '54 990,50',
    });

    const detail = inventory.getDetail(item.id);
    expect(detail?.item.name).toBe('Пылесос Dreame');
    expect(detail?.item.brand).toBe('Dreame');
    expect(detail?.purchase?.priceMinor).toBe(5499050);
  });

  test('search and filter by location', async () => {
    const db = await openTestDb();
    const inventory = new InventoryService(db);
    const locations = new LocationRepository(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;
    const kitchen = locations.createLocation({ propertyId, name: 'Кухня' });

    inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Чайник Bosch',
      brand: 'Bosch',
      locationId: kitchen.id,
    });
    inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Диван',
      locationId: null,
    });

    const bySearch = inventory.list(propertyId, {
      ...DEFAULT_INVENTORY_FILTERS,
      search: 'bosch',
    });
    expect(bySearch).toHaveLength(1);
    expect(bySearch[0]?.item.name).toContain('Bosch');

    const byLocation = inventory.list(propertyId, {
      ...DEFAULT_INVENTORY_FILTERS,
      location: { type: 'location', locationId: kitchen.id },
    });
    expect(byLocation).toHaveLength(1);

    const noLocation = inventory.list(propertyId, {
      ...DEFAULT_INVENTORY_FILTERS,
      location: { type: 'none' },
    });
    expect(noLocation).toHaveLength(1);
  });

  test('delete item removes purchase', async () => {
    const db = await openTestDb();
    const inventory = new InventoryService(db);
    const items = new ItemRepository(db);
    const purchases = new PurchaseRepository(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;

    const item = inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Временная вещь',
      priceText: '500',
    });

    items.deleteItem(item.id);
    expect(purchases.getByItemId(item.id)).toBeNull();
  });

  test('custom category from Другое', async () => {
    const db = await openTestDb();
    const inventory = new InventoryService(db);
    const propertyId = db.getFirst<{ id: string }>('SELECT id FROM properties LIMIT 1')!.id;

    const item = inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Велосипед',
      category: 'Другое',
      customCategory: 'Спорт',
    });

    expect(item.category).toBe('Спорт');
  });
});
