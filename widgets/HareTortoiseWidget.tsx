import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect, SvgText } from 'react-native-svg';

/**
 * Hare and Tortoise race widget — Panchatantra-inspired gamification,
 * same family as the Thirsty Crow widget. Original storybook-style
 * characters (not any copyrighted design) in a soft, painterly palette:
 * a warm caramel hare with two-tone floppy ears, and a rust-shelled
 * tortoise with hexagon shell linework and little brow tufts.
 *
 * Mechanic:
 * - Tortoise moves at a CONSTANT pace: 100/RACE_DAYS % of the track per day,
 *   modeling a steady 30 min/day baseline.
 * - Hare's daily progress is a LOGARITHMIC function of that day's logged
 *   learning minutes, calibrated so exactly 30 min ties the tortoise's
 *   daily pace. Because log() is concave, cramming minutes into one day
 *   and skipping others yields LESS total progress than spreading the
 *   same minutes evenly — the fable's moral, encoded directly into the
 *   scoring. To actually win, the hare needs MORE than 30 min logged on
 *   every single day — there's no one-day comeback.
 * - When the hare is comfortably ahead, he's shown napping under a tree
 *   (his overconfidence from the story), while the tortoise keeps walking.
 *
 * Usage:
 *   <HareTortoiseWidget dailyMinutes={[30, 45, 0, 60, 30]} />
 */

const RACE_DAYS = 5;
const TORTOISE_DAILY_PCT = 100 / RACE_DAYS; // 20% per day, constant
const CALIBRATION_MINUTES = 30; // tortoise's steady daily baseline — ties the hare at 30 min/day
const NAP_LEAD_THRESHOLD = 8; // hare shown napping once this many pct points ahead

const PALETTE = {
  cardBg: '#FBF7EC',
  border: '#E7DCC0',
  path: '#E3CEA0',
  pathFill: '#C9AD73',
  textPrimary: '#3A2F1F',
  textSecondary: '#8A7A5C',
  statBg: '#F4EBD6',
  tipBg: '#EFE6CF',
  tipText: '#6B5D3F',
  treeTrunk: '#8B6A3F',
  treeLeafOuter: '#7FA658',
  treeLeafInner: '#95BC6C',
  flagPole: '#8A7A5C',
  flagCloth: '#C9523E',
};

function hareDailyPct(minutes: number): number {
  if (!minutes || minutes <= 0) return 0;
  return TORTOISE_DAILY_PCT * (Math.log(1 + minutes) / Math.log(1 + CALIBRATION_MINUTES));
}

export interface HareTortoiseWidgetProps {
  dailyMinutes: number[];
  onRaceComplete?: (winner: 'hare' | 'tortoise' | 'tie') => void;
}

interface DayRow {
  day: number;
  minutes: number;
  tortoisePct: number;
  harePct: number;
}

const TORTOISE_W = 52;
const TORTOISE_H = (TORTOISE_W * 50) / 70;
const HARE_W = 45;
const HARE_H = (HARE_W * 55) / 60;
const HARE_NAP_W = 48;
const HARE_NAP_H = (HARE_NAP_W * 40) / 60;
const RUNNER_SIZE = TORTOISE_W; // widest runner, used for track math

