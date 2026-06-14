import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

// expo-speech-recognition uses the device's native STT engine (Google on Android).
// No API key needed, works offline for supported languages.
// Import is wrapped in try/catch so the app still works if the package
// isn't installed yet — voice button just shows as disabled.
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = null;
try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch {
  // Package not installed — voice input gracefully disabled
}

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
  multiline = false,
  numberOfLines = 1,
  keyboardType = 'default',
  maxLength,
  style,
  inputStyle,
  editable = true,
}: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Speech recognition event handlers ──────────────────────────────────────
  // These hooks are only registered when the package is available.
  // When listening, we APPEND the recognised transcript to existing text
  // so the user can speak in multiple bursts.

  if (useSpeechRecognitionEvent) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSpeechRecognitionEvent('result', (event: any) => {
      if (event.results?.[0]?.transcript) {
        const transcript: string = event.results[0].transcript;
        // For number-pad fields (duration), only keep digits
        if (keyboardType === 'number-pad' || keyboardType === 'numeric') {
          const digits = transcript.replace(/[^0-9]/g, '');
          if (digits) onChangeText(digits);
        } else {
          // Append with a space if there's already text
          const newText = value ? `${value} ${transcript}` : transcript;
          onChangeText(maxLength ? newText.slice(0, maxLength) : newText);
        }
      }
    });

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSpeechRecognitionEvent('end', () => {
      stopPulse();
      setListening(false);
    });

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSpeechRecognitionEvent('error', (event: any) => {
      stopPulse();
      setListening(false);
      // Ignore "no-speech" — user just didn't say anything
      if (event.error !== 'no-speech') {
        Alert.alert('Voice error', 'Could not recognise speech. Please try again.');
      }
    });
  }

  // ── Pulse animation while listening ────────────────────────────────────────
  function startPulse() {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 500, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }

  function stopPulse() {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  }

  // ── Toggle listening ────────────────────────────────────────────────────────
  async function handleMicPress() {
    if (!ExpoSpeechRecognitionModule) {
      Alert.alert(
        'Voice not available',
        'Run: npx expo install expo-speech-recognition\nthen rebuild the app.'
      );
      return;
    }

    if (listening) {
      // User tapped mic again — stop early
      ExpoSpeechRecognitionModule.stop();
      stopPulse();
      setListening(false);
      return;
    }

    // Request mic permission
    const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Microphone permission needed',
        'Please allow microphone access in Settings to use voice input.'
      );
      return;
    }

    setListening(true);
    startPulse();

    ExpoSpeechRecognitionModule.start({
      lang: 'en-IN', // Indian English — change to 'en-US' if preferred
      interimResults: false,
      maxAlternatives: 1,
      continuous: false, // auto-stops after silence
    });
  }

  const voiceAvailable = !!ExpoSpeechRecognitionModule;

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          multiline && { minHeight: numberOfLines * 24 + SPACING.md * 2 },
          // Shrink right padding to make room for mic button
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
            // Align mic to top for multiline, centre for single line
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
  container: {
    position: 'relative',
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  inputWithMic: {
    // Reserve space on the right for the mic button
    paddingRight: 52,
  },
  multiline: {
    paddingTop: SPACING.md,
  },

  micWrap: {
    position: 'absolute',
    right: SPACING.sm,
  },
  micCenter: {
    top: '50%',
    marginTop: -18, // half of mic button height (36/2)
  },
  micTop: {
    top: SPACING.sm,
  },

  micBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  micIcon: {
    fontSize: 16,
  },
});
