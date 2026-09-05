/**
 * Non-interactive RuStore screenshot capture for a seeded emulator.
 * Usage: node scripts/capture-rustore-screenshots-auto.mjs --serial emulator-5556
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'release-assets', 'screenshots');
const RAW_DIR = path.join(OUT_DIR, 'raw');
const PACKAGE = 'com.calculatorplatform.myhome';

function argValue(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const SERIAL = argValue('--serial', 'emulator-5556');

function adb(args, opts = {}) {
  const full = ['-s', SERIAL, ...args];
  const res = spawnSync('adb', full, {
    encoding: 'utf8',
    ...opts,
  });
  if (res.status !== 0) {
    throw new Error(
      `adb ${full.join(' ')} failed: ${res.stderr || res.stdout || res.status}`,
    );
  }
  return res.stdout || '';
}

function shell(command) {
  return adb(['shell', command]);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function capture(file) {
  const remote = '/sdcard/myhome-shot.png';
  shell(`screencap -p ${remote}`);
  adb(['pull', remote, path.join(RAW_DIR, file)]);
  shell(`rm ${remote}`);
  console.log(`captured ${file}`);
}

function dumpUi() {
  const remote = '/sdcard/ui.xml';
  const local = path.join(process.env.TEMP || '/tmp', 'myhome-ui.xml');
  shell(`uiautomator dump ${remote}`);
  adb(['pull', remote, local]);
  return fs.readFileSync(local, 'utf8');
}

function tapText(text) {
  const xml = dumpUi();
  const re = new RegExp(
    `text="${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
  );
  const m = xml.match(re);
  if (!m) {
    // Some nodes put bounds before text.
    const re2 = new RegExp(
      `bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*text="${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
    );
    const m2 = xml.match(re2);
    if (!m2) {
      console.log(`WARN: text not found: ${text}`);
      return false;
    }
    const x = Math.floor((Number(m2[1]) + Number(m2[3])) / 2);
    const y = Math.floor((Number(m2[2]) + Number(m2[4])) / 2);
    shell(`input tap ${x} ${y}`);
    sleep(1800);
    return true;
  }
  const x = Math.floor((Number(m[1]) + Number(m[3])) / 2);
  const y = Math.floor((Number(m[2]) + Number(m[4])) / 2);
  shell(`input tap ${x} ${y}`);
  sleep(1800);
  return true;
}

function openApp() {
  shell(`am force-stop ${PACKAGE}`);
  sleep(800);
  shell(`monkey -p ${PACKAGE} -c android.intent.category.LAUNCHER 1`);
  sleep(6500);
}

fs.mkdirSync(RAW_DIR, { recursive: true });
openApp();
tapText('Далее');
tapText('Начать');
tapText('Пропустить');
sleep(1500);

tapText('Сегодня');
sleep(1500);
capture('01-today.png');

tapText('Имущество');
sleep(1500);
capture('02-inventory.png');

if (tapText('Робот-пылесос')) {
  sleep(1500);
  capture('03-item-detail.png');
  shell('input keyevent 4');
  sleep(1000);
}

tapText('Документы');
sleep(1500);
capture('04-documents.png');

tapText('Обслуживание');
sleep(1000);
tapText('ТО');
sleep(1500);
capture('05-maintenance.png');

tapText('Расходники');
sleep(1500);
capture('06-consumables.png');

tapText('Ещё');
sleep(1500);
capture('07-backup-export.png');

const norm = spawnSync('node', [path.join(__dirname, 'normalize-rustore-screenshots.mjs')], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'inherit',
});
process.exit(norm.status ?? 1);
