/**
 * Local suggested consumable templates — deterministic matching, no AI.
 */

import type { ConsumableStockUnit, IntervalUnit } from '@/src/domain/types';

export interface ConsumableTemplate {
  id: string;
  group: string;
  name: string;
  intervalValue: number | null;
  intervalUnit: IntervalUnit | null;
  /** Prefer stock tracking even without schedule. */
  suggestStock: boolean;
  defaultStockUnit: ConsumableStockUnit;
  matchKeywords: string[];
}

export const CONSUMABLE_TEMPLATES: readonly ConsumableTemplate[] = [
  // Robot vacuum
  {
    id: 'robot-hepa',
    group: 'Робот-пылесос',
    name: 'HEPA-фильтр',
    intervalValue: 3,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['робот-пылесос', 'робот пылесос', 'роботпылесос', 'robot'],
  },
  {
    id: 'robot-side-brush',
    group: 'Робот-пылесос',
    name: 'Боковая щётка',
    intervalValue: 6,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['робот-пылесос', 'робот пылесос', 'роботпылесос', 'robot'],
  },
  {
    id: 'robot-main-brush',
    group: 'Робот-пылесос',
    name: 'Основная щётка',
    intervalValue: 6,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['робот-пылесос', 'робот пылесос', 'роботпылесос', 'robot'],
  },
  {
    id: 'robot-bag',
    group: 'Робот-пылесос',
    name: 'Мешок станции',
    intervalValue: 30,
    intervalUnit: 'day',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['робот-пылесос', 'робот пылесос', 'роботпылесос', 'robot'],
  },
  {
    id: 'robot-mop',
    group: 'Робот-пылесос',
    name: 'Салфетка',
    intervalValue: 3,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['робот-пылесос', 'робот пылесос', 'роботпылесос', 'robot'],
  },
  // Vacuum
  {
    id: 'vac-hepa',
    group: 'Пылесос',
    name: 'HEPA-фильтр',
    intervalValue: 6,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['пылесос'],
  },
  {
    id: 'vac-bags',
    group: 'Пылесос',
    name: 'Мешки',
    intervalValue: null,
    intervalUnit: null,
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['пылесос'],
  },
  {
    id: 'vac-motor-filter',
    group: 'Пылесос',
    name: 'Фильтр двигателя',
    intervalValue: 6,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['пылесос'],
  },
  // Coffee
  {
    id: 'coffee-water-filter',
    group: 'Кофемашина',
    name: 'Фильтр воды',
    intervalValue: 2,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['кофемаш', 'кофевар', 'coffee'],
  },
  {
    id: 'coffee-descaler',
    group: 'Кофемашина',
    name: 'Средство от накипи',
    intervalValue: 3,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pack',
    matchKeywords: ['кофемаш', 'кофевар', 'coffee'],
  },
  {
    id: 'coffee-tabs',
    group: 'Кофемашина',
    name: 'Таблетки очистки',
    intervalValue: 30,
    intervalUnit: 'day',
    suggestStock: true,
    defaultStockUnit: 'pack',
    matchKeywords: ['кофемаш', 'кофевар', 'coffee'],
  },
  // Water filter
  {
    id: 'water-cartridge',
    group: 'Фильтр воды',
    name: 'Картридж',
    intervalValue: 3,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['фильтр воды', 'картридж', 'water filter', 'кувшин', 'мойк'],
  },
  {
    id: 'water-membrane',
    group: 'Фильтр воды',
    name: 'Мембрана',
    intervalValue: 12,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['фильтр воды', 'обратн', 'osmosis', 'мембран'],
  },
  // Air purifier
  {
    id: 'air-hepa',
    group: 'Очиститель воздуха',
    name: 'HEPA-фильтр',
    intervalValue: 6,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['очистител', 'воздух', 'air purifier', 'hepa'],
  },
  {
    id: 'air-carbon',
    group: 'Очиститель воздуха',
    name: 'Угольный фильтр',
    intervalValue: 6,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['очистител', 'воздух', 'air purifier'],
  },
  // Range hood
  {
    id: 'hood-carbon',
    group: 'Вытяжка',
    name: 'Угольный фильтр',
    intervalValue: 6,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['вытяжк', 'hood'],
  },
  // Dishwasher — stock only
  {
    id: 'dw-tabs',
    group: 'Посудомоечная машина',
    name: 'Таблетки',
    intervalValue: null,
    intervalUnit: null,
    suggestStock: true,
    defaultStockUnit: 'pack',
    matchKeywords: ['посудомо', 'dishwasher'],
  },
  {
    id: 'dw-salt',
    group: 'Посудомоечная машина',
    name: 'Соль',
    intervalValue: null,
    intervalUnit: null,
    suggestStock: true,
    defaultStockUnit: 'pack',
    matchKeywords: ['посудомо', 'dishwasher'],
  },
  {
    id: 'dw-rinse',
    group: 'Посудомоечная машина',
    name: 'Ополаскиватель',
    intervalValue: null,
    intervalUnit: null,
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['посудомо', 'dishwasher'],
  },
  // AC filter as replaceable consumable (when disposable)
  {
    id: 'ac-filter',
    group: 'Кондиционер',
    name: 'Фильтр кондиционера',
    intervalValue: 3,
    intervalUnit: 'month',
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['кондиционер', 'сплит', 'air conditioner'],
  },
  // Sensors / batteries — stock only
  {
    id: 'bat-aa',
    group: 'Датчики',
    name: 'Батарейки AA',
    intervalValue: null,
    intervalUnit: null,
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['датчик', 'sensor', 'батарей', 'smart'],
  },
  {
    id: 'bat-aaa',
    group: 'Датчики',
    name: 'Батарейки AAA',
    intervalValue: null,
    intervalUnit: null,
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['датчик', 'sensor', 'батарей', 'smart'],
  },
  {
    id: 'bat-cr2032',
    group: 'Датчики',
    name: 'CR2032',
    intervalValue: null,
    intervalUnit: null,
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['датчик', 'sensor', 'батарей', 'smart'],
  },
  {
    id: 'bat-cr123a',
    group: 'Датчики',
    name: 'CR123A',
    intervalValue: null,
    intervalUnit: null,
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['датчик', 'sensor', 'батарей', 'smart'],
  },
  // Lighting — stock only
  {
    id: 'bulb-led',
    group: 'Освещение',
    name: 'Лампа / LED',
    intervalValue: null,
    intervalUnit: null,
    suggestStock: true,
    defaultStockUnit: 'pcs',
    matchKeywords: ['лампа', 'свет', 'люстр', 'бра', 'bulb', 'led'],
  },
] as const;

