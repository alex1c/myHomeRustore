/**
 * Local suggested maintenance templates — deterministic, no AI.
 * Intervals are approximate; users should follow manufacturer instructions.
 */

import type { IntervalUnit } from '@/src/domain/types';

export interface MaintenanceTemplate {
  id: string;
  group: string;
  title: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  /** Keywords matched against item category + name (lowercase). */
  matchKeywords: string[];
}

export const MAINTENANCE_TEMPLATES: readonly MaintenanceTemplate[] = [
  // Кондиционер
  {
    id: 'ac-filter',
    group: 'Кондиционер',
    title: 'Очистить фильтр',
    intervalValue: 30,
    intervalUnit: 'day',
    matchKeywords: ['кондиционер', 'сплит', 'air conditioner', 'ac'],
  },
  {
    id: 'ac-outdoor',
    group: 'Кондиционер',
    title: 'Проверить внешний блок',
    intervalValue: 6,
    intervalUnit: 'month',
    matchKeywords: ['кондиционер', 'сплит', 'air conditioner', 'ac'],
  },
  {
    id: 'ac-service',
    group: 'Кондиционер',
    title: 'Профессиональное обслуживание',
    intervalValue: 12,
    intervalUnit: 'month',
    matchKeywords: ['кондиционер', 'сплит', 'air conditioner', 'ac'],
  },
  // Робот-пылесос
  {
    id: 'robot-bin',
    group: 'Робот-пылесос',
    title: 'Очистить контейнер',
    intervalValue: 7,
    intervalUnit: 'day',
    matchKeywords: ['робот-пылесос', 'робот пылесос', 'роботпылесос', 'robot'],
  },
  {
    id: 'robot-brushes',
    group: 'Робот-пылесос',
    title: 'Очистить щётки',
    intervalValue: 14,
    intervalUnit: 'day',
    matchKeywords: ['робот-пылесос', 'робот пылесос', 'роботпылесос', 'robot'],
  },
  {
    id: 'robot-sensors',
    group: 'Робот-пылесос',
    title: 'Очистить датчики',
    intervalValue: 30,
    intervalUnit: 'day',
    matchKeywords: ['робот-пылесос', 'робот пылесос', 'роботпылесос', 'robot'],
  },
  // Пылесос
  {
    id: 'vac-filter',
    group: 'Пылесос',
    title: 'Очистить фильтр',
    intervalValue: 30,
    intervalUnit: 'day',
    matchKeywords: ['пылесос'],
  },
  // Кофемашина
  {
    id: 'coffee-flush',
    group: 'Кофемашина',
    title: 'Промыть систему',
    intervalValue: 7,
    intervalUnit: 'day',
    matchKeywords: ['кофемаш', 'кофевар', 'coffee'],
  },
  {
    id: 'coffee-descaler',
    group: 'Кофемашина',
    title: 'Очистить от накипи',
    intervalValue: 3,
    intervalUnit: 'month',
    matchKeywords: ['кофемаш', 'кофевар', 'coffee'],
  },
  {
    id: 'coffee-brew',
    group: 'Кофемашина',
    title: 'Очистить заварочный блок',
    intervalValue: 30,
    intervalUnit: 'day',
    matchKeywords: ['кофемаш', 'кофевар', 'coffee'],
  },
  // Стиральная машина
  {
    id: 'washer-filter',
    group: 'Стиральная машина',
    title: 'Очистить фильтр',
    intervalValue: 3,
    intervalUnit: 'month',
    matchKeywords: ['стираль', 'washer', 'washing'],
  },
  {
    id: 'washer-drum',
    group: 'Стиральная машина',
    title: 'Очистить барабан',
    intervalValue: 3,
    intervalUnit: 'month',
    matchKeywords: ['стираль', 'washer', 'washing'],
  },
  {
    id: 'washer-hoses',
    group: 'Стиральная машина',
    title: 'Проверить шланги',
    intervalValue: 12,
    intervalUnit: 'month',
    matchKeywords: ['стираль', 'washer', 'washing'],
  },
  // Посудомоечная
  {
    id: 'dw-filter',
    group: 'Посудомоечная машина',
    title: 'Очистить фильтр',
    intervalValue: 30,
    intervalUnit: 'day',
    matchKeywords: ['посудомо', 'dishwasher'],
  },
  {
    id: 'dw-clean',
    group: 'Посудомоечная машина',
    title: 'Очистить машину',
    intervalValue: 3,
    intervalUnit: 'month',
    matchKeywords: ['посудомо', 'dishwasher'],
  },
  // Холодильник
  {
    id: 'fridge-grille',
    group: 'Холодильник',
    title: 'Очистить заднюю решётку',
    intervalValue: 6,
    intervalUnit: 'month',
    matchKeywords: ['холодиль', 'fridge', 'refrigerator'],
  },
  {
    id: 'fridge-seal',
    group: 'Холодильник',
    title: 'Проверить уплотнители',
    intervalValue: 6,
    intervalUnit: 'month',
    matchKeywords: ['холодиль', 'fridge', 'refrigerator'],
  },
  // Вытяжка
  {
    id: 'hood-grease',
    group: 'Вытяжка',
    title: 'Очистить жироулавливающий фильтр',
    intervalValue: 30,
    intervalUnit: 'day',
    matchKeywords: ['вытяжк', 'hood'],
  },
  // Очиститель воздуха
  {
    id: 'air-prefilter',
    group: 'Очиститель воздуха',
    title: 'Очистить предварительный фильтр',
    intervalValue: 30,
    intervalUnit: 'day',
    matchKeywords: ['очистител', 'воздух', 'air purifier', 'hepa'],
  },
  // Котёл
  {
    id: 'boiler-service',
    group: 'Котёл',
    title: 'Плановое обслуживание',
    intervalValue: 12,
    intervalUnit: 'month',
    matchKeywords: ['котёл', 'котел', 'boiler', 'газов'],
  },
  // Общие
  {
    id: 'extinguisher',
    group: 'Безопасность',
    title: 'Проверить огнетушитель',
    intervalValue: 12,
    intervalUnit: 'month',
    matchKeywords: ['огнетуш', 'extinguisher'],
  },
  {
    id: 'sensor-battery',
    group: 'Датчики',
    title: 'Проверить батарейки датчиков',
    intervalValue: 6,
    intervalUnit: 'month',
    matchKeywords: ['датчик', 'sensor', 'батарей'],
  },
] as const;

