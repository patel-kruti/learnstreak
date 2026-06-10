import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { getAllEntries, getStreak } from '../../src/utils/storage';
import { LearningEntry, StreakData } from '../../src/types';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function StreakScreen() {
  const [entries, setEntries] = useState<LearningEntry[]>([]);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const [all, s] = await Promise.all([getAllEntries(), getStreak()]);
    setEntries(all);
    setStreak(s);
  }

  const loggedDates = new Set(entries.map((e) => e.date));
  const today = new Date().toISOString().split('T')[0];

  // Calendar generation
  const firstDay = new Date(selectedYear, selectedMonth, 1);
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const startOffset = firstDay.getDay(); // 0=Sun

  const calCells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < startOffset; i++) calCells.push({ date: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calCells.push({ date: dateStr, day: d });
  }

  function prevMonth() {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth()) return;
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  }

  const monthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const monthEntries = entries.filter((e) => e.date.startsWith(monthStr));
  const monthDays = monthEntries.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Streak counter */}
      <View style={styles.streakHero}>
        <Text style={styles.streakFire}>🔥</Text>
        <Text style={styles.streakNumber}>{streak?.currentStreak ?? 0}</Text>
        <Text style={styles.streakLabel}>day streak</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{streak?.longestStreak ?? 0}</Text>
          <Text style={styles.statLabel}>Best streak</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxMid]}>
          <Text style={styles.statNum}>{streak?.totalDaysLogged ?? 0}</Text>
          <Text style={styles.statLabel}>Total days</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{monthDays}</Text>
          <Text style={styles.statLabel}>This month</Text>
        </View>
      </View>

      {/* Calendar */}
      <View style={styles.calCard}>
        {/* Month nav */}
        <View style={styles.calHeader}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {MONTHS[selectedMonth]} {selectedYear}
          </Text>
          <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Day labels */}
        <View style={styles.dayLabels}>
          {DAYS.map((d, i) => (
            <Text key={i} style={styles.dayLabel}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {calCells.map((cell, i) => {
            if (!cell.date) {
              return <View key={`empty-${i}`} style={styles.cell} />;
            }
            const logged = loggedDates.has(cell.date);
            const isToday = cell.date === today;
            const isFuture = cell.date > today;

            return (
              <View
                key={cell.date}
                style={[
                  styles.cell,
                  logged && styles.cellLogged,
                  isToday && styles.cellToday,
                  isFuture && styles.cellFuture,
                ]}
              >
                <Text
                  style={[
                    styles.cellText,
                    logged && styles.cellTextLogged,
                    isToday && styles.cellTextToday,
                    isFuture && styles.cellTextFuture,
                  ]}
                >
                  {cell.day}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.cellLogged]} />
            <Text style={styles.legendLabel}>Logged</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.cell, { borderWidth: 2, borderColor: COLORS.black }]} />
            <Text style={styles.legendLabel}>Today</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.surface }]} />
            <Text style={styles.legendLabel}>Missed</Text>
          </View>
        </View>
      </View>

      {/* Motivational message */}
      <MotivationalBanner streak={streak?.currentStreak ?? 0} />

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

function MotivationalBanner({ streak }: { streak: number }) {
  let msg = { emoji: '🌱', text: 'Start your streak today!', sub: 'Log your first day of learning' };

  if (streak >= 365) msg = { emoji: '🏆', text: 'LEGENDARY!', sub: 'A full year of learning — you are incredible' };
  else if (streak >= 100) msg = { emoji: '🦉', text: 'Century Scholar!', sub: "100 days! You're in elite territory" };
  else if (streak >= 30) msg = { emoji: '💎', text: 'Monthly Master!', sub: '30 days strong — amazing consistency' };
  else if (streak >= 14) msg = { emoji: '⚡', text: 'On fire!', sub: '2 weeks of unstoppable learning' };
  else if (streak >= 7) msg = { emoji: '🔥', text: 'Week Warrior!', sub: 'A whole week! Keep pushing' };
  else if (streak >= 3) msg = { emoji: '✨', text: 'Building momentum!', sub: `${streak} days in — don't stop now` };
  else if (streak >= 1) msg = { emoji: '🌟', text: 'Good start!', sub: 'Keep showing up every day' };

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerEmoji}>{msg.emoji}</Text>
      <View>
        <Text style={styles.bannerTitle}>{msg.text}</Text>
        <Text style={styles.bannerSub}>{msg.sub}</Text>
      </View>
    </View>
  );
}

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { padding: SPACING.md },

  streakHero: { alignItems: 'center', paddingVertical: SPACING.lg },
  streakFire: { fontSize: 56 },
  streakNumber: { fontSize: 72, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, lineHeight: 80 },
  streakLabel: { fontSize: FONTS.sizes.lg, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },

  statsRow: { flexDirection: 'row', borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, marginBottom: SPACING.lg },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md },
  statBoxMid: { borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: COLORS.borderLight },
  statNum: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  statLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2, fontWeight: FONTS.weights.medium },

  calCard: {
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.sm },
  navBtnText: { fontSize: 20, color: COLORS.textPrimary, lineHeight: 24 },
  monthTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },

  dayLabels: { flexDirection: 'row', marginBottom: SPACING.sm },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, fontWeight: FONTS.weights.medium },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  cellLogged: { backgroundColor: COLORS.black, borderRadius: RADIUS.sm },
  cellToday: { borderWidth: 2, borderColor: COLORS.black, borderRadius: RADIUS.sm },
  cellFuture: { opacity: 0.2 },

  cellText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  cellTextLogged: { color: COLORS.white, fontWeight: FONTS.weights.bold },
  cellTextToday: { color: COLORS.black, fontWeight: FONTS.weights.bold },
  cellTextFuture: { color: COLORS.textTertiary },

  legend: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 16, height: 16, borderRadius: 4 },
  legendLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md, padding: SPACING.md,
    backgroundColor: COLORS.offWhite,
  },
  bannerEmoji: { fontSize: 36 },
  bannerTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  bannerSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
});