function TortoiseIcon() {
  return (
    <Svg width={TORTOISE_W} height={TORTOISE_H} viewBox="0 0 70 50">
      <Ellipse cx={30} cy={32} rx={20} ry={11} fill="#7CA35E" />
      <Rect x={10} y={36} width={6} height={8} rx={3} fill="#6B9251" />
      <Rect x={20} y={40} width={6} height={8} rx={3} fill="#6B9251" />
      <Rect x={32} y={40} width={6} height={8} rx={3} fill="#6B9251" />
      <Rect x={42} y={37} width={6} height={8} rx={3} fill="#6B9251" />
      <Path d="M12 32 L6 36 L13 37 Z" fill="#7CA35E" />
      <Ellipse cx={28} cy={21} rx={23} ry={15} fill="#B8623E" />
      <Ellipse cx={28} cy={21} rx={23} ry={15} fill="#000000" fillOpacity={0.06} />
      <Ellipse cx={21} cy={15} rx={13} ry={8} fill="#D07F52" fillOpacity={0.55} />
      <Path d="M28 8 L38 15 L34 26 L22 26 L18 15 Z" fill="none" stroke="#8C4A2E" strokeWidth={1} strokeOpacity={0.4} />
      <Path d="M8 21 L18 15 L22 26 L10 30 Z" fill="none" stroke="#8C4A2E" strokeWidth={1} strokeOpacity={0.4} />
      <Path d="M48 21 L38 15 L34 26 L46 30 Z" fill="none" stroke="#8C4A2E" strokeWidth={1} strokeOpacity={0.4} />
      <Ellipse cx={59} cy={26} rx={8} ry={7} fill="#7CA35E" />
      <Path d="M20 8 C18 4 20 2 22 4" stroke="#5A7A44" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M23 6 C22 2 24 0 26 2" stroke="#5A7A44" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M60 23 C58 21 61 20 62 22" stroke="#3A2A1A" strokeWidth={1.3} fill="none" strokeLinecap="round" />
      <Path d="M56 30 C58 32 61 32 62 30" stroke="#3A2A1A" strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function HareIcon() {
  return (
    <Svg width={HARE_W} height={HARE_H} viewBox="0 0 60 55">
      <Ellipse cx={18} cy={43} rx={10} ry={8} fill="#CC9A63" />
      <Ellipse cx={38} cy={45} rx={6} ry={7} fill="#CC9A63" />
      <Rect x={10} y={47} width={8} height={6} rx={3} fill="#F2E3C6" />
      <Rect x={34} y={49} width={7} height={6} rx={3} fill="#F2E3C6" />
      <Ellipse cx={9} cy={36} rx={5} ry={4} fill="#F2E3C6" />
      <Ellipse cx={28} cy={30} rx={17} ry={13} fill="#D9A66C" />
      <Ellipse cx={23} cy={35} rx={10} ry={8} fill="#F2E3C6" fillOpacity={0.85} />
      <Ellipse cx={24} cy={24} rx={8} ry={6} fill="#EFC79A" fillOpacity={0.5} />
      <Path d="M40 8 C35 -6 30 -6 32 6 C33 12 37 16 40 18 Z" fill="#D9A66C" />
      <Path d="M35 8 C33 -4 29 -3 30 7 C31 12 33 15 35 18 Z" fill="#EBB9A0" />
      <Path d="M48 6 C45 -8 40 -8 41 4 C42 10 45 15 48 17 Z" fill="#D9A66C" />
      <Path d="M44 6 C42 -6 38 -5 39 5 C40 10 42 14 44 17 Z" fill="#EBB9A0" />
      <Circle cx={44} cy={20} r={10} fill="#D9A66C" />
      <Ellipse cx={49} cy={24} rx={5.5} ry={4.5} fill="#F2E3C6" />
      <Circle cx={54} cy={23} r={1.4} fill="#B4453A" />
      <Path d="M38 18 C37 16 39 15 40 17" stroke="#5A3E22" strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Path d="M49 17 C50 19 52 19 53 17" stroke="#5A3E22" strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <Line x1={50} y1={25} x2={59} y2={23} stroke="#5A3E22" strokeWidth={0.6} />
      <Line x1={50} y1={27} x2={59} y2={28} stroke="#5A3E22" strokeWidth={0.6} />
      <Line x1={49} y1={26} x2={57} y2={32} stroke="#5A3E22" strokeWidth={0.6} />
    </Svg>
  );
}

function HareNappingIcon() {
  return (
    <Svg width={HARE_NAP_W} height={HARE_NAP_H} viewBox="0 0 60 40">
      <Ellipse cx={26} cy={30} rx={22} ry={9} fill="#D9A66C" />
      <Ellipse cx={20} cy={27} rx={12} ry={9} fill="#F2E3C6" fillOpacity={0.7} />
      <Ellipse cx={12} cy={24} rx={8} ry={7} fill="#D9A66C" />
      <Path d="M6 18 C2 8 6 3 9 8 C10 12 9 17 9 18 Z" fill="#D9A66C" />
      <Path d="M6 18 C4 10 6 6 8 9 C9 12 8 16 8 17 Z" fill="#EBB9A0" />
      <Path d="M15 24 C18 22 21 24 18 26" stroke="#3A2A1A" strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <SvgText x={30} y={12} fontSize={11} fill={PALETTE.textSecondary}>z</SvgText>
      <SvgText x={38} y={6} fontSize={8} fill={PALETTE.textSecondary}>z</SvgText>
    </Svg>
  );
}

function TreeIcon() {
  return (
    <Svg width={22} height={25} viewBox="0 0 30 34">
      <Rect x={12} y={20} width={6} height={14} fill={PALETTE.treeTrunk} />
      <Ellipse cx={15} cy={14} rx={15} ry={14} fill={PALETTE.treeLeafOuter} />
      <Ellipse cx={15} cy={12} rx={11} ry={10} fill={PALETTE.treeLeafInner} />
    </Svg>
  );
}

function FlagIcon() {
  return (
    <Svg width={18} height={23} viewBox="0 0 24 30">
      <Line x1={11.5} y1={2} x2={11.5} y2={28} stroke={PALETTE.flagPole} strokeWidth={3} />
      <Path d="M13 3 L23 7 L13 11 Z" fill={PALETTE.flagCloth} />
    </Svg>
  );
}

function RaceTrack({
  progressPct,
  runner,
  runnerHeight,
}: {
  progressPct: number;
  runner: React.ReactNode;
  runnerHeight: number;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    if (trackWidth <= 0) return;
    const usable = trackWidth - RUNNER_SIZE;
    Animated.timing(translateX, {
      toValue: Math.max((progressPct / 100) * usable, 0),
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [progressPct, trackWidth]);

  const fillWidth = trackWidth > 0 ? (progressPct / 100) * trackWidth : 0;

  return (
    <View style={[styles.trackRow, { height: Math.max(runnerHeight + 6, 30) }]}>
      <View style={styles.trackEndIcon}>
        <TreeIcon />
      </View>
      <View style={styles.trackMiddle} onLayout={onLayout}>
        <View style={styles.trackLine} />
        <View style={[styles.trackFill, { width: fillWidth }]} />
        <Animated.View
          style={[styles.runner, { top: -6, transform: [{ translateX }] }]}
        >
          {runner}
        </Animated.View>
      </View>
      <View style={styles.trackEndIcon}>
        <FlagIcon />
      </View>
    </View>
  );
}

export default function HareTortoiseWidget({ dailyMinutes, onRaceComplete }: HareTortoiseWidgetProps) {
  const rows: DayRow[] = useMemo(() => {
    let tortoiseCum = 0;
    let hareCum = 0;
    const out: DayRow[] = [];
    for (let i = 0; i < RACE_DAYS; i++) {
      const minutes = dailyMinutes[i] ?? 0;
      tortoiseCum = Math.min(tortoiseCum + TORTOISE_DAILY_PCT, 100);
      hareCum = Math.min(hareCum + hareDailyPct(minutes), 100);
      out.push({ day: i + 1, minutes, tortoisePct: tortoiseCum, harePct: hareCum });
    }
    return out;
  }, [dailyMinutes]);

  const currentDay = Math.min(dailyMinutes.length, RACE_DAYS);
  const last = rows[Math.max(currentDay - 1, 0)];
  const raceFinished = currentDay >= RACE_DAYS;

  const winner: 'hare' | 'tortoise' | 'tie' = useMemo(() => {
    if (!last) return 'tie';
    if (Math.abs(last.tortoisePct - last.harePct) < 0.01) return 'tie';
    return last.tortoisePct > last.harePct ? 'tortoise' : 'hare';
  }, [last]);

  const hareLead = (last?.harePct ?? 0) - (last?.tortoisePct ?? 0);
  const isNapping = hareLead > NAP_LEAD_THRESHOLD;
  const tortoiseTrailingHare = (last?.tortoisePct ?? 0) - (last?.harePct ?? 0);

  useEffect(() => {
    if (raceFinished && onRaceComplete) {
      onRaceComplete(winner);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceFinished]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>The hare and the tortoise</Text>
      <Text style={styles.subtitle}>
        {raceFinished
          ? `Race over — ${winner === 'tie' ? "it's a tie" : `the ${winner} wins`}`
          : `Day ${currentDay} of ${RACE_DAYS}`}
      </Text>

      <View style={styles.pathWrap}>
        <RaceTrack progressPct={last?.tortoisePct ?? 0} runner={<TortoiseIcon />} runnerHeight={TORTOISE_H} />
        <View style={{ height: 14 }} />
        <RaceTrack
          progressPct={last?.harePct ?? 0}
          runner={isNapping ? <HareNappingIcon /> : <HareIcon />}
          runnerHeight={isNapping ? HARE_NAP_H : HARE_H}
        />
      </View>

      {isNapping && (
        <Text style={styles.napNote}>
          The hare is dozing under a tree, sure he's got this — the tortoise just keeps walking.
        </Text>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>tortoise</Text>
          <Text style={styles.statValue}>{Math.round(last?.tortoisePct ?? 0)}%</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>hare</Text>
          <Text style={styles.statValue}>{Math.round(last?.harePct ?? 0)}%</Text>
        </View>
      </View>

      {raceFinished && (
        <Text style={styles.moral}>
          {winner === 'tortoise'
            ? 'Steady daily sessions beat sporadic cramming — slow and steady won the race.'
            : winner === 'hare'
            ? 'The hare kept a pace close to steady too, so speed paid off this time.'
            : 'Both finished neck and neck.'}
        </Text>
      )}

      {!raceFinished && tortoiseTrailingHare >= 0 && (
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>
            Tip: to help the hare win, log more than {CALIBRATION_MINUTES} minutes every single day,
            all {RACE_DAYS} days — one big day can't make up for a skipped one.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: PALETTE.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: PALETTE.textSecondary,
    marginBottom: 12,
  },
  pathWrap: {
    backgroundColor: PALETTE.statBg,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackEndIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackMiddle: {
    flex: 1,
    height: '100%',
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  trackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: PALETTE.path,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: PALETTE.pathFill,
  },
  runner: {
    position: 'absolute',
    left: 0,
  },
  napNote: {
    fontSize: 13,
    color: PALETTE.textSecondary,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: PALETTE.statBg,
    borderRadius: 10,
    padding: 10,
  },
  statLabel: {
    fontSize: 12,
    color: PALETTE.textSecondary,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: PALETTE.textPrimary,
  },
  moral: {
    marginTop: 12,
    fontSize: 13,
    color: PALETTE.textSecondary,
    fontStyle: 'italic',
  },
  tipBox: {
    marginTop: 12,
    backgroundColor: PALETTE.tipBg,
    borderRadius: 10,
    padding: 10,
  },
  tipText: {
    fontSize: 12,
    color: PALETTE.tipText,
  },
});
