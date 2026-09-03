/**
 * Smart Today aggregation — attention, upcoming, recent activity, home counts.
 * UI must call this instead of composing repository queries itself.
 */

import type { SqlDatabase } from '@/src/db/types';
import {
  TODAY_ATTENTION_PREVIEW_LIMIT,
  TODAY_CONSUMABLE_AHEAD_DAYS,
  TODAY_MAINTENANCE_AHEAD_DAYS,
  TODAY_RECENT_LIMIT,
  TODAY_WARRANTY_WINDOW_DAYS,
  type TodayActivityItem,
  type TodayActivityKind,
  type TodayHomeCounts,
  type TodayOverview,
} from '@/src/domain/today';
import { DOCUMENT_TYPE_LABELS } from '@/src/domain/documents';
import type { DocumentType } from '@/src/domain/types';
import { ConsumableRepository } from '@/src/repositories/consumableRepository';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { LocationRepository } from '@/src/repositories/locationRepository';
import { MaintenanceRepository } from '@/src/repositories/maintenanceRepository';
import { WarrantyRepository } from '@/src/repositories/warrantyRepository';
import {
  buildTodayAttention,
  buildUpcomingAttention,
} from '@/src/utils/todayAttention';
import { toLocalDateOnly } from '@/src/utils/datetime';

type ActivityRow = {
  kind: TodayActivityKind;
  entity_id: string;
  title: string;
  /** Document type discriminator; empty for non-document rows. */
  doc_type: string;
  item_id: string;
  item_name: string;
  route_id: string;
  occurred_at: string;
};

function documentLabel(type: string, title: string): string {
  const typeLabel =
    DOCUMENT_TYPE_LABELS[type as DocumentType] ?? 'Документ';
  // Prefer a short type label when the stored title matches the default.
  if (!title.trim() || title.trim() === typeLabel) {
    return `Добавлен ${typeLabel.toLowerCase()}`;
  }
  return `Добавлен «${title.trim()}»`;
}

function mapActivity(row: ActivityRow): TodayActivityItem {
  switch (row.kind) {
    case 'item_added':
      return {
        id: `item_added:${row.entity_id}`,
        kind: row.kind,
        title: `Добавлен «${row.title}»`,
        subtitle: null,
        occurredAt: row.occurred_at,
        route: { type: 'item', id: row.item_id },
      };
    case 'document_added':
      return {
        id: `document_added:${row.entity_id}`,
        kind: row.kind,
        title: documentLabel(row.doc_type, row.title),
        subtitle: row.item_name,
        occurredAt: row.occurred_at,
        route: { type: 'document', id: row.entity_id },
      };
    case 'maintenance_done':
      return {
        id: `maintenance_done:${row.entity_id}`,
        kind: row.kind,
        title: `Выполнено «${row.title}»`,
        subtitle: row.item_name,
        occurredAt: row.occurred_at,
        route: { type: 'maintenance', id: row.route_id },
      };
    case 'consumable_replaced':
      return {
        id: `consumable_replaced:${row.entity_id}`,
        kind: row.kind,
        title: `Заменён «${row.title}»`,
        subtitle: row.item_name,
        occurredAt: row.occurred_at,
        route: { type: 'consumable', id: row.route_id },
      };
  }
}

export class TodayService {
  private readonly warranties: WarrantyRepository;
  private readonly maintenance: MaintenanceRepository;
  private readonly consumables: ConsumableRepository;
  private readonly items: ItemRepository;
  private readonly locations: LocationRepository;

  constructor(private readonly db: SqlDatabase) {
    this.warranties = new WarrantyRepository(db);
    this.maintenance = new MaintenanceRepository(db);
    this.consumables = new ConsumableRepository(db);
    this.items = new ItemRepository(db);
    this.locations = new LocationRepository(db);
  }

