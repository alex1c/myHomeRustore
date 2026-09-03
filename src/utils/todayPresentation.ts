/**
 * Russian copy helpers for Smart Today greeting and summary.
 */

import type { TodayAttentionItem } from '@/src/domain/today';
import { summarizeAttention } from '@/src/utils/todayAttention';

function pluralPoints(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'пункт';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'пункта';
  return 'пунктов';
}

function pluralOverdue(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'просрочено';
  return 'просрочено';
}

function pluralWarranty(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'гарантия';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'гарантии';
  return 'гарантий';
}

function pluralMaintenance(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'обслуживание';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'обслуживания';
  return 'обслуживаний';
}

function pluralConsumable(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'расходник';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'расходника';
  return 'расходников';
}

export function pluralItems(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'вещь';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'вещи';
  return 'вещей';
}

export function pluralRooms(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'комната';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'комнаты';
  return 'комнат';
}

export function pluralDocuments(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'документ';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'документа';
  return 'документов';
}

export function pluralRules(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'правило ТО';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'правила ТО';
  return 'правил ТО';
}

/** Time-of-day greeting from a local hour (0–23). */
export function todayGreeting(hour: number = new Date().getHours()): string {
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

export function todayHeadline(attentionCount: number): string {
  if (attentionCount <= 0) return 'Сегодня всё под контролем';
  return `Требуют внимания ${attentionCount} ${pluralPoints(attentionCount)}`;
}

/** Compact breakdown under the headline, e.g. "2 просрочено · 1 гарантия". */
export function todaySummaryLine(attention: TodayAttentionItem[]): string | null {
  if (attention.length === 0) return null;
  const parts: string[] = [];
  const { overdue, warranties, maintenance, consumables } =
    summarizeAttention(attention);

  if (overdue > 0) {
    parts.push(`${overdue} ${pluralOverdue(overdue)}`);
  }
  if (warranties > 0) {
    parts.push(`${warranties} ${pluralWarranty(warranties)}`);
  }
  if (maintenance > 0) {
    parts.push(`${maintenance} ${pluralMaintenance(maintenance)}`);
  }
  if (consumables > 0) {
    parts.push(`${consumables} ${pluralConsumable(consumables)}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}
