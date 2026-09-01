/**
 * Money helpers — integer minor units in DB, formatted RUB in UI.
 * Never use floating point for persisted money values.
 */

const RUB_DECIMAL_RE = /^(\d+)([.,](\d{1,2}))?$/;

/**
 * Parse a user-entered RUB amount (comma or dot decimal) into kopecks.
 * Examples: "123,45" → 12345, "123.45" → 12345, "12 345,67" → 1234567
 */
export function parseRubToMinor(input: string): number | null {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  const match = normalized.match(RUB_DECIMAL_RE);
  if (!match) {
    return null;
  }
  const whole = Number(match[1]);
  if (!Number.isFinite(whole) || whole < 0) {
    return null;
  }
  const fraction = (match[3] ?? '').padEnd(2, '0').slice(0, 2);
  const minor = whole * 100 + Number(fraction);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Convert integer kopecks to major units number (for math only, not display). */
export function minorToMajor(minor: number): number {
  return minor / 100;
}

/**
 * Format kopecks as Russian locale currency string.
 * Example: 1234567 → "12 345,67 ₽"
 */
export function formatRubMinor(minor: number | null | undefined): string {
  if (minor == null) {
    return '—';
  }
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (frac === 0) {
    return `${sign}${grouped} ₽`;
  }
  const fracStr = String(frac).padStart(2, '0');
  return `${sign}${grouped},${fracStr} ₽`;
}

/** Format minor units for price text input (Russian comma decimal). */
export function minorToPriceInput(minor: number): string {
  const whole = Math.floor(minor / 100);
  const frac = minor % 100;
  if (frac === 0) {
    return String(whole);
  }
  return `${whole},${String(frac).padStart(2, '0')}`;
}
export function parseMajorToMinor(input: string, fractionDigits = 2): number | null {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const [wholeStr, fracStr = ''] = normalized.split('.');
  if (fracStr.length > fractionDigits) {
    return null;
  }
  const frac = fracStr.padEnd(fractionDigits, '0').slice(0, fractionDigits);
  const minor = Number(wholeStr) * 10 ** fractionDigits + Number(frac);
  return Number.isSafeInteger(minor) ? minor : null;
}
