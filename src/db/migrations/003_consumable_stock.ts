/**
 * Migration 003 — consumable stock tracking and typed events.
 *
 * Why: schema v2 consumables had no stock fields, and consumable_events
 * could not distinguish replacement from stock adjustments without
 * encoding semantics into free-text notes.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration003ConsumableStock: Migration = {
  version: 3,
  name: '003_consumable_stock',

  up(db: SqlDatabase): void {
    // NULL stock_quantity means stock tracking is off; 0 means tracked and empty.
    db.exec(`
      ALTER TABLE consumables ADD COLUMN stock_quantity INTEGER;
      ALTER TABLE consumables ADD COLUMN stock_unit TEXT;
      ALTER TABLE consumables ADD COLUMN manufacturer TEXT;

      ALTER TABLE consumable_events ADD COLUMN event_type TEXT NOT NULL DEFAULT 'replacement';
      ALTER TABLE consumable_events ADD COLUMN quantity_delta INTEGER;
      ALTER TABLE consumable_events ADD COLUMN stock_before INTEGER;
      ALTER TABLE consumable_events ADD COLUMN stock_after INTEGER;
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS consumables_stock_non_negative_insert
      BEFORE INSERT ON consumables
      WHEN NEW.stock_quantity IS NOT NULL AND (
        typeof(NEW.stock_quantity) != 'integer' OR NEW.stock_quantity < 0
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid consumable stock');
      END;

      CREATE TRIGGER IF NOT EXISTS consumables_stock_non_negative_update
      BEFORE UPDATE OF stock_quantity ON consumables
      WHEN NEW.stock_quantity IS NOT NULL AND (
        typeof(NEW.stock_quantity) != 'integer' OR NEW.stock_quantity < 0
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid consumable stock');
      END;

      CREATE TRIGGER IF NOT EXISTS consumables_stock_unit_insert
      BEFORE INSERT ON consumables
      WHEN NEW.stock_unit IS NOT NULL AND NEW.stock_unit NOT IN ('pcs', 'set', 'pack')
      BEGIN
        SELECT RAISE(ABORT, 'invalid consumable stock unit');
      END;

      CREATE TRIGGER IF NOT EXISTS consumables_stock_unit_update
      BEFORE UPDATE OF stock_unit ON consumables
      WHEN NEW.stock_unit IS NOT NULL AND NEW.stock_unit NOT IN ('pcs', 'set', 'pack')
      BEGIN
        SELECT RAISE(ABORT, 'invalid consumable stock unit');
      END;

      CREATE TRIGGER IF NOT EXISTS consumable_events_type_insert
      BEFORE INSERT ON consumable_events
      WHEN NEW.event_type NOT IN ('replacement', 'stock_add', 'stock_set')
      BEGIN
        SELECT RAISE(ABORT, 'invalid consumable event type');
      END;

      CREATE TRIGGER IF NOT EXISTS consumable_events_type_update
      BEFORE UPDATE OF event_type ON consumable_events
      WHEN NEW.event_type NOT IN ('replacement', 'stock_add', 'stock_set')
      BEGIN
        SELECT RAISE(ABORT, 'invalid consumable event type');
      END;
    `);
  },
};
