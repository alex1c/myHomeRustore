/**
 * Active property helper for inventory screens.
 */

import { useMemo } from 'react';

import { useDatabase } from '@/src/providers/DatabaseProvider';
import type { Property } from '@/src/domain/types';

export function useActiveProperty(): {
  property: Property | null;
  propertyId: string | null;
  ready: boolean;
} {
  const { ready, properties, settings } = useDatabase();

  const property = useMemo(() => {
    if (!ready || !properties) {
      return null;
    }
    const all = properties.listProperties();
    const activeId = settings?.getActivePropertyId();
    if (activeId) {
      const found = properties.getById(activeId);
      if (found) {
        return found;
      }
    }
    return all[0] ?? null;
  }, [ready, properties, settings]);

  return {
    property,
    propertyId: property?.id ?? null,
    ready,
  };
}
