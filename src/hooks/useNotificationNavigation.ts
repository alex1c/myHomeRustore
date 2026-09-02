/**
 * Navigate when user taps a warranty reminder notification.
 */

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

function navigateFromNotificationData(
  router: ReturnType<typeof useRouter>,
  data: Record<string, unknown> | undefined,
): void {
  const warrantyId = typeof data?.warrantyId === 'string' ? data.warrantyId : null;
  const itemId = typeof data?.itemId === 'string' ? data.itemId : null;

  if (warrantyId) {
    router.push(`/warranty/${warrantyId}`);
    return;
  }
  if (itemId) {
    router.push(`/item/${itemId}`);
  }
}

export function useNotificationNavigation(): void {
  const router = useRouter();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotificationData(
        router,
        response.notification.request.content.data as Record<string, unknown>,
      );
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigateFromNotificationData(
          router,
          response.notification.request.content.data as Record<string, unknown>,
        );
      }
    });

    return () => sub.remove();
  }, [router]);
}
