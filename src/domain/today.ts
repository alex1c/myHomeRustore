/**
 * Smart Today domain — unified attention, activity, and home overview.
 */

/** Domain kinds that can appear in the attention feed. */
export type TodayAttentionKind = 'warranty' | 'maintenance' | 'consumable';

/**
 * Visual / ranking severity.
 * critical = overdue / stock-out / due today
 * warning = warranties expiring soon or recently expired
 * upcoming = near-future within attention windows
 */
export type TodayAttentionSeverity = 'critical' | 'warning' | 'upcoming';

/** Stable identity for dedupe / upcoming exclusion. */
export type TodayAttentionId =
  | `warranty:${string}`
  | `maintenance:${string}`
  | `consumable:${string}`;

export interface TodayAttentionItem {
  id: TodayAttentionId;
  kind: TodayAttentionKind;
  severity: TodayAttentionSeverity;
  /** Lower = higher priority. Deterministic ranking score. */
  score: number;
  /** Days until due/end; negative = overdue/expired. Null when N/A (stock-only). */
  daysUntil: number | null;
  title: string;
  subtitle: string;
  /** Combined status line shown on the card. */
  statusText: string;
  /** Route target entity id. */
  entityId: string;
  /** Quick action available on the card. */
  quickAction: 'mark_done' | 'mark_replaced' | null;
}

export type TodayActivityKind =
  | 'item_added'
  | 'document_added'
  | 'maintenance_done'
  | 'consumable_replaced';

export interface TodayActivityItem {
  id: string;
  kind: TodayActivityKind;
  title: string;
  subtitle: string | null;
  /** ISO-ish sort key (UTC instant preferred). */
  occurredAt: string;
  /** Primary navigation target. */
  route:
    | { type: 'item'; id: string }
    | { type: 'document'; id: string }
    | { type: 'maintenance'; id: string }
    | { type: 'consumable'; id: string };
}

export interface TodayHomeCounts {
  items: number;
  locations: number;
  documents: number;
  activeMaintenanceRules: number;
}

export interface TodayOverview {
  referenceDate: string;
  attention: TodayAttentionItem[];
  /** Upcoming slice already deduped against the default top preview. */
  upcoming: TodayAttentionItem[];
  recent: TodayActivityItem[];
  counts: TodayHomeCounts;
  /** Unique attention entities — equals attention.length. */
  attentionCount: number;
}

/** How many attention cards to show before "Показать все". */
export const TODAY_ATTENTION_PREVIEW_LIMIT = 5;

/** Max soft upcoming cards under «Ближайшее». */
export const TODAY_UPCOMING_LIMIT = 3;

/** Max recent activity rows. */
export const TODAY_RECENT_LIMIT = 5;

/** Warranty window reused from warranty domain (days ahead/past). */
export const TODAY_WARRANTY_WINDOW_DAYS = 30;

/** Maintenance / consumable forward window (days). */
export const TODAY_MAINTENANCE_AHEAD_DAYS = 14;
export const TODAY_CONSUMABLE_AHEAD_DAYS = 14;

/** Warranties within this many days are "very soon" (warning, not upcoming). */
export const TODAY_WARRANTY_WARNING_DAYS = 7;
