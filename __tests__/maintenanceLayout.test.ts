/**
 * Structural regression: maintenance controls stay compact (no tall filter stretch).
 */

import fs from 'fs';
import path from 'path';

describe('maintenance compact controls', () => {
  const maintenanceSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app', '(tabs)', 'maintenance.tsx'),
    'utf8',
  );
  const filterChipsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'inventory', 'FilterChips.tsx'),
    'utf8',
  );

  test('FilterChips prevents ScrollView vertical flexGrow stretch', () => {
    expect(filterChipsSrc).toContain('flexGrow: 0');
    expect(filterChipsSrc).toContain('wrap');
  });

  test('maintenance uses wrapping compact filter chips', () => {
    expect(maintenanceSrc).toMatch(/<FilterChips[\s\S]*\bwrap\b/);
  });

  test('mode tabs and search use compact ~40dp heights', () => {
    expect(maintenanceSrc).toMatch(/modeChip:[\s\S]*minHeight:\s*40/);
    expect(maintenanceSrc).toMatch(/search:[\s\S]*minHeight:\s*40/);
  });

  test('list region + footer CTA layout contract remains', () => {
    expect(maintenanceSrc).toContain('listRegion');
    expect(maintenanceSrc).toContain('minHeight: 0');
    expect(maintenanceSrc).toContain('addButton');
  });
});
