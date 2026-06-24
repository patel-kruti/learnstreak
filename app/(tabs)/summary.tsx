import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CATEGORIES, COLORS, FONTS, RADIUS, SPACING } from '../../src/constants/theme';
import { CategoryStat, DaySummary, StreakData } from '../../src/types';
import {
  formatMinutes,
  getCategoryStats,
  getDaySummaries,
  getStreak,
  getTodayDate,
} from '../../src/utils/storage';

const SCREEN_W = Dimensions.get('window').width;

// ── Range helpers ─────────────────────────────────────────────────────────────

type RangeKey = '1D' | '5D' | '1W' | '1M' | '1Y' | 'ALL';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '1D', label: '1D' },
  { key: '5D', label: '5D' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'All' },
];

function getFromDate(key: RangeKey): string | undefined {
  if (key === 'ALL') return undefined;
  const d = new Date();
  switch (key) {
    case '1D': d.setDate(d.getDate() - 1);        break;
    case '5D': d.setDate(d.getDate() - 5);        break;
    case '1W': d.setDate(d.getDate() - 7);        break;
    case '1M': d.setMonth(d.getMonth() - 1);      break;
    case '1Y': d.setFullYear(d.getFullYear() - 1); break;
  }
  return d.toISOString().split('T')[0];
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SummaryScreen() {
  const [range, setRange]             = useState<RangeKey>('1W');
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [catStats, setCatStats]       = useState<CategoryStat[]>([]);
  const [streak, setStreak]           = useState<StreakData | null>(null);
  const [loading, setLoading]         = useState(true);

  useFocusEffect(
    useCallback(() => { loadData(range); }, [range])
  );

  async function loadData(r: RangeKey) {
    setLoading(true);
    const from = getFromDate(r);
    const today = getTodayDate();
    const [days, cats, s] = await Promise.all([
      getDaySummaries(from, today),
      getCategoryStats(from, today),
      getStreak(),
    ]);
    setDaySummaries(days);
    setCatStats(cats);
    setStreak(s);
    setLoading(false);
  }

  function handleRangeChange(r: RangeKey) {
    setRange(r);
    // loadData fires via useFocusEffect dependency on range
    loadData(r);
  }

  // Derived totals
  const totalMinutes  = daySummaries.reduce((s, d) => s + d.totalMinutes, 0);
  const totalSessions = daySummaries.reduce((s, d) => s + d.entryCount, 0);
  const totalDays     = daySummaries.length;
  const topCat        = catStats[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>📊 Summary</Text>

      {/* Range selector */}
      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.rangeChip, range === opt.key && styles.rangeChipActive]}
            onPress={() => handleRangeChange(opt.key)}
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
      ) : totalDays === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Stat cards */}
          <View style={styles.statGrid}>
            <StatCard label="Days logged"     value={String(totalDays)} />
            <StatCard label="Time invested"   value={formatMinutes(totalMinutes)} />
            <StatCard label="Sessions"        value={String(totalSessions)} />
            <StatCard label="Current streak"  value={`${streak?.currentStreak ?? 0} 🔥`} />
          </View>

          {/* Line chart — time per day */}
          {daySummaries.length > 1 && (
            <>
              <SectionTitle>Time per day</SectionTitle>
              <LineChart data={daySummaries} />
            </>
          )}

          {/* Category ranking — by time spent */}
          {catStats.length > 0 && (
            <>
              <SectionTitle>
                Category ranking{' '}
                <Text style={styles.sectionSubtitle}>by time spent</Text>
              </SectionTitle>
              {catStats.map((stat, idx) => (
                <CategoryRow key={stat.category} stat={stat} rank={idx + 1} totalMinutes={totalMinutes} />
              ))}
            </>
          )}
        </>
      )}

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

// ── Line chart (pure RN — no external library) ────────────────────────────────
// Draws axes, gridlines, data points and connecting lines using View/absolute
// positioning. Works on all platforms with zero dependencies.

