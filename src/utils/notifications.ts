import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getSettings } from './storage';

// expo-notifications' DevicePushTokenAutoRegistration.fx.js runs as a side-effect
// the moment the package is require()'d. In Expo Go (SDK 53+) this throws an error
// because remote push notifications were removed. Guard the require() so the module
// never loads — and the side-effect never runs — in unsupported environments.
const IS_WEB     = Platform.OS === 'web';
const IS_EXPO_GO = Constants.appOwnership === 'expo';
const SUPPORTED  = !IS_WEB && !IS_EXPO_GO;

// eslint-disable-next-line @typescript-eslint/no-require-imports
type N = typeof import('expo-notifications');
const Notifications: N | null = SUPPORTED ? require('expo-notifications') : null;

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldPlaySound:  true,
      shouldSetBadge:   true,
      shouldShowBanner: true,
      shouldShowList:   true,
    }),
  });
}

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!Notifications) return 'denied';
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return 'granted';
  if (existing === 'denied')  return 'denied';
  const { status } = await Notifications.requestPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export async function scheduleDailyReminder(timeString: string): Promise<void> {
  if (!Notifications) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const [hourStr, minStr] = timeString.split(':');
  const hour   = Math.min(23, Math.max(0, parseInt(hourStr, 10)));
  const minute = Math.min(59, Math.max(0, parseInt(minStr,  10)));

  const settings = await getSettings();
  const name     = settings.userName || 'Learner';

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
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ── Verification ──────────────────────────────────────────────────────────────

export async function getScheduledNotifications(): Promise<unknown[]> {
  if (!Notifications) return [];
  return Notifications.getAllScheduledNotificationsAsync();
}

// ── Milestone celebration ─────────────────────────────────────────────────────

export async function scheduleStreakCelebration(streak: number): Promise<void> {
  if (!Notifications) return;

  const messages: Record<number, { title: string; body: string }> = {
    7:   { title: '🔥 7-day streak!',  body: "You're a Week Warrior! Keep going!" },
    14:  { title: '⚡ 14 days!',        body: 'Two weeks strong — amazing consistency!' },
    30:  { title: '💎 30-day streak!', body: "Monthly Master unlocked! You're incredible!" },
    100: { title: '🦉 100 DAYS!',      body: 'Century Scholar! You are absolutely legendary!' },
    365: { title: '🏆 365 DAYS!',      body: 'A FULL YEAR! You are the Legendary Learner!' },
  };

  const msg = messages[streak];
  if (!msg) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `milestone-${streak}`,
    content: { title: msg.title, body: msg.body, sound: true, badge: 0 },
    trigger: null,
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export type SetupResult =
  | { ok: true;  scheduled: number }
  | { ok: false; reason: 'web' | 'expo_go' | 'disabled' | 'permission_denied' | 'permission_undetermined' | 'error'; message: string };

export async function setupNotificationsFromSettings(): Promise<SetupResult> {
  if (IS_WEB) {
    return { ok: false, reason: 'web', message: 'Notifications are not supported in the browser.' };
  }
  if (IS_EXPO_GO) {
    return { ok: false, reason: 'expo_go', message: 'Notifications require a development build, not Expo Go.' };
  }

  try {
    const settings = await getSettings();

    if (!settings.notificationsEnabled) {
      await cancelAllNotifications();
      return { ok: false, reason: 'disabled', message: 'Notifications are turned off in settings.' };
    }

    const permStatus = await requestNotificationPermission();

    if (permStatus === 'denied') {
      return {
        ok: false,
        reason: 'permission_denied',
        message: 'Notification permission was denied. Open phone Settings → LearnStreak → Notifications to enable.',
      };
    }

    if (permStatus === 'undetermined') {
      return {
        ok: false,
        reason: 'permission_undetermined',
        message: 'Notification permission not yet granted.',
      };
    }

    await scheduleDailyReminder(settings.notificationTime);
    const scheduled = await getScheduledNotifications();
    return { ok: true, scheduled: (scheduled as any[]).length };

  } catch (e: any) {
    return { ok: false, reason: 'error', message: e?.message ?? 'Unknown error.' };
  }
}
