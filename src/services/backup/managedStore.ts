/**
 * Pluggable managed-file IO for backup/restore (Expo production + test memory).
 */

import * as FileSystem from 'expo-file-system/legacy';

import { createEntityIdSync } from '@/src/domain/ids';
import {
  isAllowedManagedRelativePath,
  sanitizeBackupRelativePath,
} from '@/src/utils/pathSafety';
import { getManagedRoot } from '@/src/services/managedFileService';

export interface ManagedStore {
  /** Read managed relative path bytes; null if missing. */
  readRelative(relativePath: string): Promise<Uint8Array | null>;
  /** Write bytes to a managed relative path (creates dirs). */
  writeRelative(relativePath: string, bytes: Uint8Array): Promise<void>;
  /** Delete managed relative path best-effort. */
  deleteRelative(relativePath: string): Promise<void>;
  /** List all relative paths currently under managed photos/documents. */
  listRelativePaths(): Promise<string[]>;
  /** Write temporary archive bytes; returns absolute URI. */
  writeTempArchive(fileName: string, bytes: Uint8Array): Promise<string>;
  /** Read arbitrary URI (content:// or file) into bytes. */
  readUri(uri: string): Promise<Uint8Array>;
  deleteUri(uri: string): Promise<void>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // Prefer global btoa when available (RN/browser); fall back for Node tests.
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }
  // Node Jest path without DOM btoa.
  const nodeBuffer = (globalThis as { Buffer?: { from: (b: Uint8Array) => { toString: (e: string) => string } } }).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(bytes).toString('base64');
  }
  throw new Error('No base64 encoder available');
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  const nodeBuffer = (globalThis as { Buffer?: { from: (s: string, e: string) => Uint8Array } }).Buffer;
  if (nodeBuffer) {
    return new Uint8Array(nodeBuffer.from(base64, 'base64'));
  }
  throw new Error('No base64 decoder available');
}

async function ensureDir(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

/** Production store backed by expo-file-system under documentDirectory/managed/. */
export class ExpoManagedStore implements ManagedStore {
  async readRelative(relativePath: string): Promise<Uint8Array | null> {
    const safe = sanitizeBackupRelativePath(relativePath);
    if (!safe || !isAllowedManagedRelativePath(safe)) return null;
    const uri = `${getManagedRoot()}${safe}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToBytes(base64);
  }

  async writeRelative(relativePath: string, bytes: Uint8Array): Promise<void> {
    const safe = sanitizeBackupRelativePath(relativePath);
    if (!safe || !isAllowedManagedRelativePath(safe)) {
      throw new Error('Unsafe managed path');
    }
    const uri = `${getManagedRoot()}${safe}`;
    const slash = safe.lastIndexOf('/');
    if (slash > 0) {
      await ensureDir(`${getManagedRoot()}${safe.slice(0, slash)}`);
    }
    await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  async deleteRelative(relativePath: string): Promise<void> {
    const safe = sanitizeBackupRelativePath(relativePath);
    if (!safe || !isAllowedManagedRelativePath(safe)) return;
    const uri = `${getManagedRoot()}${safe}`;
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // best-effort
    }
  }

  async listRelativePaths(): Promise<string[]> {
    const root = getManagedRoot();
    const out: string[] = [];
    for (const category of ['photos', 'documents'] as const) {
      const dir = `${root}${category}`;
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) continue;
      const names = await FileSystem.readDirectoryAsync(dir);
      for (const name of names) {
        const relative = `${category}/${name}`;
        if (isAllowedManagedRelativePath(relative)) {
          out.push(relative);
        }
      }
    }
    return out;
  }

  async writeTempArchive(fileName: string, bytes: Uint8Array): Promise<string> {
    const cache = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
    const dir = `${cache}backup-temp/`;
    await ensureDir(dir);
    const uri = `${dir}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return uri;
  }

  async readUri(uri: string): Promise<Uint8Array> {
    // Copy content:// URIs into cache first when needed.
    const cache = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
    const localUri = `${cache}backup-temp/import-${createEntityIdSync()}.myhomebackup`;
    await ensureDir(`${cache}backup-temp/`);
    await FileSystem.copyAsync({ from: uri, to: localUri });
    try {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64ToBytes(base64);
    } finally {
      try {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      } catch {
        // ignore
      }
    }
  }

  async deleteUri(uri: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // ignore
    }
  }
}

/** In-memory store for Jest roundtrips without Expo filesystem. */
export class MemoryManagedStore implements ManagedStore {
  readonly files = new Map<string, Uint8Array>();
  readonly temps = new Map<string, Uint8Array>();
  private tempCounter = 0;

  async readRelative(relativePath: string): Promise<Uint8Array | null> {
    const safe = sanitizeBackupRelativePath(relativePath);
    if (!safe || !isAllowedManagedRelativePath(safe)) return null;
    return this.files.get(safe) ?? null;
  }

  async writeRelative(relativePath: string, bytes: Uint8Array): Promise<void> {
    const safe = sanitizeBackupRelativePath(relativePath);
    if (!safe || !isAllowedManagedRelativePath(safe)) {
      throw new Error('Unsafe managed path');
    }
    this.files.set(safe, bytes);
  }

  async deleteRelative(relativePath: string): Promise<void> {
    const safe = sanitizeBackupRelativePath(relativePath);
    if (safe) this.files.delete(safe);
  }

  async listRelativePaths(): Promise<string[]> {
    return [...this.files.keys()].sort();
  }

  async writeTempArchive(fileName: string, bytes: Uint8Array): Promise<string> {
    const uri = `memory://temp/${fileName}`;
    this.temps.set(uri, bytes);
    return uri;
  }

  async readUri(uri: string): Promise<Uint8Array> {
    const fromTemp = this.temps.get(uri);
    if (fromTemp) return fromTemp;
    const fromFiles = this.files.get(uri);
    if (fromFiles) return fromFiles;
    throw new Error(`Missing URI ${uri}`);
  }

  async deleteUri(uri: string): Promise<void> {
    this.temps.delete(uri);
  }

  /** Test helper: seed a managed file. */
  seed(relativePath: string, bytes: Uint8Array): void {
    this.files.set(relativePath, bytes);
  }

  nextTempName(ext = 'myhomebackup'): string {
    this.tempCounter += 1;
    return `backup-${this.tempCounter}.${ext}`;
  }
}

export { bytesToBase64, base64ToBytes };
