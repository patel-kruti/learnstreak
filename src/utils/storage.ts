import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, Category, CategoryStat, DaySummary, EarnedBadge, LearningEntry, StreakData, StreakFreezeData } from '../types';

const KEYS = {
  ENTRIES: 'learnstreak:entries',
  STREAK:  'learnstreak:streak',
  SETTINGS:'learnstreak:settings',
  BADGES:  'learnstreak:badges',
  FREEZES: 'learnstreak:freezes',
};

const MAX_FREEZES = 3;

// ── Entries ───────────────────────────────────────────────────────────────────

export async function getAllEntries(): Promise<LearningEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ENTRIES);
    if (!raw) return [];
    const entries: LearningEntry[] = JSON.parse(raw);
    // Sort newest-first by createdAt
    return entries.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

// Returns ALL entries for a given date (multiple sessions possible now).
// Previously returned a single entry — callers that needed "did user log today"
// should use hasEntryForDate() instead.
export async function getEntriesForDate(date: string): Promise<LearningEntry[]> {
  const entries = await getAllEntries();
  return entries.filter((e) => e.date === date);
}

// Convenience: did the user log anything today?
export async function hasEntryForDate(date: string): Promise<boolean> {
  const entries = await getEntriesForDate(date);
  return entries.length > 0;
}

// Save or update a single entry by id.
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

// ── Derived aggregations (computed, never stored) ─────────────────────────────