/** Match templates against item category and name (deterministic). */
export function suggestMaintenanceTemplates(input: {
  category?: string | null;
  name?: string | null;
}): MaintenanceTemplate[] {
  const haystack = `${input.category ?? ''} ${input.name ?? ''}`.toLowerCase();
  if (!haystack.trim()) {
    return [];
  }

  // Prefer more specific robot-vacuum keywords over generic vacuum.
  const isRobot = /робот/.test(haystack);
  const seen = new Set<string>();
  const result: MaintenanceTemplate[] = [];

  for (const template of MAINTENANCE_TEMPLATES) {
    const matches = template.matchKeywords.some((kw) => haystack.includes(kw));
    if (!matches) continue;
    if (template.group === 'Пылесос' && isRobot) continue;
    if (seen.has(template.id)) continue;
    seen.add(template.id);
    result.push(template);
  }

  return result;
}

export function formatIntervalLabel(
  value: number,
  unit: IntervalUnit,
): string {
  if (unit === 'day') {
    if (value === 1) return 'Каждый день';
    return `Каждые ${value} ${pluralDays(value)}`;
  }
  if (unit === 'week') {
    if (value === 1) return 'Каждую неделю';
    return `Каждые ${value} ${pluralWeeks(value)}`;
  }
  if (unit === 'month') {
    if (value === 1) return 'Каждый месяц';
    return `Каждые ${value} ${pluralMonths(value)}`;
  }
  if (value === 1) return 'Каждый год';
  return `Каждые ${value} ${pluralYears(value)}`;
}

function pluralDays(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'дня';
  return 'дней';
}

function pluralWeeks(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'неделю';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'недели';
  return 'недель';
}

function pluralMonths(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'месяц';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'месяца';
  return 'месяцев';
}

function pluralYears(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'год';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'года';
  return 'лет';
}
