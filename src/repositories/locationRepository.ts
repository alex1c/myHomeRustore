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

  createLocation(input: {
    propertyId: string;
    name: string;
    parentLocationId?: string | null;
    sortOrder?: number;
    note?: string | null;
  }): Location {
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
          input.name.trim(),
          input.sortOrder ?? 0,
          input.note ?? null,
          now,
          now,
        ],
      );
    } catch (err) {
      throw new AppError('Failed to create location', { cause: err });
    }
    return this.getById(id)!;
  }

  getById(id: string): Location | null {
    const row = this.db.getFirst<LocationRow>(
      'SELECT * FROM locations WHERE id = ?',
      [id],
    );
    return row ? mapRow(row) : null;
  }
}