// Returns per-day summaries for ALL entries, or filtered by date range.
// Used by: heatmap (needs every logged date), line chart (needs daily totals).
export async function getDaySummaries(
  fromDate?: string,
  toDate?: string
): Promise<DaySummary[]> {
  const entries = await getAllEntries();

  // Group entries by date
  const byDate: Record<string, LearningEntry[]> = {};
  for (const e of entries) {
    if (fromDate && e.date < fromDate) continue;
    if (toDate   && e.date > toDate)   continue;
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }

  // Collapse each date group into a DaySummary
  return Object.entries(byDate)
    .map(([date, dayEntries]) => ({
      date,
      totalMinutes: dayEntries.reduce((sum, e) => sum + e.duration, 0),
      entryCount:   dayEntries.length,
      categories:   [...new Set(dayEntries.map((e) => e.category))],
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1)); // oldest-first for charts
}

// Returns categories ranked by total time spent, with percentages.
// Used by: Summary tab category breakdown and ranking.
export async function getCategoryStats(
  fromDate?: string,
  toDate?: string
): Promise<CategoryStat[]> {
  const entries = await getAllEntries();

  const filtered = entries.filter((e) => {
    if (fromDate && e.date < fromDate) return false;
    if (toDate   && e.date > toDate)   return false;
    return true;
  });

  // Accumulate per-category totals
  const totals: Record<string, { minutes: number; count: number }> = {};
  for (const e of filtered) {
    if (!totals[e.category]) totals[e.category] = { minutes: 0, count: 0 };
    totals[e.category].minutes += e.duration;
    totals[e.category].count   += 1;
  }

  const grandTotal = Object.values(totals).reduce((s, v) => s + v.minutes, 0);

  return Object.entries(totals)
    .map(([category, { minutes, count }]) => ({
      category: category as Category,
      totalMinutes: minutes,
      entryCount: count,
      percentage: grandTotal > 0 ? Math.round((minutes / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes); // highest time first
}

// ── Streak ────────────────────────────────────────────────────────────────────
// Streak logic is unchanged — a "day" counts as logged if ANY entry exists for it.

// ── Streak freeze ─────────────────────────────────────────────────────────────

export const DEFAULT_FREEZE_DATA: StreakFreezeData = {
  freezesAvailable: 0,
  frozenDates: [],
};

export async function getFreezeData(): Promise<StreakFreezeData> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.FREEZES);
    if (!raw) return { ...DEFAULT_FREEZE_DATA };
    return { ...DEFAULT_FREEZE_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_FREEZE_DATA };
  }
}

async function saveFreezeData(data: StreakFreezeData): Promise<void> {
  await AsyncStorage.setItem(KEYS.FREEZES, JSON.stringify(data));
}

// ── Streak ────────────────────────────────────────────────────────────────────

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

// Call this after saving the FIRST entry for a given date.
// If the user logs a second session on the same day, don't call this again
// (streak.lastLoggedDate === todayDate guard handles it).
export async function updateStreak(todayDate: string): Promise<StreakData> {
  const [streak, freezeData] = await Promise.all([getStreak(), getFreezeData()]);
  const yesterday = getPreviousDate(todayDate);

  // Already counted today — adding more sessions doesn't change the streak
  if (streak.lastLoggedDate === todayDate) return streak;

  const prevStreakCount = streak.currentStreak;
  let newStreak: StreakData;

  if (streak.lastLoggedDate === yesterday) {
    // Consecutive day
    newStreak = {
      currentStreak:  streak.currentStreak + 1,
      longestStreak:  Math.max(streak.longestStreak, streak.currentStreak + 1),
      lastLoggedDate: todayDate,
      totalDaysLogged: streak.totalDaysLogged + 1,
    };
  } else if (streak.lastLoggedDate !== null) {
    // Gap detected — try to bridge with available freezes
    const missedDays = daysBetween(streak.lastLoggedDate, todayDate) - 1;
    if (missedDays > 0 && missedDays <= freezeData.freezesAvailable) {
      for (let i = 1; i <= missedDays; i++) {
        const fd = addDays(streak.lastLoggedDate, i);
        if (!freezeData.frozenDates.includes(fd)) freezeData.frozenDates.push(fd);
      }
      freezeData.freezesAvailable -= missedDays;
      newStreak = {
        currentStreak:  streak.currentStreak + 1,
        longestStreak:  Math.max(streak.longestStreak, streak.currentStreak + 1),
        lastLoggedDate: todayDate,
        totalDaysLogged: streak.totalDaysLogged + 1,
      };
    } else {
      // Too many days missed or no freezes — streak resets
      newStreak = {
        currentStreak:  1,
        longestStreak:  Math.max(streak.longestStreak, 1),
        lastLoggedDate: todayDate,
        totalDaysLogged: streak.totalDaysLogged + 1,
      };
    }
  } else {
    // First ever entry
    newStreak = {
      currentStreak:  1,
      longestStreak:  Math.max(streak.longestStreak, 1),
      lastLoggedDate: todayDate,
      totalDaysLogged: streak.totalDaysLogged + 1,
    };
  }

  // Award a freeze at each 7-day streak milestone (up to MAX_FREEZES)
  if (
    Math.floor(newStreak.currentStreak / 7) > Math.floor(prevStreakCount / 7) &&
    freezeData.freezesAvailable < MAX_FREEZES
  ) {
    freezeData.freezesAvailable++;
  }

  await Promise.all([
    AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(newStreak)),
    saveFreezeData(freezeData),
  ]);
  return newStreak;
}

// Recalculates streak from scratch by scanning all stored entries.
// Call this after deleting the last session for a given day — the stored
// streak counter may now be wrong (it counted that day), so we rebuild it
// by walking every logged date in chronological order.
export async function recalculateStreakAfterDeletion(): Promise<StreakData> {
  const [entries, freezeData] = await Promise.all([getAllEntries(), getFreezeData()]);

  const entryDates = [...new Set(entries.map((e) => e.date))];

  if (entryDates.length === 0) {
    const reset = DEFAULT_STREAK;
    await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(reset));
    return reset;
  }

  // Merge real entry dates with frozen dates for the streak walk
  const allDates = [...new Set([...entryDates, ...freezeData.frozenDates])].sort();

  let longestStreak = 1;
  let tempStreak    = 1;

  for (let i = 1; i < allDates.length; i++) {
    const prev = new Date(allDates[i - 1] + 'T12:00:00');
    const curr = new Date(allDates[i]     + 'T12:00:00');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);

    if (diffDays === 1) {
      tempStreak += 1;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // Current streak is only active if the last date is today or yesterday
  const today     = getTodayDate();
  const yesterday = getPreviousDate(today);
  const lastDate  = allDates[allDates.length - 1];
  const currentStreak = (lastDate === today || lastDate === yesterday) ? tempStreak : 0;

  const newStreak: StreakData = {
    currentStreak,
    longestStreak,
    lastLoggedDate:  lastDate,
    totalDaysLogged: entryDates.length, // frozen days don't count as logged days
  };

  await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(newStreak));
  return newStreak;
}

// ── Settings ──────────────────────────────────────────────────────────────────

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
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }));
}

// ── Badges ────────────────────────────────────────────────────────────────────

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
  if (badges.find((b) => b.badgeId === badgeId)) return;
  badges.push({ badgeId, earnedAt: Date.now(), streakAtEarning: streakCount });
  await AsyncStorage.setItem(KEYS.BADGES, JSON.stringify(badges));
}

export async function checkAndAwardBadges(streak: StreakData): Promise<string[]> {
  const { BADGE_DEFINITIONS } = await import('../constants/theme');
  const earned    = await getEarnedBadges();
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

// ── Pending edit handoff ─────────────────────────────────────────────────────
// Used when the History tab wants to edit a past session.
// It stores the entry here, navigates to the Add tab, which reads and clears it.

const PENDING_EDIT_KEY = 'learnstreak:pendingEdit';

export async function setPendingEdit(entry: LearningEntry): Promise<void> {
  await AsyncStorage.setItem(PENDING_EDIT_KEY, JSON.stringify(entry));
}

export async function getPendingEdit(): Promise<LearningEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_EDIT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearPendingEdit(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_EDIT_KEY);
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

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T12:00:00');
  const b = new Date(dateB + 'T12:00:00');
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000);
}
