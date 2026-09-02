/**
 * Navigate when user taps a warranty reminder notification.
 */

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import type { SqlDatabase } from '@/src/db/types';

function navigateFromNotificationData(
  router: ReturnType<typeof useRouter>,
  db: SqlDatabase | null,
  data: Record<string, unknown> | undefined,
): void {
  const warrantyId = typeof data?.warrantyId === 'string' ? data.warrantyId : null;
  const maintenanceRuleId =
    typeof data?.maintenanceRuleId === 'string' ? data.maintenanceRuleId : null;
  const consumableId =
    typeof data?.consumableId === 'string' ? data.consumableId : null;
  const itemId = typeof data?.itemId === 'string' ? data.itemId : null;

  if (
    consumableId &&
    db?.getFirst('SELECT id FROM consumables WHERE id = ?', [consumableId])
  ) {
    router.push({
      pathname: '/consumable/[id]',
      params: { id: consumableId },
    });
    return;
  }
  if (
    maintenanceRuleId &&
    db?.getFirst('SELECT id FROM maintenance_rules WHERE id = ?', [
      maintenanceRuleId,
    ])
  ) {
    router.push({
      pathname: '/maintenance/[id]',
      params: { id: maintenanceRuleId },
    });
    return;
  }
  if (warrantyId && db?.getFirst('SELECT id FROM warranties WHERE id = ?', [warrantyId])) {
    router.push({ pathname: '/warranty/[id]', params: { id: warrantyId } });
    return;
  }
  if (itemId && db?.getFirst('SELECT id FROM items WHERE id = ?', [itemId])) {
    router.push({ pathname: '/item/[id]', params: { id: itemId } });
    return;
  }
  router.push('/(tabs)');
}

export function useNotificationNavigation(db: SqlDatabase | null): void {
  const router = useRouter();

  useEffect(() => {
    if (!db) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotificationData(
        router,
        db,
        response.notification.request.content.data as Record<string, unknown>,
      );
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigateFromNotificationData(
          router,
          db,
          response.notification.request.content.data as Record<string, unknown>,
        );
      }
    });

    return () => sub.remove();
  }, [router, db]);
}
