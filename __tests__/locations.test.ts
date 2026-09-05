/**
 * Location create / duplicate / refresh regression tests.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import { AppError } from '@/src/domain/errors';
import { EMPTY_ITEM_FORM } from '@/src/domain/inventory';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { LocationRepository } from '@/src/repositories/locationRepository';
import { InventoryService } from '@/src/services/inventoryService';
import type { SqlDatabase } from '@/src/db/types';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('locations', () => {
  test('create appears immediately in listByProperty and can be selected', async () => {
    const db = await openTestDb();
    const locations = new LocationRepository(db);
    const propertyId = db.getFirst<{ id: string }>(
      'SELECT id FROM properties LIMIT 1',
    )!.id;

    expect(locations.listByProperty(propertyId)).toHaveLength(0);

    const created = locations.createLocation({
      propertyId,
      name: 'Кухня',
    });

    const listed = locations.listByProperty(propertyId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
    expect(listed[0]?.name).toBe('Кухня');
    expect(locations.getById(created.id)?.name).toBe('Кухня');
  });

  test('duplicate name reuses existing location instead of inserting', async () => {
    const db = await openTestDb();
    const locations = new LocationRepository(db);
    const propertyId = db.getFirst<{ id: string }>(
      'SELECT id FROM properties LIMIT 1',
    )!.id;

    const first = locations.createLocation({ propertyId, name: 'Кухня' });
    const second = locations.createLocation({ propertyId, name: ' кухня ' });

    expect(second.id).toBe(first.id);
    expect(locations.listByProperty(propertyId)).toHaveLength(1);
  });

  test('empty name is rejected', async () => {
    const db = await openTestDb();
    const locations = new LocationRepository(db);
    const propertyId = db.getFirst<{ id: string }>(
      'SELECT id FROM properties LIMIT 1',
    )!.id;

    expect(() =>
      locations.createLocation({ propertyId, name: '   ' }),
    ).toThrow(AppError);
    expect(locations.listByProperty(propertyId)).toHaveLength(0);
  });

  test('rename and delete refresh list; delete unlinks items', async () => {
    const db = await openTestDb();
    const locations = new LocationRepository(db);
    const inventory = new InventoryService(db);
    const items = new ItemRepository(db);
    const propertyId = db.getFirst<{ id: string }>(
      'SELECT id FROM properties LIMIT 1',
    )!.id;

    const kitchen = locations.createLocation({ propertyId, name: 'Кухня' });
    inventory.createItem(propertyId, {
      ...EMPTY_ITEM_FORM,
      name: 'Чайник',
      locationId: kitchen.id,
    });

    locations.updateLocation(kitchen.id, 'Кухня большая');
    expect(locations.listByProperty(propertyId)[0]?.name).toBe('Кухня большая');

    locations.deleteLocation(kitchen.id, { unlinkItems: true });
    expect(locations.listByProperty(propertyId)).toHaveLength(0);
    expect(items.listFiltered(propertyId, {
      search: '',
      location: { type: 'all' },
      category: { type: 'all' },
      sort: 'name',
    })[0]?.item.locationId).toBeNull();
  });

  test('rename collision is rejected', async () => {
    const db = await openTestDb();
    const locations = new LocationRepository(db);
    const propertyId = db.getFirst<{ id: string }>(
      'SELECT id FROM properties LIMIT 1',
    )!.id;

    locations.createLocation({ propertyId, name: 'Кухня' });
    const living = locations.createLocation({ propertyId, name: 'Гостиная' });

    expect(() => locations.updateLocation(living.id, 'кухня')).toThrow(AppError);
  });
});
