import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSettings } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder(timeString: string): Promise<void> {
  // Cancel existing
  await cancelAllNotifications();

  const [hourStr, minStr] = timeString.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);

  const settings = await getSettings();
  const name = settings.userName || 'Learner';

  // Main daily reminder
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-reminder',
    content: {
      title: `📚 Time to learn, ${name}!`,
      body: "Don't break your streak — log today's learning ✨",
      sound: true,
      badge: 1,
      data: { screen: 'add' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  // Streak-at-risk alert: 30 min before midnight if they haven't logged
  await Notifications.scheduleNotificationAsync({
    identifier: 'streak-alert',
    content: {
      title: '🔥 Your streak is at risk!',
      body: "Only 30 minutes left today — keep your streak alive! 💪",
      sound: true,
      badge: 1,
      data: { screen: 'add' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 23,
      minute: 30,
    },
  });
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleStreakCelebration(streak: number): Promise<void> {
  // Immediate local notification when a milestone is hit
  const messages: Record<number, { title: string; body: string }> = {
    7:   { title: '🔥 7-day streak!', body: "You're a Week Warrior! Keep going!" },
    14:  { title: '⚡ 14 days!', body: 'Two weeks strong — amazing consistency!' },
    30:  { title: '💎 30-day streak!', body: "Monthly Master unlocked! You're incredible!" },
    100: { title: '🦉 100 DAYS!', body: 'Century Scholar! You are absolutely legendary!' },
    365: { title: '🏆 365 DAYS!', body: 'A FULL YEAR! You are the Legendary Learner!' },
  };

  const msg = messages[streak];
  if (!msg) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `milestone-${streak}`,
    content: {
      title: msg.title,
      body: msg.body,
      sound: true,
      badge: 0,
    },
    trigger: null, // immediate
  });
}

export async function setupNotificationsFromSettings(): Promise<void> {
  const settings = await getSettings();
  if (!settings.notificationsEnabled) {
    await cancelAllNotifications();
    return;
  }
  const granted = await requestNotificationPermission();
  if (granted) {
    await scheduleDailyReminder(settings.notificationTime);
  }
}