const CHART_H       = 160;
const CHART_PADDING = { top: 16, bottom: 32, left: 48, right: 16 };

function LineChart({ data }: { data: DaySummary[] }) {
  const chartW = SCREEN_W - SPACING.md * 2 - 4; // card width
  const plotW  = chartW - CHART_PADDING.left - CHART_PADDING.right;
  const plotH  = CHART_H - CHART_PADDING.top - CHART_PADDING.bottom;

  const maxMinutes = Math.max(...data.map((d) => d.totalMinutes), 1);
  // Round up to a nice number for the y-axis
  const yMax = Math.ceil(maxMinutes / 30) * 30;

  // Map data points to pixel coords
  const points = data.map((d, i) => ({
    x: CHART_PADDING.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW),
    y: CHART_PADDING.top + plotH - (d.totalMinutes / yMax) * plotH,
    minutes: d.totalMinutes,
    date: d.date,
  }));

  // Build SVG polyline points string
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Y-axis labels: 0, half, max
  const yLabels = [
    { value: 0,          y: CHART_PADDING.top + plotH },
    { value: yMax / 2,   y: CHART_PADDING.top + plotH / 2 },
    { value: yMax,        y: CHART_PADDING.top },
  ];

  // X-axis labels: show first, middle, last date
  const xLabels = [0, Math.floor(data.length / 2), data.length - 1]
    .filter((i, idx, arr) => arr.indexOf(i) === idx && i < data.length)
    .map((i) => ({ i, x: points[i].x, label: shortDate(data[i].date) }));

  return (
    <View style={styles.chartCard}>
      {/* Y-axis labels */}
      {yLabels.map(({ value, y }) => (
        <Text
          key={value}
          style={[styles.chartYLabel, { top: y - 8 }]}
        >
          {formatMinutes(value)}
        </Text>
      ))}

      {/* Chart area */}
      <View style={{ marginLeft: CHART_PADDING.left, height: CHART_H }}>
        {/* Horizontal gridlines */}
        {yLabels.map(({ value, y }) => (
          <View
            key={`grid-${value}`}
            style={[styles.gridLine, { top: y - CHART_PADDING.top + CHART_PADDING.top, width: plotW + CHART_PADDING.right }]}
          />
        ))}

        {/* SVG for line + dots — rendered as absolute-positioned lines via Views */}
        {points.length > 1 &&
          points.slice(0, -1).map((p, i) => {
            const next = points[i + 1];
            const dx   = next.x - p.x;
            const dy   = next.y - p.y;
            const len  = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View
                key={`line-${i}`}
                style={{
                  position: 'absolute',
                  left: p.x - CHART_PADDING.left,
                  top:  p.y - CHART_PADDING.top,
                  width: len,
                  height: 2,
                  backgroundColor: COLORS.black,
                  transformOrigin: '0 50%',
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
            );
          })}

        {/* Data point dots */}
        {points.map((p, i) => (
          <View
            key={`dot-${i}`}
            style={[
              styles.chartDot,
              {
                left: p.x - CHART_PADDING.left - 5,
                top:  p.y - CHART_PADDING.top - 5,
              },
            ]}
          />
        ))}
      </View>

      {/* X-axis labels */}
      <View style={[styles.chartXLabels, { marginLeft: CHART_PADDING.left }]}>
        {xLabels.map(({ i, x, label }) => (
          <Text
            key={i}
            style={[styles.chartXLabel, { left: x - CHART_PADDING.left - 20 }]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ── Category row — ranked by time ─────────────────────────────────────────────

function CategoryRow({
  stat,
  rank,
  totalMinutes,
}: {
  stat: CategoryStat;
  rank: number;
  totalMinutes: number;
}) {
  const catDef = CATEGORIES.find((c) => c.id === stat.category);
  const pct    = totalMinutes > 0 ? (stat.totalMinutes / totalMinutes) * 100 : 0;

  return (
    <View style={styles.catRow}>
      {/* Rank badge */}
      <View style={[styles.rankBadge, rank === 1 && styles.rankBadgeTop]}>
        <Text style={[styles.rankText, rank === 1 && styles.rankTextTop]}>#{rank}</Text>
      </View>

      <Text style={styles.catEmoji}>{catDef?.emoji ?? '✨'}</Text>

      <View style={styles.catInfo}>
        <View style={styles.catLabelRow}>
          <Text style={styles.catName}>{catDef?.label ?? stat.category}</Text>
          <View style={styles.catMeta}>
            <Text style={styles.catTime}>{formatMinutes(stat.totalMinutes)}</Text>
            <Text style={styles.catPct}>{stat.percentage}%</Text>
          </View>
        </View>
        {/* Progress bar — width is % of total time */}
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.catSessions}>
          {stat.entryCount} session{stat.entryCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={styles.emptyText}>No entries in this period.</Text>
      <Text style={styles.emptySubtext}>Start logging to see your summary!</Text>
    </View>
  );
}

function shortDate(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content:   { padding: SPACING.md },

  heading: {
    fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary, marginBottom: SPACING.md,
  },

  // Range chips
  rangeRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.lg },
  rangeChip: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.sm,
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md, backgroundColor: COLORS.white,
  },
  rangeChipActive:  { borderColor: COLORS.black, backgroundColor: COLORS.black },
  rangeLabel:       { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.textSecondary },
  rangeLabelActive: { color: COLORS.white },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderLight, padding: SPACING.md,
  },
  statValue: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  statLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2, fontWeight: FONTS.weights.medium },

  // Section title
  sectionTitle: {
    fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary, marginBottom: SPACING.sm, marginTop: SPACING.lg,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.normal,
    color: COLORS.textTertiary, textTransform: 'none', letterSpacing: 0,
  },

  // Line chart
  chartCard: {
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md, padding: SPACING.sm,
    marginBottom: SPACING.sm, backgroundColor: COLORS.white,
    height: CHART_H + CHART_PADDING.bottom + 8,
    position: 'relative', overflow: 'hidden',
  },
  chartYLabel: {
    position: 'absolute', left: 0, width: CHART_PADDING.left - 4,
    fontSize: 9, color: COLORS.textTertiary, textAlign: 'right',
  },
  gridLine: {
    position: 'absolute', left: 0, height: 1,
    backgroundColor: COLORS.borderLight,
  },
  chartDot: {
    position: 'absolute', width: 10, height: 10,
    borderRadius: 5, backgroundColor: COLORS.white,
    borderWidth: 2, borderColor: COLORS.black,
  },
  chartXLabels: {
    position: 'relative', height: 20, marginTop: 4,
  },
  chartXLabel: {
    position: 'absolute', width: 40,
    fontSize: 9, color: COLORS.textTertiary, textAlign: 'center',
  },

  // Category rows
  catRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: SPACING.md, gap: SPACING.sm,
  },
  rankBadge: {
    width: 28, height: 28, borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  rankBadgeTop: { borderColor: COLORS.black, backgroundColor: COLORS.black },
  rankText:     { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold, color: COLORS.textSecondary },
  rankTextTop:  { color: COLORS.white },
  catEmoji:     { fontSize: 22, width: 30, textAlign: 'center' },
  catInfo:      { flex: 1 },
  catLabelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  catName:      { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  catMeta:      { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  catTime:      { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  catPct:       { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },
  barBg:        { height: 6, backgroundColor: COLORS.borderLight, borderRadius: RADIUS.full, overflow: 'hidden' },
  barFill:      { height: 6, backgroundColor: COLORS.black, borderRadius: RADIUS.full },
  catSessions:  { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 3 },

  // Empty state
  emptyState:   { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyEmoji:   { fontSize: 48, marginBottom: SPACING.md },
  emptyText:    { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  emptySubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 4 },
});
