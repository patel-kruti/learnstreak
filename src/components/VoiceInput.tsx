import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

// ── Optional package loading ──────────────────────────────────────────────────
let SpeechModule: any   = null;
let useSpeechEvent: any = null;
try {
  const mod    = require('expo-speech-recognition');
  SpeechModule = mod.ExpoSpeechRecognitionModule;
  useSpeechEvent = mod.useSpeechRecognitionEvent;
} catch {}

// ── Active field registry ─────────────────────────────────────────────────────
// One module-level id tracks which VoiceInput instance is currently listening.
// Each instance is assigned a stable numeric id on mount.
let nextId  = 0;
let activeId = -1; // -1 = nobody listening

// ── Component ─────────────────────────────────────────────────────────────────

interface VoiceInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'number-pad' | 'numeric';
  maxLength?: number;
  style?: object;
  inputStyle?: object;
  editable?: boolean;
}

export default function VoiceInput({
  value,
  onChangeText,
  placeholder,
  multiline     = false,
  numberOfLines = 1,
  keyboardType  = 'default',
  maxLength,
  style,
  inputStyle,
  editable = true,
}: VoiceInputProps) {
  // Stable id for this instance — never changes after mount
  const myId = useRef(nextId++).current;

  const [listening, setListening] = useState(false);
  // Mirror of listening in a ref — readable inside event callbacks
  // without stale closure issues
  const listeningRef = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Always-updated ref for this field's transcript handler
  const handleTranscript = useRef<(t: string) => void>(() => {});
  handleTranscript.current = (transcript: string) => {
    if (keyboardType === 'number-pad' || keyboardType === 'numeric') {
      const digits = transcript.replace(/[^0-9]/g, '');
      if (digits) onChangeText(digits);
    } else {
      const newText = value ? `${value} ${transcript}` : transcript;
      onChangeText(maxLength ? newText.slice(0, maxLength) : newText);
    }
  };

  // ── Event listeners — ALWAYS called (no conditional hook) ─────────────────
  // React requires hooks to be called unconditionally.
  // We guard with `activeId === myId` instead of an `if (package)` wrapper.
  // When package is absent, useSpeechEvent is null and we call a no-op.

  const safeUseEvent = useSpeechEvent ?? (((_: string, __: any) => {}) as any);

  safeUseEvent('result', (event: any) => {
    if (activeId !== myId) return;
    const transcript: string = event?.results?.[0]?.transcript ?? '';
    if (transcript) handleTranscript.current(transcript);
  });

  safeUseEvent('end', () => {
    if (activeId !== myId) return;
    activeId = -1;
    listeningRef.current = false;
    setListening(false);
    stopPulse();
  });

  safeUseEvent('error', (event: any) => {
    if (activeId !== myId) return;
    activeId = -1;
    listeningRef.current = false;
    setListening(false);
    stopPulse();
    if (event?.error !== 'no-speech') {
      Alert.alert('Voice error', 'Could not recognise speech. Please try again.');
    }
  });

  // ── Pulse ─────────────────────────────────────────────────────────────────

  function startPulse() {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 500, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }

  function stopPulse() {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  }

  // ── Mic press ─────────────────────────────────────────────────────────────

  async function handleMicPress() {
    if (!SpeechModule) {
      Alert.alert(
        'Voice not available',
        'Run: npx expo install expo-speech-recognition\nthen rebuild the app.'
      );
      return;
    }

    // Already listening on THIS field — stop it
    if (listeningRef.current) {
      SpeechModule.stop();
      activeId = -1;
      listeningRef.current = false;
      setListening(false);
      stopPulse();
      return;
    }

    // Another field is listening — stop it first
    if (activeId !== -1) {
      SpeechModule.stop();
      activeId = -1;
      await new Promise((r) => setTimeout(r, 200));
    }

    const { status } = await SpeechModule.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Microphone permission needed',
        'Please allow microphone access in Settings to use voice input.'
      );
      return;
    }

    // Claim ownership
    activeId = myId;
    listeningRef.current = true;
    setListening(true);
    startPulse();

    SpeechModule.start({
      lang: 'en-IN',
      interimResults: false,
      maxAlternatives: 1,
      continuous: false,
    });
  }

  const voiceAvailable = !!SpeechModule;

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          multiline && { minHeight: numberOfLines * 24 + SPACING.md * 2 },
          voiceAvailable && styles.inputWithMic,
          inputStyle,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : 1}
        keyboardType={keyboardType}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
        editable={editable}
      />

      {voiceAvailable && (
        <Animated.View
          style={[
            styles.micWrap,
            multiline ? styles.micTop : styles.micCenter,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <TouchableOpacity
            style={[styles.micBtn, listening && styles.micBtnActive]}
            onPress={handleMicPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.micIcon}>{listening ? '⏹' : '🎙️'}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { position: 'relative' },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  inputWithMic: { paddingRight: 52 },
  multiline:    { paddingTop: SPACING.md },
  micWrap:      { position: 'absolute', right: SPACING.sm },
  micCenter:    { top: '50%', marginTop: -18 },
  micTop:       { top: SPACING.sm },
  micBtn: {
    width: 36, height: 36,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  micIcon:      { fontSize: 16 },
});
