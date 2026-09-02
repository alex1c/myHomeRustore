/**
 * Notification adapter — testable abstraction over expo-notifications.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const ANDROID_CHANNEL_ID = 'home-reminders';

export interface ScheduleNotificationInput {
  title: string;
  body: string;
  fireAt: Date;
  data?: Record<string, string>;
}

export interface NotificationAdapter {
  ensurePermission(): Promise<boolean>;
  schedule(input: ScheduleNotificationInput): Promise<string>;
  cancel(notificationId: string): Promise<void>;
}

/** Configure foreground notification presentation once at module load. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class ExpoNotificationAdapter implements NotificationAdapter {
  async ensurePermission(): Promise<boolean> {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted === true;
  }

  async schedule(input: ScheduleNotificationInput): Promise<string> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Напоминания',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    return Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: input.fireAt,
        channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
      },
    });
  }

  async cancel(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
}

/** In-memory adapter for unit tests. */
export class MockNotificationAdapter implements NotificationAdapter {
  readonly scheduled: (ScheduleNotificationInput & { id: string })[] = [];
  readonly cancelled: string[] = [];
  permissionGranted = true;
  private counter = 0;

  async ensurePermission(): Promise<boolean> {
    return this.permissionGranted;
  }

  async schedule(input: ScheduleNotificationInput): Promise<string> {
    const id = `mock-notif-${++this.counter}`;
    this.scheduled.push({ ...input, id });
    return id;
  }

  async cancel(notificationId: string): Promise<void> {
    this.cancelled.push(notificationId);
  }

  reset(): void {
    this.scheduled.length = 0;
    this.cancelled.length = 0;
    this.counter = 0;
    this.permissionGranted = true;
  }
}
