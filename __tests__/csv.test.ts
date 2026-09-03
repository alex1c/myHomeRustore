/**
 * CSV helper unit tests — formula injection, quoting, BOM, money formatting.
 */

import {
  buildCsv,
  escapeCsvCell,
  formatMinorForCsv,
} from '@/src/utils/csv';

describe('csv helpers', () => {
  describe('escapeCsvCell', () => {
    test('prefixes formula-injection characters with a leading apostrophe', () => {
      expect(escapeCsvCell('=CMD')).toBe("'=CMD");
      expect(escapeCsvCell('+1+1')).toBe("'+1+1");
      expect(escapeCsvCell('-SUM(A1)')).toBe("'-SUM(A1)");
      expect(escapeCsvCell('@mention')).toBe("'@mention");
    });

    test('quotes cells that contain semicolons or double quotes', () => {
      expect(escapeCsvCell('a;b')).toBe('"a;b"');
      expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    });

    test('quotes cells that contain newlines', () => {
      expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
      expect(escapeCsvCell('line1\r\nline2')).toBe('"line1\r\nline2"');
    });

    test('leaves plain text unchanged', () => {
      expect(escapeCsvCell('Холодильник')).toBe('Холодильник');
      expect(escapeCsvCell(42)).toBe('42');
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
    });
  });

  describe('buildCsv', () => {
    test('emits UTF-8 BOM and CRLF line endings', () => {
      const csv = buildCsv(['A', 'B'], [['1', '2']]);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('\r\n');
      expect(csv).toBe('\uFEFFA;B\r\n1;2\r\n');
    });

    test('escapes formula injection inside full CSV document', () => {
      const csv = buildCsv(['Name'], [['=CMD']]);
      expect(csv).toContain("'=CMD");
    });
  });

  describe('formatMinorForCsv', () => {
    test('formats 12999000 minor units as 129990,00', () => {
      // 12999000 minor = 129990.00 major (RUB kopecks).
      expect(formatMinorForCsv(12999000)).toBe('129990,00');
    });

    test('pads fractional part and handles negatives / null', () => {
      expect(formatMinorForCsv(100)).toBe('1,00');
      expect(formatMinorForCsv(5)).toBe('0,05');
      expect(formatMinorForCsv(-250)).toBe('-2,50');
      expect(formatMinorForCsv(null)).toBe('');
      expect(formatMinorForCsv(undefined)).toBe('');
    });
  });
});
