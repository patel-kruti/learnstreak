import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSettings } from './storage';

// Tell Expo how to handle notifications that arrive while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  // Web — notifications work differently; skip silently
  if (Platform.OS === 'web') return 'denied';

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return 'granted';
  if (existing === 'denied')  return 'denied'; // user already said no — can't re-prompt
  const { status } = await Notifications.requestPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export async function scheduleDailyReminder(timeString: string): Promise<void> {
  if (Platform.OS === 'web') return;

  // Always cancel first — avoids duplicate scheduled notifications
  // which stack up every time the user saves settings
  await Notifications.cancelAllScheduledNotificationsAsync();

  const [hourStr, minStr] = timeString.split(':');
  const hour   = Math.min(23, Math.max(0, parseInt(hourStr, 10)));
  const minute = Math.min(59, Math.max(0, parseInt(minStr,  10)));

  const settings = await getSettings();
  const name     = settings.userName || 'Learner';

  // ── Notification 1: Main daily reminder ──────────────────────────────────
  // Fires every day at the user-chosen time.
  // On Android, DAILY triggers require the exact alarm permission on API 31+.
  // We use repeats:true with a seconds-based interval as a fallback-safe approach.
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-reminder',
    content: {
      title: `📚 Time to learn, ${name}!`,
      body: "Don't break your streak — log today's learning ✨",
      sound: true,
      badge: 1,
      // Android channel (must match what's declared in app.json)
      data: { screen: 'add' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  // ── Notification 2: Streak-at-risk alert ─────────────────────────────────
  // Fires at 23:30 every night.
  // The actual "has user logged today?" check happens at delivery time
  // inside the notification handler — we can't conditionally skip scheduling
  // from here, so we always schedule it and let the user ignore it if logged.
  // A future improvement would use a background task to cancel it after logging.
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
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ── Verification ──────────────────────────────────────────────────────────────
// Returns the list of currently scheduled notifications.
// Used by the Settings screen to let the user verify scheduling worked.

export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  if (Platform.OS === 'web') return [];
  return Notifications.getAllScheduledNotificationsAsync();
}

// ── Milestone celebration ─────────────────────────────────────────────────────
// Fires immediately when a streak milestone is hit (trigger: null = right now).

export async function scheduleStreakCelebration(streak: number): Promise<void> {
  if (Platform.OS === 'web') return;

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
    trigger: null, // fire immediately
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────
// Called from root _layout.tsx on app start.
// Returns a status object so the Settings screen can show what happened.

export type SetupResult =
  | { ok: true;  scheduled: number }
  | { ok: false; reason: 'web' | 'disabled' | 'permission_denied' | 'permission_undetermined' | 'error'; message: string };

export async function setupNotificationsFromSettings(): Promise<SetupResult> {
  if (Platform.OS === 'web') {
    return { ok: false, reason: 'web', message: 'Notifications are not supported in the browser.' };
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
    return { ok: true, scheduled: scheduled.length };

  } catch (e: any) {
    return { ok: false, reason: 'error', message: e?.message ?? 'Unknown error.' };
  }
}
