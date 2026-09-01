/**
 * Money parsing and formatting tests.
 */

import {
  formatRubMinor,
  parseMajorToMinor,
  parseRubToMinor,
} from '@/src/utils/money';

describe('money', () => {
  test('parses comma decimal', () => {
    expect(parseRubToMinor('123,45')).toBe(12345);
  });

  test('parses dot decimal', () => {
    expect(parseRubToMinor('123.45')).toBe(12345);
  });

  test('parses spaced thousands with comma', () => {
    expect(parseRubToMinor('12 345,67')).toBe(1234567);
    expect(parseRubToMinor('12\u00a0345,67')).toBe(1234567);
  });

  test.each([
    ['123', 12300],
    ['123,4', 12340],
    ['123.4', 12340],
    ['0,01', 1],
  ])('parses %s exactly', (input, expected) => {
    expect(parseRubToMinor(input)).toBe(expected);
  });

  test('formats minor units as RUB', () => {
    expect(formatRubMinor(1234567)).toBe('12 345,67 ₽');
    expect(formatRubMinor(0)).toBe('0 ₽');
  });

  test('parseMajorToMinor handles dot and comma', () => {
    expect(parseMajorToMinor('99.5')).toBe(9950);
    expect(parseMajorToMinor('99,5')).toBe(9950);
  });

  test('returns null for invalid input', () => {
    for (const invalid of ['12,345,67', 'abc', '-', 'NaN', 'Infinity', '1e5']) {
      expect(parseRubToMinor(invalid)).toBeNull();
    }
    expect(parseRubToMinor('9007199254740991')).toBeNull();
    expect(parseMajorToMinor('1.999')).toBeNull();
  });
});
