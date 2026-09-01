/**
 * Provides initialized SQLite access and repositories to the UI tree.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { openAppDatabase } from '@/src/db/database';
import type { SqlDatabase } from '@/src/db/types';
import { formatErrorForDiagnostics } from '@/src/domain/errors';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { LocationRepository } from '@/src/repositories/locationRepository';
import { MaintenanceRepository } from '@/src/repositories/maintenanceRepository';
import { PropertyRepository } from '@/src/repositories/propertyRepository';
import { SettingsRepository } from '@/src/repositories/settingsRepository';
import { ItemDeletionService } from '@/src/services/itemDeletionService';

export type DatabaseContextValue = {
  ready: boolean;
  error: string | null;
  db: SqlDatabase | null;
  properties: PropertyRepository | null;
  locations: LocationRepository | null;
  items: ItemRepository | null;
  maintenance: MaintenanceRepository | null;
  settings: SettingsRepository | null;
  itemDeletion: ItemDeletionService | null;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SqlDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const opened = openAppDatabase();
        if (!cancelled) {
          setDb(opened);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatErrorForDiagnostics(err));
          setDb(null);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<DatabaseContextValue>(() => {
    if (!db) {
      return {
        ready: false,
        error,
        db: null,
        properties: null,
        locations: null,
        items: null,
        maintenance: null,
        settings: null,
        itemDeletion: null,
      };
    }

    return {
      ready: true,
      error: null,
      db,
      properties: new PropertyRepository(db),
      locations: new LocationRepository(db),
      items: new ItemRepository(db),
      maintenance: new MaintenanceRepository(db),
      settings: new SettingsRepository(db),
      itemDeletion: new ItemDeletionService(db),
    };
  }, [db, error]);

  return (
    <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return ctx;
}
