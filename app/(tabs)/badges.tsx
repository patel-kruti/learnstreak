import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { COLORS, FONTS, SPACING, RADIUS, BADGE_DEFINITIONS } from '../../src/constants/theme';
import { getEarnedBadges, getStreak } from '../../src/utils/storage';
import { EarnedBadge, StreakData } from '../../src/types';

export default function BadgesScreen() {
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [streak, setStreak] = useState<StreakData | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const [badges, s] = await Promise.all([getEarnedBadges(), getStreak()]);
    setEarnedBadges(badges);
    setStreak(s);
  }

  const earnedIds = new Set(earnedBadges.map((b) => b.badgeId));
  const currentStreak = streak?.currentStreak ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>🏆 Badges</Text>
      <Text style={styles.subheading}>
        {earnedIds.size === 0
          ? 'Keep learning to earn your first badge!'
          : `${earnedIds.size} of ${BADGE_DEFINITIONS.length} badges earned`}
      </Text>

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <View
          style={[
            styles.progressFill,
            { width: `${(earnedIds.size / BADGE_DEFINITIONS.length) * 100}%` },
          ]}
        />
      </View>

      {/* Badge grid */}
      <View style={styles.badgeGrid}>
        {BADGE_DEFINITIONS.map((badge) => {
          const earned = earnedIds.has(badge.id);
          const earnedData = earnedBadges.find((b) => b.badgeId === badge.id);
          const progress = Math.min(currentStreak / badge.requiredDays, 1);
          const progressPct = Math.round(progress * 100);

          return (
            <View
              key={badge.id}
              style={[styles.badgeCard, earned && styles.badgeCardEarned]}
            >
              {/* Emoji */}
              <View style={[styles.badgeIconWrap, earned && styles.badgeIconWrapEarned]}>
                <Text style={[styles.badgeEmoji, !earned && styles.badgeEmojiLocked]}>
                  {earned ? badge.emoji : '🔒'}
                </Text>
              </View>

              <Text style={[styles.badgeTitle, !earned && styles.badgeTitleLocked]}>
                {badge.title}
              </Text>
              <Text style={styles.badgeDesc}>{badge.description}</Text>

              {earned ? (
                <View style={styles.earnedPill}>
                  <Text style={styles.earnedPillText}>
                    ✓ Earned{earnedData ? ` · ${formatEarnedDate(earnedData.earnedAt)}` : ''}
                  </Text>
                </View>
              ) : (
                <View style={styles.progressSection}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>
                    {currentStreak}/{badge.requiredDays} days
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

function formatEarnedDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { padding: SPACING.md },
  heading: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: 4 },
  subheading: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.md },

  progressBg: {
    height: 8, backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.full, marginBottom: SPACING.lg, overflow: 'hidden',
  },
  progressFill: {
    height: 8, backgroundColor: COLORS.black,
    borderRadius: RADIUS.full, minWidth: 4,
  },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  badgeCard: {
    width: '47%', flex: 0,
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    alignItems: 'center', backgroundColor: COLORS.white,
    opacity: 0.65,
  },
  badgeCardEarned: {
    borderColor: COLORS.black, borderWidth: 2,
    opacity: 1, backgroundColor: COLORS.white,
  },

  badgeIconWrap: {
    width: 72, height: 72, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 2, borderColor: COLORS.borderLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  badgeIconWrapEarned: {
    backgroundColor: COLORS.offWhite,
    borderColor: COLORS.black,
  },
  badgeEmoji: { fontSize: 36 },
  badgeEmojiLocked: { opacity: 0.5 },

  badgeTitle: {
    fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary, textAlign: 'center', marginBottom: 4,
  },
  badgeTitleLocked: { color: COLORS.textSecondary },
  badgeDesc: {
    fontSize: FONTS.sizes.xs, color: COLORS.textTertiary,
    textAlign: 'center', marginBottom: SPACING.sm,
    lineHeight: 16,
  },

  earnedPill: {
    backgroundColor: COLORS.successLight,
    borderWidth: 1, borderColor: COLORS.success,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  earnedPillText: { fontSize: FONTS.sizes.xs, color: COLORS.success, fontWeight: FONTS.weights.medium },

  progressSection: { width: '100%', gap: 4 },
  progressBarBg: {
    height: 6, backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.full, overflow: 'hidden',
  },
  progressBarFill: {
    height: 6, backgroundColor: COLORS.textSecondary,
    borderRadius: RADIUS.full, minWidth: 2,
  },
  progressLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, textAlign: 'right' },
});
