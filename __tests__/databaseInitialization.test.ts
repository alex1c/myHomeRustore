import { openDatabaseSync } from 'expo-sqlite';

import { openAppDatabase } from '@/src/db/database';
import { createExpoSqliteAdapter } from '@/src/db/expoSqliteAdapter';
import { runMigrations } from '@/src/db/migrate';
import { PropertyRepository } from '@/src/repositories/propertyRepository';

jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn() }));
jest.mock('@/src/db/expoSqliteAdapter', () => ({
  createExpoSqliteAdapter: jest.fn(),
}));
jest.mock('@/src/db/migrate', () => ({ runMigrations: jest.fn() }));
jest.mock('@/src/repositories/propertyRepository', () => ({
  PropertyRepository: jest.fn(),
}));

describe('app database initialization', () => {
  test('retries after failure and reuses one initialized connection', async () => {
    const fakeDb = { exec: jest.fn() };
    const ensureDefaultProperty = jest.fn();
    jest.mocked(openDatabaseSync).mockReturnValue({} as never);
    jest
      .mocked(createExpoSqliteAdapter)
      .mockImplementationOnce(() => {
        throw new Error('artificial open failure');
      })
      .mockReturnValue(fakeDb as never);
    jest.mocked(PropertyRepository).mockImplementation(
      () => ({ ensureDefaultProperty }) as never,
    );

    expect(() => openAppDatabase()).toThrow('artificial open failure');

    const [first, second, third] = await Promise.all([
      Promise.resolve(openAppDatabase()),
      Promise.resolve(openAppDatabase()),
      Promise.resolve(openAppDatabase()),
    ]);

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(openDatabaseSync).toHaveBeenCalledTimes(2);
    expect(runMigrations).toHaveBeenCalledTimes(1);
    expect(ensureDefaultProperty).toHaveBeenCalledTimes(1);
  });
});
