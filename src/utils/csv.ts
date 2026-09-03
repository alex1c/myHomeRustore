/**
 * Safe CSV helpers — UTF-8 with BOM, semicolon delimiter, formula injection guard.
 */

const FORMULA_PREFIX = /^[\s\u00A0]*[=+\-@]/;

/** Escape a single CSV cell for Russian Excel (semicolon separated). */
export function escapeCsvCell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value);
  // Neutralize spreadsheet formula injection.
  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  const needsQuotes =
    text.includes(';') ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r');
  if (needsQuotes) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Build a CSV document with UTF-8 BOM and CRLF line endings. */
export function buildCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [
    headers.map(escapeCsvCell).join(';'),
    ...rows.map((row) => row.map(escapeCsvCell).join(';')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** Format minor currency units for CSV without floating artifacts. */
export function formatMinorForCsv(minor: number | null | undefined): string {
  if (minor == null) return '';
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole},${String(frac).padStart(2, '0')}`;
}
