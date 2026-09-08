/**
 * Structural tests for offline help content and More entry wiring.
 */

import fs from 'fs';
import path from 'path';

import { HELP_INTRO, HELP_SECTIONS } from '@/src/content/helpGuide';

describe('help guide content', () => {
  test('covers the expected owner-facing sections', () => {
    expect(HELP_INTRO.length).toBeGreaterThan(40);
    const ids = HELP_SECTIONS.map((section) => section.id);
    expect(ids).toEqual([
      'items',
      'locations',
      'documents',
      'warranties',
      'maintenance',
      'consumables',
      'today',
      'backup',
      'privacy',
    ]);
  });

  test('stays offline-friendly (no remote URLs in copy)', () => {
    const blob = [HELP_INTRO, ...HELP_SECTIONS.flatMap((s) => s.paragraphs)].join(
      '\n',
    );
    expect(blob).not.toMatch(/https?:\/\//i);
  });

  test('privacy note mentions local storage and backup', () => {
    const privacy = HELP_SECTIONS.find((section) => section.id === 'privacy');
    expect(privacy?.paragraphs.join(' ')).toMatch(/локально/i);
    expect(privacy?.paragraphs.join(' ')).toMatch(/резервн/i);
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
  });

  test('help screen file exists and uses offline guide module', () => {
    const helpPath = path.join(__dirname, '..', 'app', 'help.tsx');
    expect(fs.existsSync(helpPath)).toBe(true);
    const source = fs.readFileSync(helpPath, 'utf8');
    expect(source).toContain('HELP_SECTIONS');
    expect(source).toContain('helpGuide');
  });
});
