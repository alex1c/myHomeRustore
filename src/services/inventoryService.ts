/**
 * Inventory orchestration — transactional item + purchase operations.
 */

import { DEFAULT_CATEGORY } from '@/src/domain/categories';
import { AppError } from '@/src/domain/errors';
import type {
  InventoryFilters,
  ItemDetail,
  ItemFormValues,
  ItemListRow,
} from '@/src/domain/inventory';
import type { Item } from '@/src/domain/types';
import type { SqlDatabase } from '@/src/db/types';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { LocationRepository } from '@/src/repositories/locationRepository';
import { PurchaseRepository } from '@/src/repositories/purchaseRepository';
import { Analytics } from '@/src/services/AnalyticsService';
import { parseRubToMinor } from '@/src/utils/money';

function resolveCategory(values: ItemFormValues): string {
  if (values.category === 'Другое' && values.customCategory.trim()) {
    return values.customCategory.trim();
  }
  return values.category.trim() || DEFAULT_CATEGORY;
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePrice(priceText: string): number | null {
  const trimmed = priceText.trim();
  if (!trimmed) {
    return null;
  }
  const minor = parseRubToMinor(trimmed);
  if (minor == null) {
    throw new AppError('Некорректная стоимость');
  }
  return minor;
}

export class InventoryService {
  private readonly items: ItemRepository;
  private readonly purchases: PurchaseRepository;
  private readonly locations: LocationRepository;
  private readonly db: SqlDatabase;

  constructor(db: SqlDatabase) {
    this.db = db;
    this.items = new ItemRepository(db);
    this.purchases = new PurchaseRepository(db);
    this.locations = new LocationRepository(db);
  }

  list(propertyId: string, filters: InventoryFilters): ItemListRow[] {
    return this.items.listFiltered(propertyId, filters);
  }

  count(propertyId: string): number {
    return this.items.countActive(propertyId);
  }

  listRecent(propertyId: string, limit = 5): ItemListRow[] {
    return this.items.listRecent(propertyId, limit);
  }

  getDetail(itemId: string): ItemDetail | null {
    const item = this.items.getById(itemId);
    if (!item) {
      return null;
    }
    const purchase = this.purchases.getByItemId(itemId);
    const location = item.locationId
      ? this.locations.getById(item.locationId)
      : null;
    return {
      item,
      purchase,
      locationName: location?.name ?? null,
    };
  }

  createItem(
    propertyId: string,
    values: ItemFormValues,
    photoPath?: string | null,
  ): Item {
    const name = values.name.trim();
    if (!name) {
      throw new AppError('Введите название вещи');
    }

    return this.db.withTransaction(() => {
      const item = this.items.createItem({
        propertyId,
        name,
        category: resolveCategory(values),
        locationId: values.locationId,
        brand: optionalText(values.brand),
        model: optionalText(values.model),
        serialNumber: optionalText(values.serialNumber),
        note: optionalText(values.note),
        primaryPhotoPath: photoPath ?? null,
      });

      this.purchases.upsertForItem({
        itemId: item.id,
        purchaseDate: values.purchaseDate,
        seller: optionalText(values.seller),
        priceMinor: values.priceText.trim() ? parsePrice(values.priceText) : null,
      });

      // Privacy-safe: category enum/label only — never name, price, or notes.
      Analytics.itemCreated(item.category);
      return item;
    });
  }

  updateItem(itemId: string, values: ItemFormValues): Item {
    const name = values.name.trim();
    if (!name) {
      throw new AppError('Введите название вещи');
    }

    return this.db.withTransaction(() => {
      const item = this.items.updateItem(itemId, {
        name,
        category: resolveCategory(values),
        locationId: values.locationId,
        brand: optionalText(values.brand),
        model: optionalText(values.model),
        serialNumber: optionalText(values.serialNumber),
        note: optionalText(values.note),
      });

      this.purchases.upsertForItem({
        itemId,
        purchaseDate: values.purchaseDate,
        seller: optionalText(values.seller),
        priceMinor: values.priceText.trim() ? parsePrice(values.priceText) : null,
      });

      return item;
    });
  }

  listDistinctCategories(propertyId: string): string[] {
    const rows = this.db.getAll<{ category: string }>(
      `SELECT DISTINCT category FROM items
       WHERE property_id = ? AND status = 'active'
       ORDER BY category COLLATE NOCASE`,
      [propertyId],
    );
    return rows.map((r) => r.category);
  }
}
