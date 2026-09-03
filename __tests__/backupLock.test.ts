/**
 * Backup/restore mutual-exclusion lock tests.
 */

import { AppError } from '@/src/domain/errors';
import {
  acquireBackupLock,
  isBackupLockHeld,
  releaseBackupLock,
  resetBackupLockForTests,
} from '@/src/services/backup/backupLock';

describe('backupLock', () => {
  beforeEach(() => {
    resetBackupLockForTests();
  });

  afterEach(() => {
    resetBackupLockForTests();
  });

  test('acquire then second acquire throws BUSY', () => {
    acquireBackupLock('backup');
    expect(isBackupLockHeld()).toBe(true);

    expect(() => acquireBackupLock('restore')).toThrow(AppError);
    try {
      acquireBackupLock('restore');
    } catch (err) {
      expect(err).toMatchObject({ code: 'BUSY' });
    }
  });

  test('release then acquire works', () => {
    acquireBackupLock('backup');
    releaseBackupLock();
    expect(isBackupLockHeld()).toBe(false);

    expect(() => acquireBackupLock('restore')).not.toThrow();
    expect(isBackupLockHeld()).toBe(true);
  });

  test('resetBackupLockForTests clears a held lock', () => {
    acquireBackupLock('backup');
    expect(isBackupLockHeld()).toBe(true);

    resetBackupLockForTests();
    expect(isBackupLockHeld()).toBe(false);
    expect(() => acquireBackupLock('restore')).not.toThrow();
  });
});
