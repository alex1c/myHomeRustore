/**
 * Inventory list/detail types for Phase 2 UI.
 */

import type { Item, Purchase } from '@/src/domain/types';

export type ItemSortMode = 'recent' | 'name' | 'price';

export type LocationFilter =
  | { type: 'all' }
  | { type: 'none' }
  | { type: 'location'; locationId: string };

export type CategoryFilter =
  | { type: 'all' }
  | { type: 'category'; category: string };

export interface InventoryFilters {
  search: string;
  location: LocationFilter;
  category: CategoryFilter;
  sort: ItemSortMode;
}

export const DEFAULT_INVENTORY_FILTERS: InventoryFilters = {
  search: '',
  location: { type: 'all' },
  category: { type: 'all' },
  sort: 'recent',
};

export interface ItemListRow {
  item: Item;
  locationName: string | null;
  priceMinor: number | null;
}

export interface ItemDetail {
  item: Item;
  purchase: Purchase | null;
  locationName: string | null;
}

export interface ItemFormValues {
  name: string;
  category: string;
  customCategory: string;
  locationId: string | null;
  brand: string;
  model: string;
  serialNumber: string;
  note: string;
  purchaseDate: string | null;
  seller: string;
  priceText: string;
}

export const EMPTY_ITEM_FORM: ItemFormValues = {
  name: '',
  category: 'Другое',
  customCategory: '',
  locationId: null,
  brand: '',
  model: '',
  serialNumber: '',
  note: '',
  purchaseDate: null,
  seller: '',
  priceText: '',
};

export interface PendingPhoto {
  /** Local picker URI before managed import. */
  localUri: string;
  mimeType: string | null;
  fileName: string | null;
}
