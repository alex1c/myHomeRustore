/**
 * Pure Smart Today attention ranking, slicing, and summary helpers.
 */

import type { WarrantyAttentionRow } from '@/src/repositories/warrantyRepository';
import type { MaintenanceListRow } from '@/src/repositories/maintenanceRepository';
import type { ConsumableListRow } from '@/src/repositories/consumableRepository';
import {
  TODAY_ATTENTION_PREVIEW_LIMIT,
  TODAY_UPCOMING_LIMIT,
  TODAY_WARRANTY_WARNING_DAYS,
  type TodayAttentionId,
  type TodayAttentionItem,
  type TodayAttentionSeverity,
} from '@/src/domain/today';
import { computeConsumableAttentionKind } from '@/src/utils/consumableDate';
import { presentConsumableStatus } from '@/src/utils/consumablePresentation';
import { presentMaintenanceStatus } from '@/src/utils/maintenancePresentation';
import { warrantyTypeLabel } from '@/src/utils/warrantyPresentation';
import { toLocalDateOnly } from '@/src/utils/datetime';

function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

/**
 * Ranking buckets (lower = higher priority).
 * Secondary key within a bucket is daysUntil (sooner / more overdue first).
 */
const BUCKET = {
  maintenanceOverdue: 0,
  consumableOverdue: 1,
  consumableStockOut: 2,
  dueToday: 3,
  warrantyUrgent: 4,
  nearUpcoming: 5,
  warrantyUpcoming: 6,
  farUpcoming: 7,
} as const;

function scoreFromBucket(bucket: number, daysUntil: number | null): number {
  // Normalize days so more overdue (more negative) sorts earlier within a bucket.
  const dayKey = daysUntil == null ? 5000 : daysUntil + 1000;
  return bucket * 10_000 + dayKey;
}

function warrantyStatusText(daysUntilEnd: number): string {
  if (daysUntilEnd < 0) {
    const days = Math.abs(daysUntilEnd);
    return `Истекла ${days} ${pluralDays(days)} назад`;
  }
  if (daysUntilEnd === 0) return 'Заканчивается сегодня';
  if (daysUntilEnd === 1) return 'Заканчивается завтра';
  return `Заканчивается через ${daysUntilEnd} ${pluralDays(daysUntilEnd)}`;
}

function mapWarranty(
  row: WarrantyAttentionRow,
): TodayAttentionItem {
  const days = row.daysUntilEnd;
  const severity: TodayAttentionSeverity =
    days <= TODAY_WARRANTY_WARNING_DAYS ? 'warning' : 'upcoming';
  const bucket =
    days <= TODAY_WARRANTY_WARNING_DAYS
      ? BUCKET.warrantyUrgent
      : BUCKET.warrantyUpcoming;

  return {
    id: `warranty:${row.warranty.id}`,
    kind: 'warranty',
    severity,
    score: scoreFromBucket(bucket, days),
    daysUntil: days,
    title: row.warranty.provider
      ? `${warrantyTypeLabel(row.warranty.type)} · ${row.warranty.provider}`
      : warrantyTypeLabel(row.warranty.type),
    subtitle: row.itemName,
    statusText: warrantyStatusText(days),
    entityId: row.warranty.id,
    quickAction: null,
  };
}

function mapMaintenance(
  row: MaintenanceListRow,
  referenceDate: string,
): TodayAttentionItem {
  // Attention rows always have a due date; fall back to 0 for typing safety.
  const days = row.daysUntilDue ?? 0;
  const status = presentMaintenanceStatus(row.rule.nextDueDate, referenceDate);
  let bucket: number;
  let severity: TodayAttentionSeverity;

  if (days < 0) {
    bucket = BUCKET.maintenanceOverdue;
    severity = 'critical';
  } else if (days === 0) {
    bucket = BUCKET.dueToday;
    severity = 'critical';
  } else if (days <= 7) {
    bucket = BUCKET.nearUpcoming;
    severity = 'upcoming';
  } else {
    bucket = BUCKET.farUpcoming;
    severity = 'upcoming';
  }

  return {
    id: `maintenance:${row.rule.id}`,
    kind: 'maintenance',
    severity,
    score: scoreFromBucket(bucket, days),
    daysUntil: days,
    title: row.rule.title,
    subtitle: row.itemName,
    statusText: status.label,
    entityId: row.rule.id,
    quickAction: 'mark_done',
  };
}

