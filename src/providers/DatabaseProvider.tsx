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
import { DocumentRepository } from '@/src/repositories/documentRepository';
import { ReminderRepository } from '@/src/repositories/reminderRepository';
import { PurchaseRepository } from '@/src/repositories/purchaseRepository';
import { WarrantyRepository } from '@/src/repositories/warrantyRepository';
import { DocumentService } from '@/src/services/documentService';
import { ItemDeletionService } from '@/src/services/itemDeletionService';
import { InventoryService } from '@/src/services/inventoryService';
import { ItemPhotoService } from '@/src/services/itemPhotoService';
import {
  ExpoNotificationAdapter,
  type NotificationAdapter,
} from '@/src/services/notificationAdapter';
import { WarrantyService } from '@/src/services/warrantyService';

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
  inventory: InventoryService | null;
  itemPhotos: ItemPhotoService | null;
  purchases: PurchaseRepository | null;
  warranties: WarrantyRepository | null;
  documents: DocumentRepository | null;
  reminders: ReminderRepository | null;
  warrantyService: WarrantyService | null;
  documentService: DocumentService | null;
  notifications: NotificationAdapter | null;
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
        inventory: null,
        itemPhotos: null,
        purchases: null,
        warranties: null,
        documents: null,
        reminders: null,
        warrantyService: null,
        documentService: null,
        notifications: null,
      };
    }

    const notifications = new ExpoNotificationAdapter();

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
      inventory: new InventoryService(db),
      itemPhotos: new ItemPhotoService(db),
      purchases: new PurchaseRepository(db),
      warranties: new WarrantyRepository(db),
      documents: new DocumentRepository(db),
      reminders: new ReminderRepository(db),
      warrantyService: new WarrantyService(db, notifications),
      documentService: new DocumentService(db),
      notifications,
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
