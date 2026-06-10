import AsyncStorage from '@react-native-async-storage/async-storage';
import { LearningEntry, StreakData, AppSettings, EarnedBadge } from '../types';

const KEYS = {
  ENTRIES: 'learnstreak:entries',
  STREAK: 'learnstreak:streak',
  SETTINGS: 'learnstreak:settings',
  BADGES: 'learnstreak:badges',
};

// ── Entries ──────────────────────────────────────────────────────────────────

export async function getAllEntries(): Promise<LearningEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ENTRIES);
    if (!raw) return [];
    const entries: LearningEntry[] = JSON.parse(raw);
    return entries.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function getEntryByDate(date: string): Promise<LearningEntry | null> {
  const entries = await getAllEntries();
  return entries.find((e) => e.date === date) ?? null;
}

export async function saveEntry(entry: LearningEntry): Promise<void> {
  const entries = await getAllEntries();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  await AsyncStorage.setItem(KEYS.ENTRIES, JSON.stringify(entries));
}

export async function deleteEntry(id: string): Promise<void> {
  const entries = await getAllEntries();
  const filtered = entries.filter((e) => e.id !== id);
  await AsyncStorage.setItem(KEYS.ENTRIES, JSON.stringify(filtered));
}

// ── Streak ───────────────────────────────────────────────────────────────────

export const DEFAULT_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastLoggedDate: null,
  totalDaysLogged: 0,
};

export async function getStreak(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.STREAK);
    if (!raw) return DEFAULT_STREAK;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_STREAK;
  }
}

export async function updateStreak(todayDate: string): Promise<StreakData> {
  const streak = await getStreak();
  const yesterday = getPreviousDate(todayDate);

  let newStreak: StreakData;

  if (streak.lastLoggedDate === todayDate) {
    // Already logged today — no change
    return streak;
  } else if (streak.lastLoggedDate === yesterday) {
    // Consecutive — extend streak
    newStreak = {
      currentStreak: streak.currentStreak + 1,
      longestStreak: Math.max(streak.longestStreak, streak.currentStreak + 1),
      lastLoggedDate: todayDate,
      totalDaysLogged: streak.totalDaysLogged + 1,
    };
  } else {
    // Streak broken — reset to 1
    newStreak = {
      currentStreak: 1,
      longestStreak: Math.max(streak.longestStreak, 1),
      lastLoggedDate: todayDate,
      totalDaysLogged: streak.totalDaysLogged + 1,
    };
  }

  await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(newStreak));
  return newStreak;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  notificationTime: '20:00',
  notificationsEnabled: true,
  githubToken: '',
  githubRepo: '',
  userName: 'Learner',
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
}

// ── Badges ───────────────────────────────────────────────────────────────────

export async function getEarnedBadges(): Promise<EarnedBadge[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.BADGES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function awardBadge(badgeId: string, streakCount: number): Promise<void> {
  const badges = await getEarnedBadges();
  if (badges.find((b) => b.badgeId === badgeId)) return; // already earned
  badges.push({ badgeId, earnedAt: Date.now(), streakAtEarning: streakCount });
  await AsyncStorage.setItem(KEYS.BADGES, JSON.stringify(badges));
}

export async function checkAndAwardBadges(streak: StreakData): Promise<string[]> {
  const { BADGE_DEFINITIONS } = await import('../constants/theme');
  const earned = await getEarnedBadges();
  const earnedIds = earned.map((b) => b.badgeId);
  const newlyEarned: string[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (!earnedIds.includes(badge.id) && streak.currentStreak >= badge.requiredDays) {
      await awardBadge(badge.id, streak.currentStreak);
      newlyEarned.push(badge.id);
    }
  }
  return newlyEarned;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function getPreviousDate(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export function formatDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