function mapConsumable(
  row: ConsumableListRow,
  referenceDate: string,
): TodayAttentionItem {
  const stock = row.consumable.stockQuantity;
  const days = row.daysUntilDue;
  const kind = computeConsumableAttentionKind({
    stockQuantity: stock,
    nextDueDate: row.consumable.nextDueDate,
    referenceDate,
  });
  const presented = presentConsumableStatus(row.consumable, referenceDate);

  // Combined status when stock-out coincides with overdue/soon due.
  const statusText =
    presented.secondary != null
      ? `${presented.primary} · ${presented.secondary}`
      : presented.primary;

  const isOverdue = days != null && days < 0;
  const isToday = days === 0;
  const isStockOut = stock === 0;

  let bucket: number;
  let severity: TodayAttentionSeverity;

  if (isOverdue) {
    // Stock-out + overdue still ranks in the overdue consumable bucket (one card).
    bucket = BUCKET.consumableOverdue;
    severity = 'critical';
  } else if (isStockOut) {
    bucket = BUCKET.consumableStockOut;
    severity = 'critical';
  } else if (isToday || kind === 'today') {
    bucket = BUCKET.dueToday;
    severity = 'critical';
  } else if (days != null && days <= 7) {
    bucket = BUCKET.nearUpcoming;
    severity = 'upcoming';
  } else {
    bucket = BUCKET.farUpcoming;
    severity = 'upcoming';
  }

  return {
    id: `consumable:${row.consumable.id}`,
    kind: 'consumable',
    severity,
    score: scoreFromBucket(bucket, days),
    daysUntil: days,
    title: row.consumable.name,
    subtitle: row.itemName,
    statusText,
    entityId: row.consumable.id,
    quickAction: 'mark_replaced',
  };
}

export interface AttentionSourceRows {
  warranties: WarrantyAttentionRow[];
  maintenance: MaintenanceListRow[];
  consumables: ConsumableListRow[];
}

/**
 * Build a single ranked attention list from repository attention rows.
 * Each entity appears at most once (consumable stock+due is already one row).
 */
export function buildTodayAttention(
  sources: AttentionSourceRows,
  referenceDate: string = toLocalDateOnly(),
): TodayAttentionItem[] {
  const items: TodayAttentionItem[] = [
    ...sources.warranties.map(mapWarranty),
    ...sources.maintenance.map((row) => mapMaintenance(row, referenceDate)),
    ...sources.consumables.map((row) => mapConsumable(row, referenceDate)),
  ];

  items.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.id.localeCompare(b.id);
  });

  return items;
}

/** First N attention cards for the compact Today section. */
export function takeAttentionPreview(
  attention: TodayAttentionItem[],
  limit: number = TODAY_ATTENTION_PREVIEW_LIMIT,
): TodayAttentionItem[] {
  return attention.slice(0, Math.max(0, limit));
}

/**
 * Soft upcoming cards that are not already visible in the attention preview.
 * Uses severity === 'upcoming' so critical/warning stay exclusive to top section.
 */
export function buildUpcomingAttention(
  attention: TodayAttentionItem[],
  options?: {
    previewLimit?: number;
    upcomingLimit?: number;
    /** When true, exclude against the full expanded list (nothing left for upcoming). */
    showAllAttention?: boolean;
  },
): TodayAttentionItem[] {
  const previewLimit = options?.previewLimit ?? TODAY_ATTENTION_PREVIEW_LIMIT;
  const upcomingLimit = options?.upcomingLimit ?? TODAY_UPCOMING_LIMIT;
  const visible = options?.showAllAttention
    ? attention
    : takeAttentionPreview(attention, previewLimit);
  const visibleIds = new Set<TodayAttentionId>(visible.map((item) => item.id));

  return attention
    .filter((item) => item.severity === 'upcoming' && !visibleIds.has(item.id))
    .slice(0, upcomingLimit);
}

export interface TodaySummaryBreakdown {
  overdue: number;
  warranties: number;
  maintenance: number;
  consumables: number;
}

export function summarizeAttention(
  attention: TodayAttentionItem[],
): TodaySummaryBreakdown {
  let overdue = 0;
  let warranties = 0;
  let maintenance = 0;
  let consumables = 0;

  for (const item of attention) {
    if (item.kind === 'warranty') warranties += 1;
    if (item.kind === 'maintenance') maintenance += 1;
    if (item.kind === 'consumable') consumables += 1;
    if (item.daysUntil != null && item.daysUntil < 0) overdue += 1;
    // Stock-out without a due date still counts as needing action, not "overdue".
  }

  return { overdue, warranties, maintenance, consumables };
}
