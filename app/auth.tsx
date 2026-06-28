import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { COLORS, FONTS, RADIUS, SPACING } from '../src/constants/theme';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();

  const [mode,        setMode]        = useState<Mode>('login');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [userName,    setUserName]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [passVisible, setPassVisible] = useState(false);

  function switchMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setEmail('');
    setPassword('');
    setUserName('');
    setDisplayName('');
  }

  function sanitizeUsername(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  function errorMessage(err: any): string {
    const code = err?.code ?? '';
    if (code === 'username-taken')               return err.message;
    if (code === 'auth/email-already-in-use')    return 'This email is already registered. Try signing in.';
    if (code === 'auth/invalid-email')            return 'Enter a valid email address.';
    if (code === 'auth/wrong-password')           return 'Wrong password. Try again.';
    if (code === 'auth/user-not-found')           return 'No account found with this email.';
    if (code === 'auth/invalid-credential')       return 'Wrong email or password.';
    if (code === 'auth/too-many-requests')        return 'Too many attempts. Please wait a moment and try again.';
    if (code === 'auth/network-request-failed')   return 'No internet connection. Check your network and try again.';
    if (code === 'permission-denied')             return 'Permission denied. Check your Firestore security rules.';
    // Surface the raw message in dev so nothing is silently swallowed
    return err?.message ? `Error: ${err.message}` : 'Something went wrong. Please try again.';
  }

  async function handleSubmit() {
    const emailTrim = email.trim().toLowerCase();
    const passTrim  = password.trim();

    if (!emailTrim || !passTrim) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }

    if (mode === 'signup') {
      const userNameTrim = sanitizeUsername(userName.trim());
      const nameTrim     = displayName.trim();

      if (userNameTrim.length < 3) {
        Alert.alert('Invalid username', 'Username must be at least 3 characters (letters, numbers, underscores).');
        return;
      }
      if (!nameTrim) {
        Alert.alert('Missing info', 'Enter your display name.');
        return;
      }
      if (passTrim.length < 6) {
        Alert.alert('Weak password', 'Password must be at least 6 characters.');
        return;
      }

      setLoading(true);
      try {
        await signUp(emailTrim, passTrim, userNameTrim, nameTrim);
        router.replace('/(tabs)' as any);
      } catch (err: any) {
        Alert.alert('Sign up failed', errorMessage(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Login
    setLoading(true);
    try {
      await signIn(emailTrim, passTrim);
      router.replace('/(tabs)' as any);
    } catch (err: any) {
      Alert.alert('Sign in failed', errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === 'signup';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoBlock}>
          <Text style={styles.logoEmoji}>📚</Text>
          <Text style={styles.logoTitle}>LearnStreak</Text>
          <Text style={styles.logoSub}>
            {isSignup ? 'Create your account' : 'Welcome back'}
          </Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          {isSignup && (
            <>
              <Text style={styles.label}>Display name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Alex"
                placeholderTextColor={COLORS.textTertiary}
                autoCapitalize="words"
                returnKeyType="next"
              />

              <Text style={styles.label}>Username</Text>
              <View style={styles.usernameRow}>
                <Text style={styles.usernameAt}>@</Text>
                <TextInput
                  style={[styles.input, styles.usernameInput]}
                  value={userName}
                  onChangeText={(t) => setUserName(sanitizeUsername(t))}
                  placeholder="e.g. alex_learns"
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  maxLength={20}
                />
              </View>
              <Text style={styles.hint}>Letters, numbers, underscores only. Used by friends to find you.</Text>
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={COLORS.textTertiary}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passRow}>
            <TextInput
              style={[styles.input, styles.passInput]}
              value={password}
              onChangeText={setPassword}
              placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
              placeholderTextColor={COLORS.textTertiary}
              secureTextEntry={!passVisible}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              style={styles.passToggle}
              onPress={() => setPassVisible((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.passToggleText}>{passVisible ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.btnText}>{isSignup ? 'Create account' : 'Sign in'}</Text>
            }
          </TouchableOpacity>

          {isSignup && (
            <Text style={styles.migrationNote}>
              Your existing local data will be saved to the cloud automatically.
            </Text>
          )}
        </View>

        {/* Switch mode */}
        <TouchableOpacity onPress={switchMode} style={styles.switchRow}>
          <Text style={styles.switchText}>
            {isSignup
              ? 'Already have an account? '
              : "Don't have an account? "}
            <Text style={styles.switchLink}>
              {isSignup ? 'Sign in' : 'Sign up'}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: COLORS.white },
  container: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },

  logoBlock: { alignItems: 'center', marginBottom: SPACING.xl },
  logoEmoji: { fontSize: 52, marginBottom: SPACING.sm },
  logoTitle: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  logoSub:   { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, marginTop: 4 },

  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.xs,
  },

  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
    marginBottom: 4,
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

  usernameRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  usernameAt:   { fontSize: FONTS.sizes.lg, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold },
  usernameInput:{ flex: 1 },

  hint: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 2 },

  passRow:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  passInput:     { flex: 1 },
  passToggle:    { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  passToggleText:{ fontSize: FONTS.sizes.sm, color: COLORS.accent, fontWeight: FONTS.weights.semibold },

  btn: {
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },

  migrationNote: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  switchRow: { alignItems: 'center', marginTop: SPACING.lg },
  switchText:{ fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  switchLink:{ color: COLORS.accent, fontWeight: FONTS.weights.semibold },
});
