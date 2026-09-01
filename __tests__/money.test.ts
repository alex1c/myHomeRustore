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
  });

  test('formats minor units as RUB', () => {
    expect(formatRubMinor(1234567)).toBe('12 345,67 ₽');
    expect(formatRubMinor(0)).toBe('0,00 ₽');
  });

  test('parseMajorToMinor handles dot and comma', () => {
    expect(parseMajorToMinor('99.5')).toBe(9950);
    expect(parseMajorToMinor('99,5')).toBe(9950);
  });

  test('returns null for invalid input', () => {
    expect(parseRubToMinor('abc')).toBeNull();
    expect(parseRubToMinor('-10')).toBeNull();
  });
});
