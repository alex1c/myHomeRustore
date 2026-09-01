/**
 * Managed path safety tests (backup-ready relative paths).
 */

import {
  isAllowedManagedRelativePath,
  sanitizeBackupRelativePath,
  sanitizeFileName,
} from '@/src/utils/pathSafety';
import { managedUriFromRelativePath } from '@/src/services/managedFileService';

describe('managed storage paths', () => {
  test('accepts valid relative paths', () => {
    expect(sanitizeBackupRelativePath('photos/abc.jpg')).toBe('photos/abc.jpg');
    expect(isAllowedManagedRelativePath('documents/receipt.pdf')).toBe(true);
  });

  test('rejects traversal and absolute paths', () => {
    expect(sanitizeBackupRelativePath('../etc/passwd')).toBeNull();
    expect(sanitizeBackupRelativePath('../../file')).toBeNull();
    expect(sanitizeBackupRelativePath('documents/../../../x')).toBeNull();
    expect(sanitizeBackupRelativePath('documents\\..\\x')).toBeNull();
    expect(sanitizeBackupRelativePath('/absolute/path')).toBeNull();
    expect(sanitizeBackupRelativePath('C:\\windows\\file')).toBeNull();
    expect(sanitizeBackupRelativePath('file:///tmp/a')).toBeNull();
    expect(isAllowedManagedRelativePath('other/file.bin')).toBe(false);
  });

  test('sanitizes unsafe file names', () => {
    expect(sanitizeFileName('receipt:scan?.pdf')).toBe('receipt_scan_.pdf');
    expect(sanitizeFileName('')).toBe('file');
  });

  test('managedUriFromRelativePath rejects invalid roots', () => {
    expect(managedUriFromRelativePath('tmp/evil')).toBeNull();
    expect(managedUriFromRelativePath('photos/item.jpg')).toContain('managed/');
  });
});
