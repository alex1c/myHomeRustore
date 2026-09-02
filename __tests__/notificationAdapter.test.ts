import * as Notifications from 'expo-notifications';

import { ExpoNotificationAdapter } from '@/src/services/notificationAdapter';

describe('ExpoNotificationAdapter permissions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('does not request permission again after denial', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      status: 'denied',
      canAskAgain: true,
    });

    await expect(new ExpoNotificationAdapter().ensurePermission()).resolves.toBe(false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  test('requests permission while status is undetermined', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      status: 'undetermined',
      canAskAgain: true,
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

    await expect(new ExpoNotificationAdapter().ensurePermission()).resolves.toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});
