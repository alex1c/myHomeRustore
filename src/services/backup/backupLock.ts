/**
 * Shared mutex for backup and restore — prevents concurrent archive jobs.
 */

import { AppError } from '@/src/domain/errors';

let locked = false;

export function acquireBackupLock(operation: 'backup' | 'restore'): void {
  if (locked) {
    throw new AppError('Операция уже выполняется', { code: 'BUSY' });
  }
  locked = true;
  void operation;
}

export function releaseBackupLock(): void {
  locked = false;
}

export function isBackupLockHeld(): boolean {
  return locked;
}

export function resetBackupLockForTests(): void {
  locked = false;
}
