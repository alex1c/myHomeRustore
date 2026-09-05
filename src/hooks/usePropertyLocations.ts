/**
 * Property locations list that refreshes after mutations and on focus.
 *
 * Root cause of the "create location then list stays empty" bug:
 * repository instances are stable Context values, so a memoized
 * `locations.listByProperty()` never re-queries after INSERT.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import type { Location } from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';

export function usePropertyLocations(propertyId: string | null | undefined) {
  const { locations } = useDatabase();
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setRevision((n) => n + 1);
  }, []);

  // Re-query when returning to a screen (e.g. inventory filters).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const list = useMemo((): Location[] => {
    if (!propertyId || !locations) return [];
    // `revision` forces a fresh SELECT after create/rename/delete.
    void revision;
    return locations.listByProperty(propertyId);
  }, [propertyId, locations, revision]);

  return { list, refresh, repository: locations };
}
