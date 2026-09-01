/**
 * Property repository — homes / apartments the user tracks.
 */

import { createEntityIdSync } from '@/src/domain/ids';
import type { Property, PropertyType } from '@/src/domain/types';
import type { SqlDatabase } from '@/src/db/types';
import { nowUtcInstant } from '@/src/utils/datetime';

type PropertyRow = {
  id: string;
  name: string;
  type: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: PropertyRow): Property {
  return {
    id: row.id,
    name: row.name,
    type: row.type as PropertyType,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const DEFAULT_PROPERTY_NAME = 'Мой дом';
const DEFAULT_PROPERTY_ID = 'default-property';

export class PropertyRepository {
  constructor(private readonly db: SqlDatabase) {}

  /** Idempotent first-run seed — creates one default property when table is empty. */
  ensureDefaultProperty(): Property {
    const existing = this.listProperties();
    if (existing.length > 0) {
      return existing[0];
    }

    const now = nowUtcInstant();
    this.db.run(
      `INSERT OR IGNORE INTO properties
       (id, name, type, note, created_at, updated_at)
       SELECT ?, ?, 'home', NULL, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM properties)`,
      [DEFAULT_PROPERTY_ID, DEFAULT_PROPERTY_NAME, now, now],
    );

    const property = this.getById(DEFAULT_PROPERTY_ID) ?? this.listProperties()[0];
    if (!property) {
      throw new Error('Failed to ensure default property');
    }
    return property;
  }

  listProperties(): Property[] {
    const rows = this.db.getAll<PropertyRow>(
      'SELECT * FROM properties ORDER BY name COLLATE NOCASE',
    );
    return rows.map(mapRow);
  }

  getById(id: string): Property | null {
    const row = this.db.getFirst<PropertyRow>(
      'SELECT * FROM properties WHERE id = ?',
      [id],
    );
    return row ? mapRow(row) : null;
  }

  createProperty(input: {
    name: string;
    type?: PropertyType;
    note?: string | null;
  }): Property {
    const now = nowUtcInstant();
    const id = createEntityIdSync();
    this.db.run(
      `INSERT INTO properties (id, name, type, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.name.trim(), input.type ?? 'home', input.note ?? null, now, now],
    );
    return this.getById(id)!;
  }
}
