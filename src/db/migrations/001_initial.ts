/**
 * Migration 001 — initial «Мой дом» schema (version 1).
 * All file references store relative managed paths, not absolute URIs.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration001Initial: Migration = {
  version: 1,
  name: '001_initial',

  up(db: SqlDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'home',
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY NOT NULL,
        property_id TEXT NOT NULL,
        parent_location_id TEXT,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_location_id) REFERENCES locations(id) ON DELETE SET NULL,
        UNIQUE (id, property_id)
      );

      CREATE INDEX IF NOT EXISTS idx_locations_property
        ON locations(property_id, sort_order);

      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY NOT NULL,
        property_id TEXT NOT NULL,
        location_id TEXT,
        category TEXT NOT NULL DEFAULT 'other',
        name TEXT NOT NULL,
        brand TEXT,
        model TEXT,
        serial_number TEXT,
        note TEXT,
        primary_photo_path TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id, property_id) REFERENCES locations(id, property_id),
        UNIQUE (id, property_id)
      );

      CREATE INDEX IF NOT EXISTS idx_items_property
        ON items(property_id, status);

      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY NOT NULL,
        item_id TEXT NOT NULL,
        purchase_date TEXT,
        seller TEXT,
        price_minor INTEGER,
        currency TEXT NOT NULL DEFAULT 'RUB',
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        UNIQUE (id, item_id)
      );

      CREATE TABLE IF NOT EXISTS warranties (
        id TEXT PRIMARY KEY NOT NULL,
        item_id TEXT NOT NULL,
        type TEXT NOT NULL,
        provider TEXT,
        start_date TEXT,
        end_date TEXT,
        duration_months INTEGER,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        UNIQUE (id, item_id)
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        item_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT,
        original_name TEXT,
        file_size INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        UNIQUE (id, item_id)
      );

      CREATE TABLE IF NOT EXISTS maintenance_rules (
        id TEXT PRIMARY KEY NOT NULL,
        item_id TEXT NOT NULL,
        title TEXT NOT NULL,
        interval_value INTEGER,
        interval_unit TEXT,
        last_completed_date TEXT,
        next_due_date TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        UNIQUE (id, item_id)
      );

      CREATE TABLE IF NOT EXISTS maintenance_events (
        id TEXT PRIMARY KEY NOT NULL,
        item_id TEXT NOT NULL,
        maintenance_rule_id TEXT,
        performed_at TEXT NOT NULL,
        cost_minor INTEGER,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (maintenance_rule_id, item_id)
          REFERENCES maintenance_rules(id, item_id) ON DELETE SET NULL,
        UNIQUE (id, item_id)
      );

      CREATE TABLE IF NOT EXISTS consumables (
        id TEXT PRIMARY KEY NOT NULL,
        item_id TEXT NOT NULL,
        name TEXT NOT NULL,
        model_or_article TEXT,
        replacement_interval_value INTEGER,
        replacement_interval_unit TEXT,
        last_replaced_date TEXT,
        next_due_date TEXT,
        price_minor INTEGER,
        note TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        UNIQUE (id, item_id)
      );

      CREATE TABLE IF NOT EXISTS consumable_events (
        id TEXT PRIMARY KEY NOT NULL,
        item_id TEXT NOT NULL,
        consumable_id TEXT NOT NULL,
        replaced_at TEXT NOT NULL,
        cost_minor INTEGER,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (consumable_id, item_id)
          REFERENCES consumables(id, item_id) ON DELETE CASCADE,
        UNIQUE (id, item_id)
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY NOT NULL,
        item_id TEXT NOT NULL,
        reminder_type TEXT NOT NULL,
        warranty_id TEXT,
        maintenance_rule_id TEXT,
        consumable_id TEXT,
        due_at TEXT NOT NULL,
        notification_id TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (warranty_id, item_id)
          REFERENCES warranties(id, item_id) ON DELETE CASCADE,
        FOREIGN KEY (maintenance_rule_id, item_id)
          REFERENCES maintenance_rules(id, item_id) ON DELETE CASCADE,
        FOREIGN KEY (consumable_id, item_id)
          REFERENCES consumables(id, item_id) ON DELETE CASCADE,
        UNIQUE (id, item_id)
      );

      CREATE INDEX IF NOT EXISTS idx_reminders_due
        ON reminders(enabled, due_at);

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);

    // Cross-property location guard for items.
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS items_location_same_property_insert
      BEFORE INSERT ON items
      WHEN NEW.location_id IS NOT NULL AND
        (SELECT property_id FROM locations WHERE id = NEW.location_id) != NEW.property_id
      BEGIN
        SELECT RAISE(ABORT, 'location belongs to another property');
      END;

      CREATE TRIGGER IF NOT EXISTS items_location_same_property_update
      BEFORE UPDATE OF location_id, property_id ON items
      WHEN NEW.location_id IS NOT NULL AND
        (SELECT property_id FROM locations WHERE id = NEW.location_id) != NEW.property_id
      BEGIN
        SELECT RAISE(ABORT, 'location belongs to another property');
      END;

      CREATE TRIGGER IF NOT EXISTS locations_parent_same_property_insert
      BEFORE INSERT ON locations
      WHEN NEW.parent_location_id IS NOT NULL AND
        (SELECT property_id FROM locations WHERE id = NEW.parent_location_id) != NEW.property_id
      BEGIN
        SELECT RAISE(ABORT, 'parent location belongs to another property');
      END;

      CREATE TRIGGER IF NOT EXISTS locations_parent_same_property_update
      BEFORE UPDATE OF parent_location_id, property_id ON locations
      WHEN NEW.parent_location_id IS NOT NULL AND
        (SELECT property_id FROM locations WHERE id = NEW.parent_location_id) != NEW.property_id
      BEGIN
        SELECT RAISE(ABORT, 'parent location belongs to another property');
      END;
    `);
  },
};
