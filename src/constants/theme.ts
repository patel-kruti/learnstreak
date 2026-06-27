export const COLORS = {
  // Core - Google Pixel-inspired
  white: '#FFFFFF',
  black: '#0A0A0A',
  offWhite: '#F8F8F8',
  surface: '#F2F2F2',

  // Borders - clean and crisp
  border: '#1A1A1A',
  borderLight: '#E0E0E0',
  borderMid: '#BDBDBD',

  // Accent - single bold accent (Google blue-ish but more Pixel-y)
  accent: '#1A73E8',
  accentLight: '#E8F0FE',
  accentDark: '#1557B0',

  // Streak / fire
  streak: '#FF6D00',
  streakLight: '#FFF3E0',

  // Success / logged
  success: '#188038',
  successLight: '#E6F4EA',

  // Warning
  warning: '#F9AB00',
  warningLight: '#FEF7E0',

  // Danger
  danger: '#D93025',
  dangerLight: '#FCE8E6',

  // Category colors
  categories: {
    coding: '#1A73E8',
    language: '#0F9D58',
    reading: '#F4511E',
    math: '#AB47BC',
    science: '#00ACC1',
    design: '#FB8C00',
    sports: '#FBC02D',
    other: '#757575',
  },

  // Text
  textPrimary: '#0A0A0A',
  textSecondary: '#5F6368',
  textTertiary: '#9AA0A6',
  textOnDark: '#FFFFFF',
};

export const FONTS = {
  regular: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 22,
    xxl: 28,
    hero: 36,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SHADOWS = {
  none: {},
  // Pixel style: no blur, just border
};

export const BADGE_DEFINITIONS = [
  {
    id: 'first_day',
    emoji: '🌱',
    title: 'First Step',
    description: 'Logged your very first day',
    requiredDays: 1,
  },
  {
    id: 'week_warrior',
    emoji: '🔥',
    title: 'Week Warrior',
    description: '7-day streak achieved',
    requiredDays: 7,
  },
  {
    id: 'two_weeks',
    emoji: '⚡',
    title: 'Fortnight Flash',
    description: '14 days in a row',
    requiredDays: 14,
  },
  {
    id: 'monthly_master',
    emoji: '💎',
    title: 'Monthly Master',
    description: '30-day streak — incredible!',
    requiredDays: 30,
  },
  {
    id: 'golden_learner',
    emoji: '🦉',
    title: 'Century Scholar',
    description: '100-day streak legend',
    requiredDays: 100,
  },
  {
    id: 'legendary',
    emoji: '🏆',
    title: 'Legendary Learner',
    description: '365 days — you are unstoppable',
    requiredDays: 365,
  },
];

export const CATEGORIES = [
  { id: 'coding', label: 'Coding', emoji: '💻' },
  { id: 'language', label: 'Language', emoji: '🗣️' },
  { id: 'reading', label: 'Reading', emoji: '📖' },
  { id: 'math', label: 'Math', emoji: '🔢' },
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'design', label: 'Design', emoji: '🎨' },
  { id: 'sports', label: 'Sports', emoji: '🏅' },
  { id: 'other', label: 'Other', emoji: '✨' },
];

export const CUSTOM_CATEGORY_COLORS = [
  '#E91E63', '#9C27B0', '#3F51B5', '#0097A7',
  '#388E3C', '#F57C00', '#5D4037', '#455A64',
  '#C62828', '#1565C0',
];

export const EMOJI_PRESETS = [
  '🎯', '🚀', '💡', '🎮', '🎵', '🍳',
  '🏋️', '🧘', '🌿', '✈️', '🎭', '🧩',
  '🤝', '💼', '🌟', '🎸', '📝', '🔭',
  '🏄', '🧪', '🎤', '🖥️', '📷', '🎲',
];
