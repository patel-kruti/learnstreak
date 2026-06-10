import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { COLORS, FONTS, SPACING, RADIUS, CATEGORIES } from '../../src/constants/theme';
import { getAllEntries, getStreak, formatDate } from '../../src/utils/storage';
import { LearningEntry, StreakData } from '../../src/types';

type RangeKey = '1D' | '5D' | '1W' | '1M' | '1Y' | 'ALL';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '1D', label: '1D' },
  { key: '5D', label: '5D' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'All' },
];

function getDateRange(key: RangeKey): Date {
  const d = new Date();
  switch (key) {
    case '1D': d.setDate(d.getDate() - 1); break;
    case '5D': d.setDate(d.getDate() - 5); break;
    case '1W': d.setDate(d.getDate() - 7); break;
    case '1M': d.setMonth(d.getMonth() - 1); break;
    case '1Y': d.setFullYear(d.getFullYear() - 1); break;
    case 'ALL': return new Date(0);
  }
  return d;
}

export default function SummaryScreen() {
  const [range, setRange] = useState<RangeKey>('1W');
  const [entries, setEntries] = useState<LearningEntry[]>([]);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    const [all, s] = await Promise.all([getAllEntries(), getStreak()]);
    setEntries(all);
    setStreak(s);
    setLoading(false);
  }

  const cutoff = getDateRange(range);
  const filtered = entries.filter((e) => new Date(e.date + 'T12:00:00') >= cutoff);

  // Stats
  const totalMinutes = filtered.reduce((acc, e) => acc + (e.duration || 0), 0);
  const totalDays = filtered.length;
  const categoryCount: Record<string, number> = {};
  filtered.forEach((e) =>
    e.categories.forEach((c) => {
      categoryCount[c] = (categoryCount[c] || 0) + 1;
    })
  );
  const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>📊 Summary</Text>

      {/* Range selector */}
      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.rangeChip, range === opt.key && styles.rangeChipActive]}
            onPress={() => setRange(opt.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.rangeLabel, range === opt.key && styles.rangeLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xxl }} color={COLORS.black} />
      ) : (
        <>
          {/* Stat cards */}
          <View style={styles.statGrid}>
            <StatCard label="Days logged" value={String(totalDays)} emoji="📅" />
            <StatCard
              label="Time invested"
              value={totalMinutes >= 60 ? `${Math.round(totalMinutes / 60)}h` : `${totalMinutes}m`}
              emoji="⏱️"
            />
            <StatCard
              label="Current streak"
              value={`${streak?.currentStreak ?? 0} 🔥`}
              emoji=""
            />
            <StatCard
              label="Top category"
              value={topCategory ? getCategoryLabel(topCategory[0]) : '—'}
              emoji=""
            />
          </View>

          {/* Category breakdown */}
          {Object.keys(categoryCount).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Category breakdown</Text>
              {Object.entries(categoryCount)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => {
                  const pct = Math.round((count / totalDays) * 100);
                  const catDef = CATEGORIES.find((c) => c.id === cat);
                  return (
                    <View key={cat} style={styles.catRow}>
                      <Text style={styles.catEmoji}>{catDef?.emoji ?? '✨'}</Text>
                      <View style={styles.catInfo}>
                        <View style={styles.catLabelRow}>
                          <Text style={styles.catName}>{catDef?.label ?? cat}</Text>
                          <Text style={styles.catCount}>{count} day{count !== 1 ? 's' : ''}</Text>
                        </View>
                        <View style={styles.barBg}>
                          <View style={[styles.barFill, { width: `${pct}%` }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
            </>
          )}

          {/* Entry list */}
          {filtered.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Entries</Text>
              {filtered.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>No entries in this period.</Text>
              <Text style={styles.emptySubtext}>Start logging to see your summary!</Text>
            </View>
          )}
        </>
      )}
      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

function StatCard({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EntryCard({ entry }: { entry: LearningEntry }) {
  return (
    <View style={styles.entryCard}>
      <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
      <Text style={styles.entryTitle}>{entry.title}</Text>
      {entry.description ? (
        <Text style={styles.entryDesc} numberOfLines={2}>{entry.description}</Text>
      ) : null}
      <View style={styles.entryMeta}>
        <View style={styles.catChips}>
          {entry.categories.map((c) => {
            const catDef = CATEGORIES.find((x) => x.id === c);
            return (
              <View key={c} style={styles.miniChip}>
                <Text style={styles.miniChipText}>{catDef?.emoji} {catDef?.label ?? c}</Text>
              </View>
            );
          })}
        </View>
        {entry.duration > 0 && (
          <Text style={styles.entryDuration}>⏱ {entry.duration}m</Text>
        )}
      </View>
    </View>
  );
}

function getCategoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { padding: SPACING.md },
  heading: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.md },

  rangeRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.lg },
  rangeChip: {
    flex: 1, alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md, backgroundColor: COLORS.white,
  },
  rangeChipActive: { borderColor: COLORS.black, backgroundColor: COLORS.black },
  rangeLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.textSecondary },
  rangeLabelActive: { color: COLORS.white },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderLight,
    padding: SPACING.md,
  },
  statValue: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  statLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2, fontWeight: FONTS.weights.medium },

  sectionTitle: {
    fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary, marginBottom: SPACING.sm, marginTop: SPACING.md,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
  catEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
  catInfo: { flex: 1 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catName: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.textPrimary },
  catCount: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  barBg: { height: 6, backgroundColor: COLORS.borderLight, borderRadius: RADIUS.full, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: COLORS.black, borderRadius: RADIUS.full },

  entryCard: {
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.sm, backgroundColor: COLORS.white,
  },
  entryDate: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginBottom: 4, fontWeight: FONTS.weights.medium },
  entryTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, marginBottom: 4 },
  entryDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  entryMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catChips: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', flex: 1 },
  miniChip: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  miniChipText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  entryDuration: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  emptySubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 4 },
});
