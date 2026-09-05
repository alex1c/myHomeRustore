/**
 * Normalize raw emulator screenshots to RuStore portrait 1080×1920
 * and write a validation README. Uses center-top crop (no stretch).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'release-assets', 'screenshots');
const RAW_DIR = path.join(OUT_DIR, 'raw');
const TARGET_W = 1080;
const TARGET_H = 1920;
const TARGET_RATIO = TARGET_W / TARGET_H;

const FILES = [
  { file: '01-today.png', purpose: 'Smart Today attention + summary' },
  { file: '02-inventory.png', purpose: 'Inventory list with items/locations' },
  {
    file: '03-item-detail.png',
    purpose: 'Робот-пылесос Dreame L20 Ultra detail',
  },
  { file: '04-documents.png', purpose: 'Documents archive + add CTA' },
  {
    file: '05-maintenance.png',
    purpose: 'ТО list overdue/upcoming + add CTA',
  },
  { file: '06-consumables.png', purpose: 'Consumables stock + add CTA' },
  {
    file: '07-backup-export.png',
    purpose: 'Backup / restore / export entry points',
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Cover-crop to 1080×1920 without non-uniform scaling.
 * Prefer top of the frame so app chrome / status content stay readable.
 */
async function normalize(inputPath, outputPath) {
  const image = sharp(inputPath);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`Cannot read dimensions: ${inputPath}`);
  }

  const srcRatio = meta.width / meta.height;
  let extract;

  if (srcRatio > TARGET_RATIO) {
    // Too wide: crop horizontally, keep full height then resize.
    const cropW = Math.round(meta.height * TARGET_RATIO);
    const left = Math.floor((meta.width - cropW) / 2);
    extract = { left, top: 0, width: cropW, height: meta.height };
  } else {
    // Too tall (typical phone): crop vertically from the top.
    const cropH = Math.round(meta.width / TARGET_RATIO);
    extract = { left: 0, top: 0, width: meta.width, height: cropH };
  }

  await sharp(inputPath)
    .extract(extract)
    .resize(TARGET_W, TARGET_H, { fit: 'fill' })
    .png()
    .toFile(outputPath);

  const outMeta = await sharp(outputPath).metadata();
  return {
    srcWidth: meta.width,
    srcHeight: meta.height,
    outWidth: outMeta.width,
    outHeight: outMeta.height,
    size: fs.statSync(outputPath).size,
  };
}

async function main() {
  ensureDir(OUT_DIR);
  ensureDir(RAW_DIR);

  const rows = [];
  let allPass = true;

  for (const entry of FILES) {
    const rawPath = path.join(RAW_DIR, entry.file);
    const outPath = path.join(OUT_DIR, entry.file);
    let status = 'FAIL';
    let dims = '—';
    let ratio = '—';
    let size = '—';
    let note = '';

    try {
      if (!fs.existsSync(rawPath) && !fs.existsSync(outPath)) {
        note = 'missing raw and output';
        allPass = false;
      } else {
        const source = fs.existsSync(rawPath) ? rawPath : outPath;
        const result = await normalize(source, outPath);
        dims = `${result.outWidth}×${result.outHeight}`;
        ratio = (result.outWidth / result.outHeight).toFixed(4);
        size = `${Math.round(result.size / 1024)} KB`;
        const ok =
          result.outWidth === TARGET_W && result.outHeight === TARGET_H;
        status = ok ? 'PASS' : 'FAIL';
        if (!ok) allPass = false;
        note = `from ${result.srcWidth}×${result.srcHeight}`;
      }
    } catch (err) {
      allPass = false;
      note = err instanceof Error ? err.message : String(err);
    }

    rows.push({
      file: entry.file,
      dims,
      ratio,
      size,
      purpose: entry.purpose,
      status,
      note,
    });
  }

  const lines = [
    '# RuStore screenshots',
    '',
    'Target format: **1080×1920** (portrait), cover-cropped without stretch.',
    '',
    '| filename | dimensions | ratio | size | visual purpose | PASS/FAIL |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.file} | ${r.dims} | ${r.ratio} | ${r.size} | ${r.purpose} | ${r.status} |`,
    ),
    '',
    '## Validation checklist',
    '',
    '- PNG format',
    '- Exact 1080×1920',
    '- No keyboard / notification shade / Metro / Expo menu',
    '- No system share sheet / permission dialogs',
    '- No test labels (`Test`, `Demo`, `Item 1`)',
    '- Bottom tabs / CTAs readable when in frame',
    '',
    `Overall: **${allPass ? 'PASS' : 'FAIL / CAPTURE PENDING'}**`,
    '',
  ];

  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
  if (!allPass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
