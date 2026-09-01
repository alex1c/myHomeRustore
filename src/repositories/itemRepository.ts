/**
 * Item repository — core household asset records.
 */

import { AppError } from '@/src/domain/errors';
import type { InventoryFilters, ItemListRow } from '@/src/domain/inventory';
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

type ListRow = ItemRow & {
  location_name: string | null;
  price_minor: number | null;
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

function mapListRow(row: ListRow): ItemListRow {
  return {
    item: mapRow(row),
    locationName: row.location_name,
    priceMinor: row.price_minor,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

export class ItemRepository {
  constructor(private readonly db: SqlDatabase) {}

  countActive(propertyId: string): number {
    const row = this.db.getFirst<{ c: number }>(
      `SELECT COUNT(*) AS c FROM items WHERE property_id = ? AND status = 'active'`,
      [propertyId],
    );
    return row?.c ?? 0;
  }

  listRecent(propertyId: string, limit: number): ItemListRow[] {
    const rows = this.db.getAll<ListRow>(
      `SELECT i.*, l.name AS location_name,
        (SELECT price_minor FROM purchases WHERE item_id = i.id
         ORDER BY created_at DESC LIMIT 1) AS price_minor
       FROM items i
       LEFT JOIN locations l ON l.id = i.location_id
       WHERE i.property_id = ? AND i.status = 'active'
       ORDER BY i.created_at DESC
       LIMIT ?`,
      [propertyId, limit],
    );
    return rows.map(mapListRow);
  }

  listFiltered(propertyId: string, filters: InventoryFilters): ItemListRow[] {
    const params: (string | number)[] = [propertyId];
    let sql = `
      SELECT i.*, l.name AS location_name,
        (SELECT price_minor FROM purchases WHERE item_id = i.id
         ORDER BY created_at DESC LIMIT 1) AS price_minor
      FROM items i
      LEFT JOIN locations l ON l.id = i.location_id
      WHERE i.property_id = ? AND i.status = 'active'
    `;

    if (filters.location.type === 'none') {
      sql += ' AND i.location_id IS NULL';
    } else if (filters.location.type === 'location') {
      sql += ' AND i.location_id = ?';
      params.push(filters.location.locationId);
    }

    if (filters.category.type === 'category') {
      sql += ' AND i.category = ?';
      params.push(filters.category.category);
    }

    const query = filters.search.trim();
    if (query.length > 0) {
      const like = `%${escapeLike(query)}%`;
      sql += ` AND (
        i.name LIKE ? ESCAPE '\\' OR
        IFNULL(i.brand, '') LIKE ? ESCAPE '\\' OR
        IFNULL(i.model, '') LIKE ? ESCAPE '\\' OR
        IFNULL(i.serial_number, '') LIKE ? ESCAPE '\\' OR
        i.category LIKE ? ESCAPE '\\'
      )`;
      params.push(like, like, like, like, like);
    }

    if (filters.sort === 'name') {
      sql += ' ORDER BY i.name COLLATE NOCASE ASC';
    } else if (filters.sort === 'price') {
      sql += ` ORDER BY (
        SELECT IFNULL(price_minor, -1) FROM purchases WHERE item_id = i.id
        ORDER BY created_at DESC LIMIT 1
      ) DESC, i.name COLLATE NOCASE ASC`;
    } else {
      sql += ' ORDER BY i.created_at DESC';
    }

    const rows = this.db.getAll<ListRow>(sql, params);
    return rows.map(mapListRow);
  }

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
          input.category ?? 'Другое',
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

  updateItem(
    itemId: string,
    input: {
      name?: string;
      category?: string;
      locationId?: string | null;
      brand?: string | null;
      model?: string | null;
      serialNumber?: string | null;
      note?: string | null;
      primaryPhotoPath?: string | null;
      clearPhoto?: boolean;
    },
  ): Item {
    const existing = this.getById(itemId);
    if (!existing) {
      throw new AppError('Item not found', { code: 'NOT_FOUND' });
    }

    const now = nowUtcInstant();
    let photoPath = existing.primaryPhotoPath;
    if (input.clearPhoto) {
      photoPath = null;
    } else if (input.primaryPhotoPath !== undefined) {
      photoPath = input.primaryPhotoPath;
    }

    try {
      this.db.run(
        `UPDATE items SET
          name = ?, category = ?, location_id = ?, brand = ?, model = ?,
          serial_number = ?, note = ?, primary_photo_path = ?, updated_at = ?
         WHERE id = ?`,
        [
          input.name?.trim() ?? existing.name,
          input.category ?? existing.category,
          input.locationId !== undefined ? input.locationId : existing.locationId,
          input.brand !== undefined ? input.brand : existing.brand,
          input.model !== undefined ? input.model : existing.model,
          input.serialNumber !== undefined ? input.serialNumber : existing.serialNumber,
          input.note !== undefined ? input.note : existing.note,
          photoPath,
          now,
          itemId,
        ],
      );
    } catch (err) {
      throw new AppError('Failed to update item', { cause: err });
    }
    return this.getById(itemId)!;
  }

  countAtLocation(locationId: string): number {
    const row = this.db.getFirst<{ c: number }>(
      `SELECT COUNT(*) AS c FROM items WHERE location_id = ? AND status = 'active'`,
      [locationId],
    );
    return row?.c ?? 0;
  }

  unlinkFromLocation(locationId: string): void {
    const now = nowUtcInstant();
    this.db.run(
      `UPDATE items SET location_id = NULL, updated_at = ? WHERE location_id = ?`,
      [now, locationId],
    );
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
    return [...new Set(paths)];
  }

  deleteItem(itemId: string): void {
    this.db.run('DELETE FROM items WHERE id = ?', [itemId]);
  }
}
