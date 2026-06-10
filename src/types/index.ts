export type Category =
  | 'coding'
  | 'language'
  | 'reading'
  | 'math'
  | 'science'
  | 'design'
  | 'other';

export interface LearningEntry {
  id: string;
  date: string; // YYYY-MM-DD
  categories: Category[];
  title: string;
  description: string;
  duration: number; // minutes
  createdAt: number; // timestamp
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
  earnedAt: number; // timestamp
  streakAtEarning: number;
}

export interface AppSettings {
  notificationTime: string; // "HH:MM"
  notificationsEnabled: boolean;
  githubToken: string;
  githubRepo: string; // "username/repo"
  userName: string;
}

export interface DayStatus {
  date: string;
  hasEntry: boolean;
  isToday: boolean;
  isFuture: boolean;
}
