/**
 * Domain types for «Мой дом» Phase 1 data model.
 */

export type DateOnly = string;
export type UtcInstant = string;

export type PropertyType = 'home' | 'apartment' | 'cottage' | 'other';
export type ItemStatus = 'active' | 'archived';
export type DocumentType =
  | 'receipt'
  | 'warranty'
  | 'manual'
  | 'contract'
  | 'label'
  | 'other';
export type ReminderType = 'warranty' | 'maintenance' | 'consumable' | 'custom';
export type IntervalUnit = 'day' | 'week' | 'month' | 'year';
export type ConsumableStockUnit = 'pcs' | 'set' | 'pack';
export type ConsumableEventType = 'replacement' | 'stock_add' | 'stock_set';

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  note: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface Location {
  id: string;
  propertyId: string;
  parentLocationId: string | null;
  name: string;
  sortOrder: number;
  note: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface Item {
  id: string;
  propertyId: string;
  locationId: string | null;
  category: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  note: string | null;
  /** Relative managed path, e.g. photos/uuid.jpg — not an absolute device URI. */
  primaryPhotoPath: string | null;
  status: ItemStatus;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface Purchase {
  id: string;
  itemId: string;
  purchaseDate: DateOnly | null;
  seller: string | null;
  priceMinor: number | null;
  currency: string;
  note: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface Warranty {
  id: string;
  itemId: string;
  type: string;
  provider: string | null;
  startDate: DateOnly | null;
  endDate: DateOnly | null;
  durationMonths: number | null;
  note: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface Document {
  id: string;
  itemId: string;
  type: DocumentType;
  title: string;
  /** Relative managed path under documentDirectory/managed/. */
  filePath: string;
  mimeType: string | null;
  originalName: string | null;
  fileSize: number | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface MaintenanceRule {
  id: string;
  itemId: string;
  title: string;
  intervalValue: number | null;
  intervalUnit: IntervalUnit | null;
  lastCompletedDate: DateOnly | null;
  nextDueDate: DateOnly | null;
  enabled: boolean;
  note: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface MaintenanceEvent {
  id: string;
  itemId: string;
  maintenanceRuleId: string | null;
  performedAt: UtcInstant;
  costMinor: number | null;
  note: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface Consumable {
  id: string;
  itemId: string;
  name: string;
  modelOrArticle: string | null;
  manufacturer: string | null;
  replacementIntervalValue: number | null;
  replacementIntervalUnit: IntervalUnit | null;
  lastReplacedDate: DateOnly | null;
  nextDueDate: DateOnly | null;
  /** NULL = stock not tracked; 0 = tracked and empty. */
  stockQuantity: number | null;
  stockUnit: ConsumableStockUnit | null;
  priceMinor: number | null;
  note: string | null;
  active: boolean;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface ConsumableEvent {
  id: string;
  itemId: string;
  consumableId: string;
  eventType: ConsumableEventType;
  /** Calendar moment of the event (noon-UTC DateOnly storage). */
  replacedAt: UtcInstant;
  quantityDelta: number | null;
  stockBefore: number | null;
  stockAfter: number | null;
  costMinor: number | null;
  note: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface Reminder {
  id: string;
  itemId: string;
  reminderType: ReminderType;
  warrantyId: string | null;
  maintenanceRuleId: string | null;
  consumableId: string | null;
  dueAt: UtcInstant;
  notificationId: string | null;
  enabled: boolean;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface AppSetting {
  key: string;
  value: string;
}
