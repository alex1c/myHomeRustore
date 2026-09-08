/**
 * Structural tests for offline help content and More entry wiring.
 */

import fs from 'fs';
import path from 'path';

import {
  HELP_REQUIRED_SECTION_IDS,
  HELP_SECTIONS,
  HELP_SUBTITLE,
} from '@/src/content/helpGuide';

describe('help guide content', () => {
  test('covers all required owner-facing sections in order', () => {
    expect(HELP_SUBTITLE.length).toBeGreaterThan(20);
    expect(HELP_SECTIONS.map((section) => section.id)).toEqual([
      ...HELP_REQUIRED_SECTION_IDS,
    ]);
  });

  test('each section has a title, icon, and usable copy', () => {
    for (const section of HELP_SECTIONS) {
      expect(section.title.trim().length).toBeGreaterThan(2);
      expect(section.icon.trim().length).toBeGreaterThan(2);
      const body = [
        ...section.paragraphs,
        ...(section.bullets ?? []),
      ].join('\n');
      expect(body.trim().length).toBeGreaterThan(20);
    }
  });

  test('stays offline-friendly (no remote URLs in guide copy)', () => {
    const blob = HELP_SECTIONS.flatMap((section) => [
      section.title,
      ...section.paragraphs,
      ...(section.bullets ?? []),
    ]).join('\n');
    expect(blob).not.toMatch(/https?:\/\//i);
    expect(blob).not.toMatch(/\b(SQLite|repository|schema|migration|CRUD)\b/i);
  });

  test('distinguishes backup restore from CSV export', () => {
    const backup = HELP_SECTIONS.find((section) => section.id === 'backup');
    const exp = HELP_SECTIONS.find((section) => section.id === 'export');
    expect(backup?.paragraphs.join(' ')).toMatch(/\.myhomebackup/i);
    expect(backup?.paragraphs.join(' ')).toMatch(/замен/i);
    expect(exp?.paragraphs.join(' ')).toMatch(/CSV/i);
    expect(exp?.paragraphs.join(' ')).toMatch(/не полн/i);
  });

  test('data section mentions local storage without overclaiming ads absence', () => {
    const data = HELP_SECTIONS.find((section) => section.id === 'data');
    const text = data?.paragraphs.join(' ') ?? '';
    expect(text).toMatch(/локально/i);
    expect(text).toMatch(/регистрац/i);
    expect(text).not.toMatch(/ничего никуда не переда/i);
  });

  test('consumables section explains ТО vs расходник', () => {
    const consumables = HELP_SECTIONS.find(
      (section) => section.id === 'consumables',
    );
    const text = [
      ...(consumables?.paragraphs ?? []),
      ...(consumables?.bullets ?? []),
    ].join(' ');
    expect(text).toMatch(/ТО/i);
    expect(text).toMatch(/Расходник/i);
    expect(text).toMatch(/Требуют внимания/);
    expect(text).toMatch(/Нет в запасе/);
  });
});

describe('help route wiring', () => {
  test('root stack registers help screen', () => {
    const layout = fs.readFileSync(
      path.join(__dirname, '..', 'app', '_layout.tsx'),
      'utf8',
    );
    expect(layout).toContain('name="help"');
    expect(layout).toContain('Как пользоваться');
  });

  test('More tab exposes Как пользоваться entry to /help', () => {
    const more = fs.readFileSync(
      path.join(__dirname, '..', 'app', '(tabs)', 'more.tsx'),
      'utf8',
    );
    expect(more).toContain("router.push('/help'");
    expect(more).toContain('Как пользоваться');
    expect(more).toContain('help-circle-outline');
  });

  test('help screen renders offline guide and optional privacy link only', () => {
    const helpPath = path.join(__dirname, '..', 'app', 'help.tsx');
    expect(fs.existsSync(helpPath)).toBe(true);
    const source = fs.readFileSync(helpPath, 'utf8');
    expect(source).toContain('HELP_SECTIONS');
    expect(source).toContain('HELP_SUBTITLE');
    expect(source).toContain('helpGuide');
    expect(source).not.toMatch(/fetch\(/);
    expect(source).not.toMatch(/WebView/);
  });
});
