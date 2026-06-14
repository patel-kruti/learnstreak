import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../src/constants/theme';
import { DaySummary, StreakData } from '../../src/types';
import { getDaySummaries, getStreak, getTodayDate } from '../../src/utils/storage';

const SCREEN_W  = Dimensions.get('window').width;
const CELL      = 13;  // px — each day square
const CELL_GAP  = 3;   // px — gap between squares
const COL_W     = CELL + CELL_GAP;
const NUM_WEEKS = 52;
const DAYS_BACK = NUM_WEEKS * 7; // 364 days

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS   = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

// Intensity levels → opacity of black fill (GitHub-style 4 levels + empty)
function intensityColor(minutes: number, maxMinutes: number): string {
  if (minutes === 0 || maxMinutes === 0) return COLORS.surface;
  const ratio = minutes / maxMinutes;
  if (ratio < 0.25) return '#C6E6C6'; // light green — low
  if (ratio < 0.50) return '#6DBF6D'; // medium green
  if (ratio < 0.75) return '#2E8B2E'; // dark green
  return '#145214';                    // darkest — high activity
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StreakScreen() {
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [streak, setStreak]             = useState<StreakData | null>(null);
  const [selectedDay, setSelectedDay]   = useState<DaySummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const today   = getTodayDate();
    const fromDate = offsetDate(today, -DAYS_BACK);
    const [days, s] = await Promise.all([
      getDaySummaries(fromDate, today),
      getStreak(),
    ]);
    setDaySummaries(days);
    setStreak(s);
  }

  // Build lookup map: date → DaySummary
  const summaryMap = new Map(daySummaries.map((d) => [d.date, d]));
  const maxMinutes = Math.max(...daySummaries.map((d) => d.totalMinutes), 1);

  // Build 52-week grid: array of 7-day columns, oldest week first
  const today     = getTodayDate();
  const todayDate = new Date(today + 'T12:00:00');

  // Start from the Sunday 52 weeks ago
  const gridStart = new Date(todayDate);
  gridStart.setDate(gridStart.getDate() - DAYS_BACK);
  // Align to Sunday
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  // Build columns [week][day] — 53 cols × 7 rows to cover full range
  const columns: Array<Array<{ date: string; inRange: boolean }>> = [];
  const cursor = new Date(gridStart);
  while (cursor <= todayDate) {
    const col: Array<{ date: string; inRange: boolean }> = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().split('T')[0];
      const inRange = dateStr >= offsetDate(today, -DAYS_BACK) && dateStr <= today;
      col.push({ date: dateStr, inRange });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(col);
  }

  // Month labels: for each column, if the first day of the column is the 1st of a month
  // (or the column crosses a month boundary), show the month name
  const monthLabels: Array<{ colIdx: number; label: string }> = [];
  columns.forEach((col, i) => {
    const firstOfCol = new Date(col[0].date + 'T12:00:00');
    if (firstOfCol.getDate() <= 7 && (i === 0 || firstOfCol.getDate() <= COL_W)) {
      monthLabels.push({ colIdx: i, label: MONTHS_SHORT[firstOfCol.getMonth()] });
    }
  });

  // Stats for the visible period
  const totalMinutes  = daySummaries.reduce((s, d) => s + d.totalMinutes, 0);
  const totalDays     = daySummaries.length;
  const thisMonthStr  = today.slice(0, 7);
  const thisMonthDays = daySummaries.filter((d) => d.date.startsWith(thisMonthStr)).length;

  const heatmapW = columns.length * COL_W;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Streak hero ──────────────────────────────────────────────────── */}
      <View style={styles.streakHero}>
        <Text style={styles.streakFire}>🔥</Text>
        <Text style={styles.streakNumber}>{streak?.currentStreak ?? 0}</Text>
        <Text style={styles.streakLabel}>day streak</Text>
      </View>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <StatBox label="Best streak"  value={String(streak?.longestStreak ?? 0)} />
        <StatBox label="Total days"   value={String(streak?.totalDaysLogged ?? 0)} mid />
        <StatBox label="This month"   value={String(thisMonthDays)} />
      </View>

      {/* ── Heatmap ──────────────────────────────────────────────────────── */}
      <View style={styles.heatmapCard}>
        <Text style={styles.heatmapTitle}>Last 52 weeks</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: SPACING.sm }}
        >
          <View>
            {/* Month labels row */}
            <View style={[styles.monthLabelRow, { width: heatmapW }]}>
              {monthLabels.map(({ colIdx, label }) => (
                <Text
                  key={colIdx}
                  style={[styles.monthLabel, { left: colIdx * COL_W }]}
                >
                  {label}
                </Text>
              ))}
            </View>

            {/* Day labels + grid */}
            <View style={styles.heatmapBody}>
              {/* Day-of-week labels */}
              <View style={styles.dayLabelCol}>
                {DAY_LABELS.map((label, i) => (
                  <Text key={i} style={styles.dayLabel}>{label}</Text>
                ))}
              </View>

              {/* Week columns */}
              <View style={{ flexDirection: 'row', gap: CELL_GAP }}>
                {columns.map((col, ci) => (
                  <View key={ci} style={{ flexDirection: 'column', gap: CELL_GAP }}>
                    {col.map(({ date, inRange }) => {
                      const summary = summaryMap.get(date);
                      const mins    = summary?.totalMinutes ?? 0;
                      const isToday = date === today;
                      const bg      = !inRange
                        ? 'transparent'
                        : intensityColor(mins, maxMinutes);

                      return (
                        <TouchableOpacity
                          key={date}
                          style={[
                            styles.cell,
                            { backgroundColor: bg },
                            isToday && styles.cellToday,
                            !inRange && styles.cellOutOfRange,
                          ]}
                          onPress={() => inRange && setSelectedDay(summary ?? { date, totalMinutes: 0, entryCount: 0, categories: [] })}
                          activeOpacity={0.7}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              <Text style={styles.legendLabel}>Less</Text>
              {[0, 0.2, 0.5, 0.75, 1].map((ratio) => (
                <View
                  key={ratio}
                  style={[styles.legendCell, { backgroundColor: intensityColor(ratio * 60, 60) }]}
                />
              ))}
              <Text style={styles.legendLabel}>More</Text>
            </View>
          </View>
        </ScrollView>

        {/* Tapped day tooltip */}
        {selectedDay && (
          <TouchableOpacity
            style={styles.tooltip}
            onPress={() => setSelectedDay(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.tooltipDate}>{formatTooltipDate(selectedDay.date)}</Text>
            {selectedDay.totalMinutes > 0 ? (
              <>
                <Text style={styles.tooltipValue}>
                  {formatMinutes(selectedDay.totalMinutes)} across {selectedDay.entryCount} session{selectedDay.entryCount !== 1 ? 's' : ''}
                </Text>
              </>
            ) : (
              <Text style={styles.tooltipEmpty}>No sessions logged</Text>
            )}
            <Text style={styles.tooltipDismiss}>tap to dismiss</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Year summary ─────────────────────────────────────────────────── */}
      <View style={styles.yearCard}>
        <Text style={styles.yearTitle}>Past 52 weeks</Text>
        <View style={styles.yearStats}>
          <YearStat label="Days logged"   value={String(totalDays)} />
          <YearStat label="Time invested" value={formatMinutes(totalMinutes)} />
          <YearStat label="Avg per day"   value={totalDays > 0 ? formatMinutes(Math.round(totalMinutes / totalDays)) : '—'} />
        </View>
      </View>

      {/* ── Motivational banner ───────────────────────────────────────────── */}
      <MotivationalBanner streak={streak?.currentStreak ?? 0} />

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value, mid }: { label: string; value: string; mid?: boolean }) {
  return (
    <View style={[styles.statBox, mid && styles.statBoxMid]}>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function YearStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.yearStat}>
      <Text style={styles.yearStatValue}>{value}</Text>
      <Text style={styles.yearStatLabel}>{label}</Text>
    </View>
  );
}

function MotivationalBanner({ streak }: { streak: number }) {
  let msg = { emoji: '🌱', text: 'Start your streak today!', sub: 'Log your first day of learning' };
  if (streak >= 365) msg = { emoji: '🏆', text: 'LEGENDARY!',         sub: 'A full year of learning — you are incredible' };
  else if (streak >= 100) msg = { emoji: '🦉', text: 'Century Scholar!', sub: "100 days! You're in elite territory" };
  else if (streak >= 30)  msg = { emoji: '💎', text: 'Monthly Master!',  sub: '30 days strong — amazing consistency' };
  else if (streak >= 14)  msg = { emoji: '⚡', text: 'On fire!',          sub: '2 weeks of unstoppable learning' };
  else if (streak >= 7)   msg = { emoji: '🔥', text: 'Week Warrior!',    sub: 'A whole week! Keep pushing' };
  else if (streak >= 3)   msg = { emoji: '✨', text: 'Building momentum!', sub: `${streak} days in — don't stop now` };
  else if (streak >= 1)   msg = { emoji: '🌟', text: 'Good start!',       sub: 'Keep showing up every day' };

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerEmoji}>{msg.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>{msg.text}</Text>
        <Text style={styles.bannerSub}>{msg.sub}</Text>
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function offsetDate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTooltipDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content:   { padding: SPACING.md },

  // Streak hero
  streakHero:   { alignItems: 'center', paddingVertical: SPACING.lg },
  streakFire:   { fontSize: 56 },
  streakNumber: { fontSize: 72, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, lineHeight: 80 },
  streakLabel:  { fontSize: FONTS.sizes.lg, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },

  // Stats row
  statsRow:   { flexDirection: 'row', borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, marginBottom: SPACING.lg },
  statBox:    { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  statBoxMid: { borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: COLORS.borderLight },
  statNum:    { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  statLabel:  { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2, fontWeight: FONTS.weights.medium },

  // Heatmap card
  heatmapCard: {
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  heatmapTitle: {
    fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: SPACING.sm,
  },

  // Month labels
  monthLabelRow: { position: 'relative', height: 16, marginLeft: 24, marginBottom: 2 },
  monthLabel:    { position: 'absolute', fontSize: 9, color: COLORS.textTertiary },

  // Heatmap body
  heatmapBody: { flexDirection: 'row' },
  dayLabelCol:  { width: 24, flexDirection: 'column', gap: CELL_GAP, paddingTop: 1 },
  dayLabel:     { height: CELL, fontSize: 8, color: COLORS.textTertiary, textAlignVertical: 'center' },

  // Cells
  cell: {
    width: CELL, height: CELL,
    borderRadius: 2,
    backgroundColor: COLORS.surface,
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: COLORS.black,
  },
  cellOutOfRange: {
    backgroundColor: 'transparent',
  },

  // Legend
  legend: {
    flexDirection: 'row', alignItems: 'center',
    gap: 3, marginTop: SPACING.sm, justifyContent: 'flex-end',
  },
  legendCell:  { width: CELL, height: CELL, borderRadius: 2 },
  legendLabel: { fontSize: 9, color: COLORS.textTertiary },

  // Tooltip
  tooltip: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  tooltipDate:    { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.white, marginBottom: 2 },
  tooltipValue:   { fontSize: FONTS.sizes.sm, color: COLORS.textOnDark },
  tooltipEmpty:   { fontSize: FONTS.sizes.sm, color: '#9AA0A6' },
  tooltipDismiss: { fontSize: 10, color: '#5F6368', marginTop: 6, textAlign: 'right' },

  // Year card
  yearCard: {
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  yearTitle: {
    fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: SPACING.md,
  },
  yearStats:     { flexDirection: 'row', justifyContent: 'space-between' },
  yearStat:      { alignItems: 'center', flex: 1 },
  yearStatValue: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  yearStatLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },

  // Banner
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md, padding: SPACING.md,
    backgroundColor: COLORS.offWhite,
  },
  bannerEmoji: { fontSize: 36 },
  bannerTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  bannerSub:   { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
});
