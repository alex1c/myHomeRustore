import type { Migration, SqlDatabase } from '../types';

/** Adds database-level guards for the Phase 3 warranty storage invariant. */
export const migration002WarrantyIntegrity: Migration = {
  version: 2,
  name: '002_warranty_integrity',
  up(db: SqlDatabase): void {
    const valid = `(
      (NEW.end_date IS NOT NULL AND NEW.duration_months IS NULL
        AND NEW.end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(NEW.end_date) = NEW.end_date
        AND (NEW.start_date IS NULL OR
          (NEW.start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
           AND date(NEW.start_date) = NEW.start_date AND NEW.start_date <= NEW.end_date)))
      OR
      (NEW.end_date IS NULL AND NEW.duration_months IS NOT NULL
        AND typeof(NEW.duration_months) = 'integer' AND NEW.duration_months > 0
        AND NEW.start_date IS NOT NULL
        AND NEW.start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(NEW.start_date) = NEW.start_date)
    )`;
    db.exec(`
      CREATE TRIGGER warranties_valid_insert BEFORE INSERT ON warranties
      WHEN NOT ${valid} BEGIN SELECT RAISE(ABORT, 'invalid warranty dates'); END;
      CREATE TRIGGER warranties_valid_update
      BEFORE UPDATE OF start_date, end_date, duration_months ON warranties
      WHEN NOT ${valid} BEGIN SELECT RAISE(ABORT, 'invalid warranty dates'); END;
    `);
  },
};
