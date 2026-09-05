/**
 * Location repository — rooms / storage places within a property.
 */

import { AppError } from '@/src/domain/errors';
import { createEntityIdSync } from '@/src/domain/ids';
import type { Location } from '@/src/domain/types';
import type { SqlDatabase } from '@/src/db/types';
import { nowUtcInstant } from '@/src/utils/datetime';

type LocationRow = {
  id: string;
  property_id: string;
  parent_location_id: string | null;
  name: string;
  sort_order: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: LocationRow): Location {
  return {
    id: row.id,
    propertyId: row.property_id,
    parentLocationId: row.parent_location_id,
    name: row.name,
    sortOrder: row.sort_order,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class LocationRepository {
  constructor(private readonly db: SqlDatabase) {}

  listByProperty(propertyId: string): Location[] {
    const rows = this.db.getAll<LocationRow>(
      `SELECT * FROM locations WHERE property_id = ?
       ORDER BY sort_order ASC, name COLLATE NOCASE ASC`,
      [propertyId],
    );
    return rows.map(mapRow);
  }

  countByProperty(propertyId: string): number {
    const row = this.db.getFirst<{ c: number }>(
      'SELECT COUNT(*) AS c FROM locations WHERE property_id = ?',
      [propertyId],
    );
    return row?.c ?? 0;
  }

  /**
   * Finds an existing location by case-insensitive name within a property.
   * Uses JS locale compare because SQLite NOCASE is ASCII-only.
   */
  findByName(propertyId: string, name: string): Location | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const needle = trimmed.toLocaleLowerCase('ru-RU');
    return (
      this.listByProperty(propertyId).find(
        (loc) => loc.name.trim().toLocaleLowerCase('ru-RU') === needle,
      ) ?? null
    );
  }

  createLocation(input: {
    propertyId: string;
    name: string;
    parentLocationId?: string | null;
    sortOrder?: number;
    note?: string | null;
  }): Location {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new AppError('Введите название места');
    }

    // Reuse an existing same-named place instead of inserting a duplicate.
    const existing = this.findByName(input.propertyId, trimmed);
    if (existing) {
      return existing;
    }

    const now = nowUtcInstant();
    const id = createEntityIdSync();
    try {
      this.db.run(
        `INSERT INTO locations
         (id, property_id, parent_location_id, name, sort_order, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.propertyId,
          input.parentLocationId ?? null,
          trimmed,
          input.sortOrder ?? 0,
          input.note ?? null,
          now,
          now,
        ],
      );
    } catch (err) {
      throw new AppError('Не удалось создать место', { cause: err });
    }
    return this.getById(id)!;
  }

  updateLocation(locationId: string, name: string): Location {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new AppError('Введите название места');
    }
    const existing = this.getById(locationId);
    if (!existing) {
      throw new AppError('Место не найдено', { code: 'NOT_FOUND' });
    }
    const collision = this.findByName(existing.propertyId, trimmed);
    if (collision && collision.id !== locationId) {
      throw new AppError('Место с таким названием уже есть');
    }
    const now = nowUtcInstant();
    this.db.run(
      'UPDATE locations SET name = ?, updated_at = ? WHERE id = ?',
      [trimmed, now, locationId],
    );
    return this.getById(locationId)!;
  }

  /**
   * Deletes a location. When unlinkItems is true, items are moved to "no location".
   * When false and items exist, throws.
   */
  deleteLocation(locationId: string, options?: { unlinkItems?: boolean }): void {
    const itemCount = this.db.getFirst<{ c: number }>(
      `SELECT COUNT(*) AS c FROM items WHERE location_id = ? AND status = 'active'`,
      [locationId],
    );
    const count = itemCount?.c ?? 0;
    if (count > 0 && !options?.unlinkItems) {
      throw new AppError(
        `В этом месте ${count} вещей. Сначала перенесите их или подтвердите удаление.`,
        { code: 'LOCATION_NOT_EMPTY' },
      );
    }

    this.db.withTransaction(() => {
      if (count > 0) {
        const now = nowUtcInstant();
        this.db.run(
          'UPDATE items SET location_id = NULL, updated_at = ? WHERE location_id = ?',
          [now, locationId],
        );
      }
      this.db.run('DELETE FROM locations WHERE id = ?', [locationId]);
    });
  }

  getById(id: string): Location | null {
    const row = this.db.getFirst<LocationRow>(
      'SELECT * FROM locations WHERE id = ?',
      [id],
    );
    return row ? mapRow(row) : null;
  }
}