export function suggestConsumableTemplates(input: {
  category?: string | null;
  name?: string | null;
}): ConsumableTemplate[] {
  const haystack = `${input.category ?? ''} ${input.name ?? ''}`.toLowerCase();
  if (!haystack.trim()) return [];

  const isRobot = /робот/.test(haystack);
  const seen = new Set<string>();
  const result: ConsumableTemplate[] = [];

  for (const template of CONSUMABLE_TEMPLATES) {
    if (!template.matchKeywords.some((kw) => haystack.includes(kw))) continue;
    if (template.group === 'Пылесос' && isRobot) continue;
    if (seen.has(template.id)) continue;
    seen.add(template.id);
    result.push(template);
  }
  return result;
}

export function formatConsumableIntervalLabel(
  value: number,
  unit: IntervalUnit,
): string {
  if (unit === 'day') {
    return value === 1 ? 'Каждый день' : `Обычно раз в ${value} дн.`;
  }
  if (unit === 'week') {
    return value === 1 ? 'Каждую неделю' : `Обычно раз в ${value} нед.`;
  }
  if (unit === 'month') {
    return value === 1 ? 'Обычно раз в месяц' : `Обычно раз в ${value} мес.`;
  }
  return value === 1 ? 'Обычно раз в год' : `Обычно раз в ${value} г.`;
}