  /** Aggregate home overview for the Today tab. */
  getOverview(
    propertyId: string,
    referenceDate: string = toLocalDateOnly(),
  ): TodayOverview {
    const warrantyRows = this.warranties.listAttentionForProperty(
      propertyId,
      TODAY_WARRANTY_WINDOW_DAYS,
      TODAY_WARRANTY_WINDOW_DAYS,
      referenceDate,
    );
    const maintenanceRows = this.maintenance.listAttentionForProperty(
      propertyId,
      TODAY_MAINTENANCE_AHEAD_DAYS,
      referenceDate,
    );
    const consumableRows = this.consumables.listAttentionForProperty(
      propertyId,
      TODAY_CONSUMABLE_AHEAD_DAYS,
      referenceDate,
    );

    const attention = buildTodayAttention(
      {
        warranties: warrantyRows,
        maintenance: maintenanceRows,
        consumables: consumableRows,
      },
      referenceDate,
    );

    const upcoming = buildUpcomingAttention(attention, {
      previewLimit: TODAY_ATTENTION_PREVIEW_LIMIT,
      showAllAttention: false,
    });

    return {
      referenceDate,
      attention,
      upcoming,
      recent: this.listRecentActivity(propertyId, TODAY_RECENT_LIMIT),
      counts: this.getHomeCounts(propertyId),
      attentionCount: attention.length,
    };
  }

  getHomeCounts(propertyId: string): TodayHomeCounts {
    const documents = this.db.getFirst<{ c: number }>(
      `SELECT COUNT(*) AS c
       FROM documents d
       JOIN items i ON i.id = d.item_id
       WHERE i.property_id = ? AND i.status = 'active'`,
      [propertyId],
    );
    const rules = this.db.getFirst<{ c: number }>(
      `SELECT COUNT(*) AS c
       FROM maintenance_rules r
       JOIN items i ON i.id = r.item_id
       WHERE i.property_id = ? AND i.status = 'active' AND r.enabled = 1`,
      [propertyId],
    );

    return {
      items: this.items.countActive(propertyId),
      locations: this.locations.countByProperty(propertyId),
      documents: documents?.c ?? 0,
      activeMaintenanceRules: rules?.c ?? 0,
    };
  }

  /**
   * Best-effort recent activity from existing entity timestamps.
   * No audit table — replacement events only for consumables.
   */
  listRecentActivity(
    propertyId: string,
    limit: number = TODAY_RECENT_LIMIT,
  ): TodayActivityItem[] {
    const safeLimit = Math.max(1, Math.min(limit, 20));
    const rows = this.db.getAll<ActivityRow>(
      `
      SELECT * FROM (
        SELECT
          'item_added' AS kind,
          i.id AS entity_id,
          i.name AS title,
          '' AS doc_type,
          i.id AS item_id,
          i.name AS item_name,
          i.id AS route_id,
          i.created_at AS occurred_at
        FROM items i
        WHERE i.property_id = ? AND i.status = 'active'

        UNION ALL

        SELECT
          'document_added' AS kind,
          d.id AS entity_id,
          d.title AS title,
          d.type AS doc_type,
          i.id AS item_id,
          i.name AS item_name,
          d.id AS route_id,
          d.created_at AS occurred_at
        FROM documents d
        JOIN items i ON i.id = d.item_id
        WHERE i.property_id = ? AND i.status = 'active'

        UNION ALL

        SELECT
          'maintenance_done' AS kind,
          e.id AS entity_id,
          r.title AS title,
          '' AS doc_type,
          i.id AS item_id,
          i.name AS item_name,
          r.id AS route_id,
          e.created_at AS occurred_at
        FROM maintenance_events e
        JOIN maintenance_rules r ON r.id = e.maintenance_rule_id
        JOIN items i ON i.id = e.item_id
        WHERE i.property_id = ? AND i.status = 'active'

        UNION ALL

        SELECT
          'consumable_replaced' AS kind,
          e.id AS entity_id,
          c.name AS title,
          '' AS doc_type,
          i.id AS item_id,
          i.name AS item_name,
          c.id AS route_id,
          e.created_at AS occurred_at
        FROM consumable_events e
        JOIN consumables c ON c.id = e.consumable_id
        JOIN items i ON i.id = e.item_id
        WHERE i.property_id = ?
          AND i.status = 'active'
          AND e.event_type = 'replacement'
      )
      ORDER BY occurred_at DESC, kind ASC, entity_id ASC
      LIMIT ?
      `,
      [propertyId, propertyId, propertyId, propertyId, safeLimit],
    );

    return rows.map(mapActivity);
  }
}
