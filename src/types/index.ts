export type Category =
  | 'coding'
  | 'language'
  | 'chess'
  | 'reading'
  | 'math'
  | 'science'
  | 'design'
  | 'sports'
  | 'other';

// ── Core entry — ONE category, duration required ──────────────────────────────
// Previously: one entry per day, categories was Category[], duration optional.
// Now: multiple entries per day allowed (one per learning session),
//      category is a single value, duration is required (minutes > 0).
//      This lets Summary rank categories by total time, not frequency.
export interface LearningEntry {
  id: string;
  date: string;        // YYYY-MM-DD
  category: Category;  // singular — was categories: Category[]
  title: string;
  description: string;
  duration: number;    // minutes — required, must be > 0
  createdAt: number;   // unix timestamp ms
}

// ── Aggregated view of one day — derived, never stored ────────────────────────
// Used by heatmap and line chart to get per-day totals without re-scanning
// all entries every render.
export interface DaySummary {
  date: string;         // YYYY-MM-DD
  totalMinutes: number; // sum of all entry durations that day
  entryCount: number;   // how many sessions logged
  categories: Category[]; // which categories appeared (for heatmap colour)
}

// ── Category time breakdown — derived, never stored ───────────────────────────
// Used by Summary tab to rank categories by time spent.
export interface CategoryStat {
  category: Category;
  totalMinutes: number;
  entryCount: number;
  percentage: number; // of total minutes in the selected range
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastLoggedDate: string | null; // YYYY-MM-DD
  totalDaysLogged: number;
}

export interface BadgeDefinition {
  id: string;
  emoji: string;
  title: string;
  description: string;
  requiredDays: number;
}

export interface EarnedBadge {
  badgeId: string;
  earnedAt: number;
  streakAtEarning: number;
}

export interface AppSettings {
  notificationTime: string; // "HH:MM"
  notificationsEnabled: boolean;
  githubToken: string;
  githubRepo: string; // "username/repo"
  userName: string;
}

export interface StreakFreezeData {
  freezesAvailable: number; // 0–3
  frozenDates: string[];    // YYYY-MM-DD dates protected by a freeze
}
