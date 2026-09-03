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
        typeof(NEW.stock_quantity) != 'integer' OR NEW.stock_quantity < 0 OR
        NEW.stock_quantity > 9007199254740991
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid consumable stock');
      END;

      CREATE TRIGGER IF NOT EXISTS consumables_stock_non_negative_update
      BEFORE UPDATE OF stock_quantity ON consumables
      WHEN NEW.stock_quantity IS NOT NULL AND (
        typeof(NEW.stock_quantity) != 'integer' OR NEW.stock_quantity < 0 OR
        NEW.stock_quantity > 9007199254740991
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

      CREATE TRIGGER IF NOT EXISTS consumables_stock_state_insert
      BEFORE INSERT ON consumables
      WHEN (NEW.stock_quantity IS NULL) != (NEW.stock_unit IS NULL)
      BEGIN
        SELECT RAISE(ABORT, 'consumable stock and unit must be set together');
      END;

      CREATE TRIGGER IF NOT EXISTS consumables_stock_state_update
      BEFORE UPDATE OF stock_quantity, stock_unit ON consumables
      WHEN (NEW.stock_quantity IS NULL) != (NEW.stock_unit IS NULL)
      BEGIN
        SELECT RAISE(ABORT, 'consumable stock and unit must be set together');
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

      CREATE TRIGGER IF NOT EXISTS consumable_events_quantity_insert
      BEFORE INSERT ON consumable_events
      WHEN NOT (
        (NEW.event_type = 'replacement' AND (
          (NEW.stock_before IS NULL AND NEW.stock_after IS NULL AND NEW.quantity_delta IS NULL) OR
          (typeof(NEW.stock_before) = 'integer' AND typeof(NEW.stock_after) = 'integer' AND
           typeof(NEW.quantity_delta) = 'integer' AND NEW.stock_before >= 0 AND
           NEW.stock_after >= 0 AND NEW.stock_before <= 9007199254740991 AND
           NEW.stock_after <= 9007199254740991 AND
           NEW.quantity_delta = NEW.stock_after - NEW.stock_before AND
           (NEW.stock_after = NEW.stock_before OR NEW.stock_after = NEW.stock_before - 1))
        )) OR
        (NEW.event_type = 'stock_add' AND typeof(NEW.stock_before) = 'integer' AND
         typeof(NEW.stock_after) = 'integer' AND typeof(NEW.quantity_delta) = 'integer' AND
         NEW.stock_before >= 0 AND NEW.stock_after <= 9007199254740991 AND
         NEW.quantity_delta > 0 AND NEW.stock_after = NEW.stock_before + NEW.quantity_delta) OR
        (NEW.event_type = 'stock_set' AND typeof(NEW.stock_after) = 'integer' AND
         NEW.stock_after >= 0 AND NEW.stock_after <= 9007199254740991 AND (
           (NEW.stock_before IS NULL AND NEW.quantity_delta IS NULL) OR
           (typeof(NEW.stock_before) = 'integer' AND typeof(NEW.quantity_delta) = 'integer' AND
            NEW.stock_before >= 0 AND NEW.stock_before <= 9007199254740991 AND
            NEW.quantity_delta = NEW.stock_after - NEW.stock_before)
         ))
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid consumable event quantity state');
      END;

      CREATE TRIGGER IF NOT EXISTS consumable_events_quantity_update
      BEFORE UPDATE OF event_type, quantity_delta, stock_before, stock_after ON consumable_events
      WHEN NOT (
        (NEW.event_type = 'replacement' AND (
          (NEW.stock_before IS NULL AND NEW.stock_after IS NULL AND NEW.quantity_delta IS NULL) OR
          (typeof(NEW.stock_before) = 'integer' AND typeof(NEW.stock_after) = 'integer' AND
           typeof(NEW.quantity_delta) = 'integer' AND NEW.stock_before >= 0 AND
           NEW.stock_after >= 0 AND NEW.stock_before <= 9007199254740991 AND
           NEW.stock_after <= 9007199254740991 AND
           NEW.quantity_delta = NEW.stock_after - NEW.stock_before AND
           (NEW.stock_after = NEW.stock_before OR NEW.stock_after = NEW.stock_before - 1))
        )) OR
        (NEW.event_type = 'stock_add' AND typeof(NEW.stock_before) = 'integer' AND
         typeof(NEW.stock_after) = 'integer' AND typeof(NEW.quantity_delta) = 'integer' AND
         NEW.stock_before >= 0 AND NEW.stock_after <= 9007199254740991 AND
         NEW.quantity_delta > 0 AND NEW.stock_after = NEW.stock_before + NEW.quantity_delta) OR
        (NEW.event_type = 'stock_set' AND typeof(NEW.stock_after) = 'integer' AND
         NEW.stock_after >= 0 AND NEW.stock_after <= 9007199254740991 AND (
           (NEW.stock_before IS NULL AND NEW.quantity_delta IS NULL) OR
           (typeof(NEW.stock_before) = 'integer' AND typeof(NEW.quantity_delta) = 'integer' AND
            NEW.stock_before >= 0 AND NEW.stock_before <= 9007199254740991 AND
            NEW.quantity_delta = NEW.stock_after - NEW.stock_before)
         ))
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid consumable event quantity state');
      END;
    `);
  },
};
