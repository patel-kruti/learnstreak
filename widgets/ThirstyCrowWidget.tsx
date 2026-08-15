/**
 * ThirstyCrowWidget
 *
 * Uses React Native's built-in `Animated` (not Reanimated) for all animations so
 * that the SVG elements from react-native-svg remain plain components — no
 * createAnimatedComponent wrapping is needed for G/Path, which avoids the Reanimated 4
 * + react-native-svg + New Architecture compatibility issues in Expo Go.
 *
 * Only `Rect` is wrapped so the water height can animate smoothly without setState.
 * All other SVG transform strings are driven by Animated listeners → local state.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// Only the water Rect needs to be an AnimatedComponent (numeric height/y props).
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export interface ThirstyCrowWidgetProps {
  sessions: Array<{ date: string; duration: number }>;
  goalMinutes?: number;
}

export function ThirstyCrowWidget({ sessions, goalMinutes = 60 }: ThirstyCrowWidgetProps) {
  // ── Derived progress ─────────────────────────────────────────────────────────
  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
  const progress     = Math.min(1, Math.max(0, totalMinutes / goalMinutes));
  const BASE_H       = 22;
  const targetWaterH = BASE_H + progress * 174;

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [toastMessage, setToastMessage]             = useState<string | null>(null);
  const [showMoral, setShowMoral]                   = useState(false);
  const [crowMood, setCrowMood]                     = useState<'calm' | 'seeking' | 'happy'>('calm');
  const [triggeredMilestones, setTriggeredMilestones] = useState<number[]>([]);

  // SVG transform strings – updated by Animated listeners (JS-thread, no native driver)
  const [crowDipTransform,       setCrowDipTransform]       = useState('rotate(0, 132, 132)');
  const [crowWingTransform,      setCrowWingTransform]      = useState('rotate(0, 112, 145)');
  const [crowContainerTransform, setCrowContainerTransform] = useState('translate(0, 0)');

  // ── RN Animated values ───────────────────────────────────────────────────────
  const animWaterH  = useRef(new Animated.Value(BASE_H)).current;
  // y = 325 - height, derived automatically
  const animY       = Animated.subtract(325, animWaterH);

  const animDip     = useRef(new Animated.Value(0)).current;  // crow head dip angle
  const animWing    = useRef(new Animated.Value(0)).current;  // wing flap angle
  const animTX      = useRef(new Animated.Value(0)).current;  // crow translate X
  const animTY      = useRef(new Animated.Value(0)).current;  // crow translate Y
  const animWobble  = useRef(new Animated.Value(0)).current;  // happy wobble angle

  const wingLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Refs track current values for the multi-value container transform string
  const txRef     = useRef(0);
  const tyRef     = useRef(0);
  const wobbleRef = useRef(0);

  // ── Wire animated listeners → SVG transform strings ──────────────────────────
  useEffect(() => {
    const ids = [
      animDip.addListener(({ value }) =>
        setCrowDipTransform(`rotate(${value.toFixed(1)}, 132, 132)`)),

      animWing.addListener(({ value }) =>
        setCrowWingTransform(`rotate(${value.toFixed(1)}, 112, 145)`)),

      animTX.addListener(({ value }) => {
        txRef.current = value;
        setCrowContainerTransform(
          `translate(${txRef.current.toFixed(1)}, ${tyRef.current.toFixed(1)}) rotate(${wobbleRef.current.toFixed(1)}, 112, 145)`
        );
      }),
      animTY.addListener(({ value }) => {
        tyRef.current = value;
        setCrowContainerTransform(
          `translate(${txRef.current.toFixed(1)}, ${tyRef.current.toFixed(1)}) rotate(${wobbleRef.current.toFixed(1)}, 112, 145)`
        );
      }),
      animWobble.addListener(({ value }) => {
        wobbleRef.current = value;
        setCrowContainerTransform(
          `translate(${txRef.current.toFixed(1)}, ${tyRef.current.toFixed(1)}) rotate(${wobbleRef.current.toFixed(1)}, 112, 145)`
        );
      }),
    ];

    return () => {
      animDip.removeAllListeners();
      animWing.removeAllListeners();
      animTX.removeAllListeners();
      animTY.removeAllListeners();
      animWobble.removeAllListeners();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stone geometry ───────────────────────────────────────────────────────────
  function stoneRadius(duration: number) {
    if (duration <= 30)  return 9;
    if (duration <= 60)  return 13;
    if (duration <= 90)  return 16;
    if (duration <= 120) return 19;
    if (duration <= 180) return 22;
    return 26;
  }

  const stonesData = sessions.map((session, index) => {
    const rx = stoneRadius(session.duration);
    const ry = rx * 0.58;
    const row = Math.floor(index / 3);
    const col = index % 3;
    return { rx, ry, cx: 152 + col * 26 + (row % 2 === 0 ? 5 : 0), cy: 308 - row * 13 };
  });

  // ── Milestone toasts ─────────────────────────────────────────────────────────
  function checkMilestones(p: number) {
    const pct = p * 100;
    let text = '';
    let key  = 0;
    if      (pct >= 100 && !triggeredMilestones.includes(100)) { text = "The crow drinks deeply… Oh, sweet water!";            key = 100; }
    else if (pct >= 80  && !triggeredMilestones.includes(80))  { text = "So close! The crow can almost taste it!";             key = 80;  }
    else if (pct >= 55  && !triggeredMilestones.includes(55))  { text = "The water is rising beautifully in the warm sun.";    key = 55;  }
    else if (pct >= 30  && !triggeredMilestones.includes(30))  { text = "Look! The crow notices the water getting closer.";    key = 30;  }
    else if (pct >= 10  && !triggeredMilestones.includes(10))  { text = "A soft breeze blows as the first stones drop…";      key = 10;  }

    if (key > 0) {
      setTriggeredMilestones(prev => [...prev, key]);
      setToastMessage(text);
      if (key === 100) {
        triggerHappyEndgame();
      } else {
        setTimeout(() => setToastMessage(null), 4000);
      }
    }
  }

  // ── Endgame sequence ─────────────────────────────────────────────────────────
  function startWingFlap() {
    wingLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(animWing, { toValue: -35, duration: 90, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(animWing, { toValue:  25, duration: 90, easing: Easing.linear, useNativeDriver: false }),
      ])
    );
    wingLoopRef.current.start();
  }

  function triggerHappyEndgame() {
    // 1 — dip beak toward water
    Animated.timing(animDip, { toValue: 32, duration: 700, easing: Easing.bezier(0.25, 1, 0.5, 1), useNativeDriver: false })
      .start(() => {
        // 2 — snap back up
        Animated.timing(animDip, { toValue: -10, duration: 400, easing: Easing.back(1.5), useNativeDriver: false })
          .start(() => {
            setCrowMood('happy');
            setToastMessage('The crow happily chirps and prepares for takeoff!');
            // 3 — happy wobble ×4
            Animated.sequence([
              Animated.timing(animWobble, { toValue: -6, duration: 80, useNativeDriver: false }),
              Animated.timing(animWobble, { toValue:  6, duration: 80, useNativeDriver: false }),
              Animated.timing(animWobble, { toValue: -6, duration: 80, useNativeDriver: false }),
              Animated.timing(animWobble, { toValue:  6, duration: 80, useNativeDriver: false }),
              Animated.timing(animWobble, { toValue:  0, duration: 80, useNativeDriver: false }),
            ]).start(() => {
              // 4 — flap and fly away
              startWingFlap();
              Animated.parallel([
                Animated.timing(animTX, { toValue: 360,  duration: 2200, easing: Easing.bezier(0.42, 0, 0.58, 1),   useNativeDriver: false }),
                Animated.timing(animTY, { toValue: -360, duration: 2200, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
              ]).start(() => setShowMoral(true));
            });
          });
      });
  }

  // ── Drive animations when sessions / progress changes ────────────────────────
  useEffect(() => {
    Animated.timing(animWaterH, {
      toValue: targetWaterH,
      duration: 900,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: false,
    }).start();

    if (progress < 1) {
      Animated.timing(animDip, {
        toValue: progress * 16,
        duration: 700,
        useNativeDriver: false,
      }).start();
      if (progress >= 0.7) setCrowMood('seeking');
    }

    checkMilestones(progress);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetWaterH, progress]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <View style={styles.canvasWrapper}>
        <Svg width="100%" height="100%" viewBox="0 0 400 400">
          <Defs>
            <LinearGradient id="ghibliSky" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0%"   stopColor="#3A86C8" />
              <Stop offset="45%"  stopColor="#70B5E8" />
              <Stop offset="100%" stopColor="#CCE8F7" />
            </LinearGradient>
            <LinearGradient id="ghibliGrass" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0%"   stopColor="#55A64E" />
              <Stop offset="100%" stopColor="#2A6033" />
            </LinearGradient>
            <LinearGradient id="ghibliMeadowHill" x1="0" x2="1" y1="0" y2="1">
              <Stop offset="0%"   stopColor="#7BC676" />
              <Stop offset="100%" stopColor="#438E3D" />
            </LinearGradient>
            <LinearGradient id="ceramicPot" x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0%"   stopColor="#A25025" />
              <Stop offset="25%"  stopColor="#C86D3C" />
              <Stop offset="70%"  stopColor="#E08B58" />
              <Stop offset="100%" stopColor="#873B13" />
            </LinearGradient>
            <LinearGradient id="ghibliWater" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0%"   stopColor="#52C4D9" stopOpacity={0.88} />
              <Stop offset="60%"  stopColor="#3592CE" stopOpacity={0.92} />
              <Stop offset="100%" stopColor="#1E61A7" stopOpacity={0.95} />
            </LinearGradient>
            <ClipPath id="potInnerCavity">
              <Ellipse cx="180" cy="255" rx="55" ry="71" />
              <Rect x="152" y="146" width="56" height="50" />
            </ClipPath>
          </Defs>

          {/* Sky */}
          <Rect fill="url(#ghibliSky)" width="400" height="320" />
          {/* Sun */}
          <Circle cx="70" cy="75" r="32" fill="#FFF7D6" opacity={0.65} />
          <Circle cx="70" cy="75" r="20" fill="#FFFFFF" opacity={0.9} />
          {/* Cloud */}
          <G fill="#FFFFFF" opacity={0.75}>
            <Circle cx="290" cy="65" r="25" />
            <Circle cx="325" cy="55" r="34" />
            <Circle cx="360" cy="68" r="22" />
            <Rect x="270" y="66" width="110" height="20" rx="10" />
          </G>
          {/* Ground */}
          <Path d="M-40 325 Q50 280 160 325 T380 310 Q420 310 450 325 Z" fill="url(#ghibliMeadowHill)" opacity={0.85} />
          <Rect x="0" y="320" width="400" height="80" fill="url(#ghibliGrass)" />
          <Ellipse cx="180" cy="336" rx="68" ry="12" fill="#1C3F22" opacity={0.4} />
          {/* Tree */}
          <Path d="M345 330 L350 210 L362 330 Z" fill="#604227" />
          <G fill="#397D34">
            <Circle cx="325" cy="195" r="35" />
            <Circle cx="365" cy="185" r="42" />
            <Circle cx="345" cy="150" r="38" />
          </G>
          <G fill="#63A35D" opacity={0.7}>
            <Circle cx="335" cy="185" r="20" />
            <Circle cx="355" cy="150" r="22" />
          </G>
          {/* Ground rocks */}
          <Ellipse cx="90"  cy="345" rx="12" ry="5" fill="#6E7A8A" />
          <Ellipse cx="275" cy="350" rx="15" ry="7" fill="#525E6B" />
          {/* Pot handle */}
          <Path d="M224 182 C260 185 262 255 226 272" fill="none" stroke="url(#ceramicPot)" strokeWidth="11" strokeLinecap="round" />
          {/* Pot body */}
          <Ellipse cx="180" cy="255" rx="56" ry="72" fill="url(#ceramicPot)" />
          <Rect x="148" y="145" width="64" height="42" rx="5" fill="url(#ceramicPot)" />
          <Ellipse cx="180" cy="145" rx="32" ry="7" fill="#682F10" />

          {/* Water + stones (clipped inside pot) */}
          <G clipPath="url(#potInnerCavity)">
            {/* Animated water — only this Rect is animated via RN Animated */}
            <AnimatedRect fill="url(#ghibliWater)" x={110} width={140} height={animWaterH} y={animY as any} />
            {/* Surface ripples */}
            <Path d="M135 200 Q160 192 185 200 T235 200" fill="none" stroke="#E3F9FD" strokeWidth="2" opacity={0.5} />
            <Path d="M140 245 Q175 238 210 245" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity={0.3} />
            {/* Session stones */}
            {stonesData.map((stone, idx) => (
              <G key={idx}>
                <Ellipse cx={stone.cx} cy={stone.cy} rx={stone.rx} ry={stone.ry} fill="#3A4454" />
                <Ellipse
                  cx={stone.cx}
                  cy={stone.cy - stone.ry * 0.25}
                  rx={stone.rx * 0.6}
                  ry={stone.ry * 0.3}
                  fill="#707C91"
                  opacity={0.4}
                />
              </G>
            ))}
          </G>

          {/* ── Crow — SVG transform strings are updated by Animated listeners ── */}
          <G transform={crowContainerTransform}>
            {/* Legs */}
            <Path d="M137 142 L134 149 M142 142 L143 150" stroke="#1E2229" strokeWidth="3" strokeLinecap="round" />
            {/* Tail */}
            <Path d="M86 163 L55 174 L68 156 Z" fill="#252A34" />
            {/* Body */}
            <Ellipse cx="112" cy="152" rx="25" ry="17" fill="#252A34" />
            {/* Wing — animated */}
            <Path d="M106 145 C94 138 112 110 126 138 Z" fill="#393F4D" transform={crowWingTransform} />
            {/* Head — animated dip toward water */}
            <G transform={crowDipTransform}>
              <Circle cx="132" cy="132" r="15" fill="#252A34" />
              {/* Eye */}
              {crowMood === 'happy' ? (
                <Path d="M133 126 Q137 121 141 126" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
              ) : (
                <G>
                  <Circle cx="137" cy="128" r="5"   fill="#FFFFFF" />
                  <Circle cx="138" cy="128" r="2.5" fill="#1A1C23" />
                </G>
              )}
              {/* Beak */}
              {crowMood === 'happy' ? (
                <G transform="rotate(-10, 145, 131)">
                  <Path d="M145 127 L164 128 L145 132 Z" fill="#F4C46A" />
                  <Path d="M144 133 L160 137 L143 135 Z" fill="#DFAC4F" />
                </G>
              ) : crowMood === 'seeking' ? (
                <G>
                  <Path d="M146 127 L165 131 L146 134 Z" fill="#F4C46A" />
                  <Path d="M145 135 L160 140 L144 138 Z" fill="#DFAC4F" />
                </G>
              ) : (
                <Path d="M145 127 C154 129 164 138 161 142 Z" fill="#E2A745" />
              )}
            </G>
          </G>
        </Svg>
      </View>

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <Text style={styles.metricsLabel}>
          Stones Dropped:{' '}
          <Text style={styles.metricsHighlight}>{sessions.length}</Text>
        </Text>
        <Text style={styles.metricsLabel}>
          Goal Progress:{' '}
          <Text style={styles.metricsHighlight}>{Math.round(progress * 100)}%</Text>
        </Text>
      </View>

      {/* Wisdom card — revealed when goal is reached */}
      {showMoral && (
        <View style={styles.cardContainer}>
          <Text style={styles.cardTitle}>🌱 Wisdom Unlocked 🌱</Text>
          <Text style={styles.cardMoral}>
            "Intelligence and perseverance overcome any obstacle. Every learning session you log is a stone. Keep dropping them."
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAF9F5',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#4A5568',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    margin: 12,
  },
  canvasWrapper: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#70B5E8',
  },
  toastContainer: {
    position: 'absolute',
    top: 20,
    left: '5%',
    right: '5%',
    zIndex: 10,
    backgroundColor: 'rgba(37, 42, 52, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  toastText: {
    color: '#FFF7D6',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  metricsLabel:    { fontSize: 14, color: '#718096', fontWeight: '600' },
  metricsHighlight:{ color: '#3592CE', fontWeight: '700' },
  cardContainer: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#7BC676',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    width: '100%',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#2A6033', marginBottom: 6 },
  cardMoral: { fontSize: 14, fontStyle: 'italic', color: '#4A5568', textAlign: 'center', lineHeight: 22 },
});
