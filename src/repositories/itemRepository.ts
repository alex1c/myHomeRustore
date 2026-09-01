/**
 * Item repository — core household asset records.
 */

import { AppError } from '@/src/domain/errors';
import { createEntityIdSync } from '@/src/domain/ids';
import type { Item, ItemStatus } from '@/src/domain/types';
import type { SqlDatabase } from '@/src/db/types';
import { nowUtcInstant } from '@/src/utils/datetime';

type ItemRow = {
  id: string;
  property_id: string;
  location_id: string | null;
  category: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  note: string | null;
  primary_photo_path: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ItemRow): Item {
  return {
    id: row.id,
    propertyId: row.property_id,
    locationId: row.location_id,
    category: row.category,
    name: row.name,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serial_number,
    note: row.note,
    primaryPhotoPath: row.primary_photo_path,
    status: row.status as ItemStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ItemRepository {
  constructor(private readonly db: SqlDatabase) {}

  listByProperty(propertyId: string): Item[] {
    const rows = this.db.getAll<ItemRow>(
      `SELECT * FROM items WHERE property_id = ? AND status = 'active'
       ORDER BY name COLLATE NOCASE ASC`,
      [propertyId],
    );
    return rows.map(mapRow);
  }

  getById(id: string): Item | null {
    const row = this.db.getFirst<ItemRow>('SELECT * FROM items WHERE id = ?', [id]);
    return row ? mapRow(row) : null;
  }

  createItem(input: {
    propertyId: string;
    name: string;
    category?: string;
    locationId?: string | null;
    brand?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    note?: string | null;
    primaryPhotoPath?: string | null;
  }): Item {
    const now = nowUtcInstant();
    const id = createEntityIdSync();
    try {
      this.db.run(
        `INSERT INTO items
         (id, property_id, location_id, category, name, brand, model, serial_number,
          note, primary_photo_path, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [
          id,
          input.propertyId,
          input.locationId ?? null,
          input.category ?? 'other',
          input.name.trim(),
          input.brand ?? null,
          input.model ?? null,
          input.serialNumber ?? null,
          input.note ?? null,
          input.primaryPhotoPath ?? null,
          now,
          now,
        ],
      );
    } catch (err) {
      throw new AppError('Failed to create item', { cause: err });
    }
    return this.getById(id)!;
  }

  /** Collect managed file paths linked to an item (for deletion flow). */
  listManagedFilePathsForItem(itemId: string): string[] {
    const item = this.getById(itemId);
    const paths: string[] = [];
    if (item?.primaryPhotoPath) {
      paths.push(item.primaryPhotoPath);
    }
    const docs = this.db.getAll<{ file_path: string }>(
      'SELECT file_path FROM documents WHERE item_id = ?',
      [itemId],
    );
    for (const doc of docs) {
      paths.push(doc.file_path);
    }
    return paths;
  }

  deleteItem(itemId: string): void {
    this.db.run('DELETE FROM items WHERE id = ?', [itemId]);
  }
}
