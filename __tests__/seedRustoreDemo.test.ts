/**
 * RuStore demo seed — reproducible dataset used for screenshot packs.
 * Also exports a SQLite binary for emulator apply scripts.
 */

import * as fs from 'fs';
import * as path from 'path';
import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import { seedRustoreDemo } from '@/src/dev/seedRustoreDemo';
import { TodayService } from '@/src/services/todayService';
import { toLocalDateOnly } from '@/src/utils/datetime';

describe('seedRustoreDemo', () => {
  test('builds a calm Today-ready dataset and writes demo DB artifact', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const db = createDatabaseFromClient(createSqlJsAdapter(raw));
    const today = toLocalDateOnly();

    const result = await seedRustoreDemo(db, { referenceDate: today });

    expect(result.locationCount).toBe(4);
    expect(result.itemCount).toBe(5);
    expect(result.documentCount).toBe(5);
    expect(result.consumableCount).toBe(3);
    expect(result.warrantyCount).toBe(4);
    expect(result.todayAttentionCount).toBeGreaterThanOrEqual(3);
    expect(result.todayAttentionCount).toBeLessThanOrEqual(8);

    const overview = new TodayService(db).getOverview(result.propertyId, today);
    expect(overview.attentionCount).toBe(result.todayAttentionCount);

    const outDir = path.join(__dirname, '..', 'release-assets', 'demo');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'my_home_demo.db');
    fs.writeFileSync(outFile, Buffer.from(raw.export()));
    expect(fs.existsSync(outFile)).toBe(true);
    expect(fs.statSync(outFile).size).toBeGreaterThan(1000);

    const summary = {
      generatedAt: new Date().toISOString(),
      referenceDate: today,
      ...result,
      note: 'DEVELOPMENT ONLY — never ship as production auto-seed',
    };
    fs.writeFileSync(
      path.join(outDir, 'summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
  });
});
