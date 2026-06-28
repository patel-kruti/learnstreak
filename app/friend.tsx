import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../src/constants/theme';
import { getFriendHeatmap, getFriendStreak } from '../src/utils/firestore';
import { StreakData } from '../src/types';

const SCREEN_W  = Dimensions.get('window').width;
const CELL      = 13;
const CELL_GAP  = 3;
const COL_W     = CELL + CELL_GAP;
const NUM_WEEKS = 26; // 6 months of history for friends
const DAYS_BACK = NUM_WEEKS * 7;

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS   = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function cellBg(minutes: number, maxMinutes: number): string {
  if (minutes === 0 || maxMinutes === 0) return COLORS.surface;
  const ratio = minutes / maxMinutes;
  if (ratio < 0.25) return '#C6E6C6';
  if (ratio < 0.50) return '#6DBF6D';
  if (ratio < 0.75) return '#2E8B2E';
  return '#145214';
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function FriendScreen() {
  const { uid, userName } = useLocalSearchParams<{ uid: string; userName: string }>();

  const [streak,  setStreak]  = useState<StreakData | null>(null);
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    Promise.all([getFriendStreak(uid), getFriendHeatmap(uid)])
      .then(([s, h]) => {
        setStreak(s);
        setHeatmap(h);
      })
      .finally(() => setLoading(false));
  }, [uid]);

  // Build grid — identical logic to streak.tsx but uses friend heatmap
  const today     = getTodayDate();
  const startDate = addDays(today, -(DAYS_BACK - 1));

  // Pad start so grid begins on Sunday
  const startDow  = new Date(startDate + 'T12:00:00').getDay(); // 0=Sun
  const gridStart = addDays(startDate, -startDow);

  const cols: { date: string; minutes: number }[][] = [];
  let col: { date: string; minutes: number }[] = [];
  const totalCells = NUM_WEEKS * 7 + startDow;

  for (let i = 0; i < totalCells; i++) {
    const date    = addDays(gridStart, i);
    const minutes = heatmap[date] ?? 0;
    col.push({ date, minutes });
    if (col.length === 7) { cols.push(col); col = []; }
  }
  if (col.length > 0) cols.push(col);

  const maxMinutes = Math.max(...Object.values(heatmap), 1);

  // Month labels
  const monthLabels: { label: string; colIndex: number }[] = [];
  cols.forEach((c, ci) => {
    const date  = c[0].date;
    const month = new Date(date + 'T12:00:00').getMonth();
    const day   = new Date(date + 'T12:00:00').getDate();
    if (day <= 7) {
      if (!monthLabels.length || monthLabels[monthLabels.length - 1].label !== MONTHS_SHORT[month]) {
        monthLabels.push({ label: MONTHS_SHORT[month], colIndex: ci });
      }
    }
  });

  const gridWidth = cols.length * COL_W;

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator color={COLORS.textSecondary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.displayName}>@{userName}</Text>
          <Text style={styles.subtitle}>Learning streak</Text>
        </View>
      </View>

      {/* Streak stats */}
      {streak ? (
        <View style={styles.statsRow}>
          <StatCard emoji="🔥" label="Current" value={`${streak.currentStreak}d`} highlight={streak.currentStreak > 0} />
          <StatCard emoji="🏆" label="Longest" value={`${streak.longestStreak}d`} />
          <StatCard emoji="📅" label="Total days" value={`${streak.totalDaysLogged}`} />
        </View>
      ) : (
        <View style={styles.noData}>
          <Text style={styles.noDataText}>No streak data yet.</Text>
        </View>
      )}

      {/* Heatmap */}
      <Text style={styles.heatmapTitle}>Activity (last 6 months)</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.heatmapScroll}
        contentContainerStyle={{ paddingRight: SPACING.md }}
      >
        <View>
          {/* Month labels */}
          <View style={[styles.monthRow, { width: gridWidth }]}>
            {monthLabels.map((m) => (
              <Text
                key={`${m.label}-${m.colIndex}`}
                style={[styles.monthLabel, { position: 'absolute', left: m.colIndex * COL_W }]}
              >
                {m.label}
              </Text>
            ))}
          </View>

          {/* Grid */}
          <View style={styles.gridRow}>
            {/* Day labels */}
            <View style={styles.dayLabelCol}>
              {DAY_LABELS.map((d, i) => (
                <Text key={i} style={styles.dayLabel}>{d}</Text>
              ))}
            </View>

            {/* Cells */}
            {cols.map((col, ci) => (
              <View key={ci} style={styles.colView}>
                {col.map((cell, ri) => {
                  const inRange = cell.date >= startDate && cell.date <= today;
                  return (
                    <View
                      key={ri}
                      style={[
                        styles.cell,
                        { backgroundColor: inRange ? cellBg(cell.minutes, maxMinutes) : 'transparent' },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendLabel}>Less</Text>
            {[COLORS.surface, '#C6E6C6', '#6DBF6D', '#2E8B2E', '#145214'].map((c) => (
              <View key={c} style={[styles.legendCell, { backgroundColor: c }]} />
            ))}
            <Text style={styles.legendLabel}>More</Text>
          </View>
        </View>
      </ScrollView>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

function StatCard({
  emoji, label, value, highlight,
}: {
  emoji: string; label: string; value: string; highlight?: boolean;
}) {
  return (
    <View style={[statStyles.card, highlight && statStyles.cardHighlight]}>
      <Text style={statStyles.emoji}>{emoji}</Text>
      <Text style={[statStyles.value, highlight && statStyles.valueHighlight]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card:           { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', gap: 4 },
  cardHighlight:  { backgroundColor: COLORS.streakLight, borderWidth: 1.5, borderColor: COLORS.streak },
  emoji:          { fontSize: 22 },
  value:          { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  valueHighlight: { color: COLORS.streak },
  label:          { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
});

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.white },
  content:      { padding: SPACING.md },
  loadingCenter:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:       { marginBottom: SPACING.lg },
  backBtn:      { marginBottom: SPACING.sm },
  backText:     { fontSize: FONTS.sizes.sm, color: COLORS.accent, fontWeight: FONTS.weights.semibold },
  titleBlock:   {},
  displayName:  { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  subtitle:     { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },

  noData:     { alignItems: 'center', padding: SPACING.lg },
  noDataText: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },

  heatmapTitle: {
    fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: SPACING.sm,
  },
  heatmapScroll: { marginLeft: -SPACING.md },

  monthRow:  { height: 18, marginLeft: 28, position: 'relative', marginBottom: 4 },
  monthLabel:{ fontSize: 10, color: COLORS.textTertiary },

  gridRow:     { flexDirection: 'row' },
  dayLabelCol: { width: 28, gap: CELL_GAP },
  dayLabel:    { fontSize: 10, color: COLORS.textTertiary, height: CELL, lineHeight: CELL },

  colView: { flexDirection: 'column', gap: CELL_GAP, marginRight: CELL_GAP },
  cell:    { width: CELL, height: CELL, borderRadius: 2 },

  legend:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.sm, marginLeft: 28 },
  legendLabel: { fontSize: 10, color: COLORS.textTertiary },
  legendCell:  { width: CELL, height: CELL, borderRadius: 2 },
});
