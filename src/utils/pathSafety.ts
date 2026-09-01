/**
 * Path safety helpers for managed storage and future backup ZIP restore.
 */

const UNSAFE_SEGMENT = /\.\.|^\/|^\\|^file:|^content:/i;

export function sanitizeBackupRelativePath(raw: string): string | null {
  if (raw.includes('\0')) return null;
  const normalized = raw.replace(/\\/g, '/').trim();
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) {
    return null;
  }
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((s) => s === '..' || s === '.' || UNSAFE_SEGMENT.test(s))) {
    return null;
  }
  return segments.join('/');
}

export const MANAGED_FILE_ROOTS = ['documents', 'photos'] as const;

export function isAllowedManagedRelativePath(relativePath: string): boolean {
  const safe = sanitizeBackupRelativePath(relativePath);
  if (!safe) {
    return false;
  }
  const root = safe.split('/')[0];
  return (MANAGED_FILE_ROOTS as readonly string[]).includes(root ?? '');
}

/**
 * Sanitize a user-provided filename for managed storage.
 * Strips path separators and control characters.
 */
export function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, '_').replace(/[\x00-\x1f]/g, '');
  const trimmed = base.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : 'file';
}
