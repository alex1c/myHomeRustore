/**
 * Purchase repository — one primary purchase record per item in Phase 2.
 */

import { createEntityIdSync } from '@/src/domain/ids';
import type { DateOnly, Purchase } from '@/src/domain/types';
import type { SqlDatabase } from '@/src/db/types';
import { nowUtcInstant } from '@/src/utils/datetime';

type PurchaseRow = {
  id: string;
  item_id: string;
  purchase_date: string | null;
  seller: string | null;
  price_minor: number | null;
  currency: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    itemId: row.item_id,
    purchaseDate: row.purchase_date,
    seller: row.seller,
    priceMinor: row.price_minor,
    currency: row.currency,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PurchaseRepository {
  constructor(private readonly db: SqlDatabase) {}

  getByItemId(itemId: string): Purchase | null {
    const row = this.db.getFirst<PurchaseRow>(
      'SELECT * FROM purchases WHERE item_id = ? ORDER BY created_at DESC LIMIT 1',
      [itemId],
    );
    return row ? mapRow(row) : null;
  }

  upsertForItem(input: {
    itemId: string;
    purchaseDate?: DateOnly | null;
    seller?: string | null;
    priceMinor?: number | null;
    currency?: string;
    note?: string | null;
  }): Purchase | null {
    const hasData =
      input.purchaseDate != null ||
      (input.seller != null && input.seller.trim().length > 0) ||
      input.priceMinor != null;

    const existing = this.getByItemId(input.itemId);
    if (!hasData) {
      if (existing) {
        this.deleteByItemId(input.itemId);
      }
      return null;
    }

    const now = nowUtcInstant();
    if (existing) {
      this.db.run(
        `UPDATE purchases
         SET purchase_date = ?, seller = ?, price_minor = ?, currency = ?, note = ?, updated_at = ?
         WHERE id = ?`,
        [
          input.purchaseDate ?? null,
          input.seller?.trim() || null,
          input.priceMinor ?? null,
          input.currency ?? 'RUB',
          input.note ?? null,
          now,
          existing.id,
        ],
      );
      return this.getByItemId(input.itemId);
    }

    const id = createEntityIdSync();
    this.db.run(
      `INSERT INTO purchases
       (id, item_id, purchase_date, seller, price_minor, currency, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.itemId,
        input.purchaseDate ?? null,
        input.seller?.trim() || null,
        input.priceMinor ?? null,
        input.currency ?? 'RUB',
        input.note ?? null,
        now,
        now,
      ],
    );
    return this.getByItemId(input.itemId);
  }

  deleteByItemId(itemId: string): void {
    this.db.run('DELETE FROM purchases WHERE item_id = ?', [itemId]);
  }
}
