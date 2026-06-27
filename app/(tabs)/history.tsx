import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CATEGORIES, COLORS, FONTS, RADIUS, SPACING } from '../../src/constants/theme';
import { CustomCategory, LearningEntry } from '../../src/types';
import {
  deleteEntry,
  formatMinutes,
  getAllEntries,
  getCustomCategories,
  getEntriesForDate,
  getTodayDate,
  recalculateStreakAfterDeletion,
  setPendingEdit,
} from '../../src/utils/storage';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayGroup {
  date: string;          // YYYY-MM-DD
  sessions: LearningEntry[];
  totalMinutes: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByDate(entries: LearningEntry[]): DayGroup[] {
  const map: Record<string, LearningEntry[]> = {};
  for (const e of entries) {
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push(e);
  }
  return Object.entries(map)
    .map(([date, sessions]) => ({
      date,
      sessions: sessions.sort((a, b) => a.createdAt - b.createdAt), // chronological within day
      totalMinutes: sessions.reduce((s, e) => s + e.duration, 0),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest day first
}

function groupByMonth(days: DayGroup[]): Record<string, DayGroup[]> {
  const map: Record<string, DayGroup[]> = {};
  for (const day of days) {
    const d   = new Date(day.date + 'T12:00:00');
    // Key format: "YYYY-MM" so we can sort correctly
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = [];
    map[key].push(day);
  }
  return map;
}

function monthKeyToLabel(key: string): string {
  const [year, month] = key.split('-');
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' });
}

function shortDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

// Cross-platform delete confirm (Alert.alert is no-op on web)
async function confirmDelete(message: string): Promise<boolean> {
  if (Platform.OS === 'web') return window.confirm(message);
  return new Promise((resolve) =>
    Alert.alert('Delete session?', message, [
      { text: 'Cancel',  style: 'cancel',     onPress: () => resolve(false) },
      { text: 'Delete',  style: 'destructive', onPress: () => resolve(true)  },
    ])
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const [entries, setEntries]           = useState<LearningEntry[]>([]);
  const [search, setSearch]             = useState('');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
      getCustomCategories().then(setCustomCategories);
    }, [])
  );

  async function loadEntries() {
    const all = await getAllEntries();
    setEntries(all);
  }

  function lookupCat(id: string) {
    return CATEGORIES.find((c) => c.id === id) ?? customCategories.find((c) => c.id === id);
  }

  async function handleDeleteSession(session: LearningEntry) {
    const confirmed = await confirmDelete(`Remove "${session.title}"?`);
    if (!confirmed) return;

    await deleteEntry(session.id);

    // If it was the last session on that day, recalculate streak
    const remaining = await getEntriesForDate(session.date);
    if (remaining.length === 0) {
      await recalculateStreakAfterDeletion();
    }

    await loadEntries();
  }

  // Filter across title, description, date, and category label
  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const catLabel = lookupCat(e.category)?.label ?? '';
    return (
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.date.includes(q) ||
      catLabel.toLowerCase().includes(q)
    );
  });

  async function handleEditSession(session: LearningEntry) {
    await setPendingEdit(session);
    // Use push to the index tab — navigate() can silently fail on some
    // Expo Router versions when the target is already in the tab stack
    router.push('/');
  }

  const today      = getTodayDate();
  const dayGroups  = groupByDate(filtered);
  const byMonth    = groupByMonth(dayGroups);
  const monthKeys  = Object.keys(byMonth).sort((a, b) => (a < b ? 1 : -1)); // newest first

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>📋 History</Text>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={[styles.searchInput, search.length > 0 && styles.searchInputWithClear]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by title, category, date..."
          placeholderTextColor={COLORS.textTertiary}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity
            style={styles.searchClearBtn}
            onPress={() => setSearch('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.searchClearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {entries.length === 0 ? (
        <EmptyState emoji="📭" text="No entries yet." sub="Go to Add tab to log your first day!" />
      ) : dayGroups.length === 0 ? (
        <EmptyState emoji="🔍" text="No results." sub="Try a different search term." />
      ) : (
        monthKeys.map((monthKey) => (
          <View key={monthKey}>
            {/* Month header */}
            <View style={styles.monthHeader}>
              <Text style={styles.monthLabel}>{monthKeyToLabel(monthKey)}</Text>
              <Text style={styles.monthCount}>
                {byMonth[monthKey].length} day{byMonth[monthKey].length !== 1 ? 's' : ''}
              </Text>
            </View>

            {byMonth[monthKey].map((day) => (
              <DayCard
                key={day.date}
                day={day}
                isToday={day.date === today}
                expanded={expandedDate === day.date}
                onPress={() => setExpandedDate(expandedDate === day.date ? null : day.date)}
                onDeleteSession={handleDeleteSession}
                onEditSession={handleEditSession}
                customCategories={customCategories}
              />
            ))}
          </View>
        ))
      )}

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

// ── Day card — groups all sessions for one date ───────────────────────────────

function DayCard({
  day,
  isToday,
  expanded,
  onPress,
  onDeleteSession,
  onEditSession,
  customCategories,
}: {
  day: DayGroup;
  isToday: boolean;
  expanded: boolean;
  onPress: () => void;
  onDeleteSession: (s: LearningEntry) => void;
  onEditSession: (s: LearningEntry) => void;
  customCategories: CustomCategory[];
}) {
  // Unique categories across sessions for the summary chips
  const uniqueCats = [...new Set(day.sessions.map((s) => s.category))];

  function lookupCat(id: string) {
    return CATEGORIES.find((c) => c.id === id) ?? customCategories.find((c) => c.id === id);
  }

  return (
    <View style={[styles.dayCard, isToday && styles.dayCardToday]}>

      {/* ── Day header — always visible, tap to expand ── */}
      <TouchableOpacity
        style={styles.dayHeader}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Date box */}
        <View style={[styles.dateBox, isToday && styles.dateBoxToday]}>
          <Text style={[styles.dateDay, isToday && styles.dateDayToday]}>
            {day.date.split('-')[2]}
          </Text>
          <Text style={[styles.dateMon, isToday && styles.dateMonToday]}>
            {new Date(day.date + 'T12:00:00').toLocaleString('default', { month: 'short' })}
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.daySummary}>
          <Text style={styles.dayDateFull}>{shortDate(day.date)}</Text>

          {/* Category chips — collapsed view */}
          <View style={styles.catChips}>
            {uniqueCats.map((cat) => {
              const catDef = lookupCat(cat);
              return (
                <View key={cat} style={styles.miniChip}>
                  <Text style={styles.miniChipText}>{catDef?.emoji} {catDef?.label ?? cat}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Right side: total time + session count + chevron */}
        <View style={styles.dayRight}>
          <Text style={styles.dayTotal}>{formatMinutes(day.totalMinutes)}</Text>
          <Text style={styles.daySessionCount}>
            {day.sessions.length} session{day.sessions.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Expanded: individual sessions ── */}
      {expanded && (
        <View style={styles.sessionList}>
          {day.sessions.map((session, idx) => (
            <SessionRow
              key={session.id}
              session={session}
              isLast={idx === day.sessions.length - 1}
              onDelete={() => onDeleteSession(session)}
              onEdit={() => onEditSession(session)}
              customCategories={customCategories}
            />
          ))}

          {/* Day total footer */}
          <View style={styles.dayFooter}>
            <Text style={styles.dayFooterLabel}>Total</Text>
            <Text style={styles.dayFooterValue}>{formatMinutes(day.totalMinutes)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Individual session row inside an expanded day ─────────────────────────────

function SessionRow({
  session,
  isLast,
  onDelete,
  onEdit,
  customCategories,
}: {
  session: LearningEntry;
  isLast: boolean;
  onDelete: () => void;
  onEdit: () => void;
  customCategories: CustomCategory[];
}) {
  const catDef = CATEGORIES.find((c) => c.id === session.category)
    ?? customCategories.find((c) => c.id === session.category);

  return (
    <View style={[styles.sessionRow, !isLast && styles.sessionRowBorder]}>
      <View style={styles.sessionLeft}>
        {/* Category pill */}
        <View style={styles.sessionCatChip}>
          <Text style={styles.sessionCatEmoji}>{catDef?.emoji}</Text>
          <Text style={styles.sessionCatLabel}>{catDef?.label ?? session.category}</Text>
        </View>
        <Text style={styles.sessionTitle}>{session.title}</Text>
        {session.description ? (
          <Text style={styles.sessionDesc} numberOfLines={2}>{session.description}</Text>
        ) : null}
      </View>

      <View style={styles.sessionRight}>
        <Text style={styles.sessionDuration}>{formatMinutes(session.duration)}</Text>
        <View style={styles.sessionActions}>
          <TouchableOpacity
            onPress={onEdit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.sessionEdit}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.sessionDelete}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ emoji, text, sub }: { emoji: string; text: string; sub: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      <Text style={styles.emptySubtext}>{sub}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content:   { padding: SPACING.md },

  heading: {
    fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary, marginBottom: SPACING.md,
  },

  searchWrap:           { position: 'relative', marginBottom: SPACING.md },
  searchInput: {
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md, padding: SPACING.md,
    fontSize: FONTS.sizes.md, color: COLORS.textPrimary,
    backgroundColor: COLORS.offWhite,
  },
  searchInputWithClear: { paddingRight: 52 },
  searchClearBtn:       { position: 'absolute', right: SPACING.sm, top: '50%' as any, marginTop: -18, width: 36, height: 36, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center' },
  searchClearIcon:      { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' as const },

  // Month section
  monthHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  monthLabel: {
    fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  monthCount: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },

  // Day card
  dayCard: {
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md, marginBottom: SPACING.sm,
    backgroundColor: COLORS.white, overflow: 'hidden',
  },
  dayCardToday: { borderColor: COLORS.black, borderWidth: 2 },

  // Day header
  dayHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, gap: SPACING.sm,
  },

  // Date box
  dateBox: {
    width: 44, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.sm, paddingVertical: 4,
  },
  dateBoxToday: { borderColor: COLORS.black, backgroundColor: COLORS.black },
  dateDay:      { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, lineHeight: 22 },
  dateDayToday: { color: COLORS.white },
  dateMon:      { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },
  dateMonToday: { color: COLORS.white },

  // Day summary (middle column)
  daySummary:   { flex: 1, gap: 4 },
  dayDateFull:  { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },
  catChips:     { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  miniChip: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  miniChipText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },

  // Day right column
  dayRight:        { alignItems: 'flex-end', gap: 2 },
  dayTotal:        { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  daySessionCount: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },
  chevron:         { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },

  // Session list (expanded)
  sessionList: {
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.offWhite,
  },
  sessionRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  sessionRowBorder: {
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  sessionLeft:    { flex: 1, gap: 3 },
  sessionCatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.white, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  sessionCatEmoji: { fontSize: 11 },
  sessionCatLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },
  sessionTitle:    { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  sessionDesc:     { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, lineHeight: 16 },

  sessionRight:   { alignItems: 'flex-end', gap: 6, paddingTop: 2 },
  sessionDuration: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  sessionActions: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  sessionEdit:    { fontSize: 13 },
  sessionDelete:  { fontSize: 13, color: COLORS.textTertiary, fontWeight: FONTS.weights.bold },

  // Day footer
  dayFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  dayFooterLabel: {
    fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  dayFooterValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },

  // Empty states
  emptyState:   { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyEmoji:   { fontSize: 48, marginBottom: SPACING.md },
  emptyText:    { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  emptySubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 4 },
});
