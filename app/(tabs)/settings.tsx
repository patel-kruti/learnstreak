import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { COLORS, FONTS, SPACING, RADIUS } from '../../src/constants/theme';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '../../src/utils/storage';
import { testGitHubConnection } from '../../src/utils/github';
import {
  requestNotificationPermission,
  scheduleDailyReminder,
  cancelAllNotifications,
} from '../../src/utils/notifications';
import { AppSettings } from '../../src/types';

type GitHubStatus = 'idle' | 'testing' | 'ok' | 'fail';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [githubStatus, setGithubStatus] = useState<GitHubStatus>('idle');
  // Separate local state for sensitive field — only commit on save
  const [tokenInput, setTokenInput] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const s = await getSettings();
    setSettings(s);
    // Show masked token if one is saved
    setTokenInput(s.githubToken ? s.githubToken : '');
  }

  function update(partial: Partial<AppSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const toSave: AppSettings = { ...settings, githubToken: tokenInput };
      await saveSettings(toSave);

      // Re-schedule or cancel notifications based on new settings
      if (toSave.notificationsEnabled) {
        const granted = await requestNotificationPermission();
        if (granted) {
          await scheduleDailyReminder(toSave.notificationTime);
        } else {
          Alert.alert(
            'Notifications blocked',
            'Please enable notifications for LearnStreak in your phone Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      } else {
        await cancelAllNotifications();
      }

      Alert.alert('✅ Saved', 'Settings updated successfully.');
    } catch {
      Alert.alert('Error', 'Could not save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestGitHub() {
    if (!tokenInput || !settings.githubRepo) {
      Alert.alert('Missing fields', 'Enter both your GitHub token and repo before testing.');
      return;
    }
    setGithubStatus('testing');
    const ok = await testGitHubConnection(tokenInput, settings.githubRepo);
    setGithubStatus(ok ? 'ok' : 'fail');
  }

  function handleNotificationToggle(val: boolean) {
    update({ notificationsEnabled: val });
  }

  // Parse and clamp notification time input
  function handleTimeChange(raw: string) {
    // Allow user to type freely; only validate on blur
    update({ notificationTime: raw });
  }

  function handleTimeBlur() {
    const match = settings.notificationTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      update({ notificationTime: DEFAULT_SETTINGS.notificationTime });
      return;
    }
    const h = Math.min(23, Math.max(0, parseInt(match[1])));
    const m = Math.min(59, Math.max(0, parseInt(match[2])));
    update({
      notificationTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    });
  }

  const githubStatusConfig: Record<GitHubStatus, { emoji: string; text: string; color: string }> = {
    idle:    { emoji: '🔗', text: 'Test connection',        color: COLORS.textSecondary },
    testing: { emoji: '⏳', text: 'Testing...',            color: COLORS.textSecondary },
    ok:      { emoji: '✅', text: 'Connected!',             color: COLORS.success },
    fail:    { emoji: '❌', text: 'Connection failed',      color: COLORS.danger },
  };
  const ghStatus = githubStatusConfig[githubStatus];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Profile ─────────────────────────────────────────────── */}
      <SectionHeader emoji="👤" title="Profile" />
      <View style={styles.card}>
        <FieldLabel>Your name</FieldLabel>
        <TextInput
          style={styles.input}
          value={settings.userName}
          onChangeText={(v) => update({ userName: v })}
          placeholder="e.g. Nick"
          placeholderTextColor={COLORS.textTertiary}
          maxLength={32}
          autoCapitalize="words"
        />
        <FieldHint>Used in notification greetings — "Time to learn, Nick!"</FieldHint>
      </View>

      {/* ── Notifications ───────────────────────────────────────── */}
      <SectionHeader emoji="🔔" title="Notifications" />
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.switchTitle}>Daily reminder</Text>
            <Text style={styles.switchSub}>Get nudged every day to log your learning</Text>
          </View>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={handleNotificationToggle}
            trackColor={{ false: COLORS.borderLight, true: COLORS.black }}
            thumbColor={COLORS.white}
          />
        </View>

        {settings.notificationsEnabled && (
          <>
            <Divider />
            <FieldLabel>Reminder time (24h format)</FieldLabel>
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                value={settings.notificationTime}
                onChangeText={handleTimeChange}
                onBlur={handleTimeBlur}
                placeholder="20:00"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <View style={styles.timeExamples}>
                {['08:00', '13:00', '20:00', '22:00'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.timeChip,
                      settings.notificationTime === t && styles.timeChipActive,
                    ]}
                    onPress={() => update({ notificationTime: t })}
                  >
                    <Text
                      style={[
                        styles.timeChipText,
                        settings.notificationTime === t && styles.timeChipTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <FieldHint>
              A streak-at-risk alert also fires at 23:30 if you haven't logged by then.
            </FieldHint>
          </>
        )}
      </View>

      {/* ── GitHub ──────────────────────────────────────────────── */}
      <SectionHeader emoji="☁️" title="GitHub Backup" />
      <View style={styles.card}>
        {/* How-to link */}
        <TouchableOpacity
          style={styles.helpBanner}
          onPress={() =>
            Linking.openURL(
              'https://github.com/settings/tokens/new?scopes=repo&description=LearnStreak+App'
            )
          }
        >
          <Text style={styles.helpBannerText}>
            📖 How to get a token — tap to open GitHub →
          </Text>
        </TouchableOpacity>

        <FieldLabel>Personal Access Token (PAT)</FieldLabel>
        <View style={styles.tokenRow}>
          <TextInput
            style={[styles.input, styles.tokenInput]}
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            placeholderTextColor={COLORS.textTertiary}
            secureTextEntry={!tokenVisible}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.visibilityBtn}
            onPress={() => setTokenVisible((v) => !v)}
          >
            <Text style={styles.visibilityBtnText}>{tokenVisible ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        <FieldHint>
          Create a classic token with <Text style={styles.mono}>repo</Text> scope. It's stored only on your device.
        </FieldHint>

        <FieldLabel style={{ marginTop: SPACING.md }}>Repository</FieldLabel>
        <TextInput
          style={styles.input}
          value={settings.githubRepo}
          onChangeText={(v) => update({ githubRepo: v.trim() })}
          placeholder="username/learnstreak-data"
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FieldHint>Format: <Text style={styles.mono}>username/repo-name</Text></FieldHint>

        {/* Test connection button */}
        <TouchableOpacity
          style={[styles.testBtn, githubStatus === 'ok' && styles.testBtnOk]}
          onPress={handleTestGitHub}
          disabled={githubStatus === 'testing'}
          activeOpacity={0.7}
        >
          {githubStatus === 'testing' ? (
            <ActivityIndicator size="small" color={COLORS.textSecondary} />
          ) : (
            <Text style={[styles.testBtnText, { color: ghStatus.color }]}>
              {ghStatus.emoji}  {ghStatus.text}
            </Text>
          )}
        </TouchableOpacity>

        {githubStatus === 'fail' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              Check that:{'\n'}
              • Token has <Text style={styles.mono}>repo</Text> scope{'\n'}
              • Repo exists and you have write access{'\n'}
              • Format is <Text style={styles.mono}>username/repo</Text> (no https://)
            </Text>
          </View>
        )}
      </View>

      {/* ── Data ────────────────────────────────────────────────── */}
      <SectionHeader emoji="🗄️" title="Data" />
      <View style={styles.card}>
        <Row
          label="Storage location"
          value="On-device (AsyncStorage)"
          valueColor={COLORS.textSecondary}
        />
        <Divider />
        <Row
          label="Cloud backup"
          value={settings.githubRepo || 'Not configured'}
          valueColor={settings.githubRepo ? COLORS.success : COLORS.textTertiary}
        />
        <Divider />
        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Export data',
              'Your data is already committed to GitHub as JSON files under data/YYYY/MM/. Open your repo to view or download them.',
              [
                { text: 'OK' },
                {
                  text: 'Open repo',
                  onPress: () =>
                    settings.githubRepo
                      ? Linking.openURL(`https://github.com/${settings.githubRepo}`)
                      : Alert.alert('No repo configured', 'Set up GitHub backup first.'),
                },
              ]
            )
          }
        >
          <Row label="View data on GitHub" value="→" valueColor={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* ── App info ────────────────────────────────────────────── */}
      <SectionHeader emoji="ℹ️" title="App" />
      <View style={styles.card}>
        <Row label="Version" value="1.0.0" valueColor={COLORS.textTertiary} />
        <Divider />
        <Row label="Built with" value="React Native + Expo" valueColor={COLORS.textTertiary} />
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.saveBtnText}>Save Settings</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

// ── Small sub-components ─────────────────────────────────────────────────────

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.fieldLabel, style]}>{children}</Text>;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fieldHint}>{children}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  content: { padding: SPACING.md },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
    gap: SPACING.xs,
  },

  fieldLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textTertiary,
    lineHeight: 16,
    marginTop: 2,
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
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

  // Notification time
  timeRow: { gap: SPACING.sm },
  timeInput: { width: 100 },
  timeExamples: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  timeChip: {
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  timeChipActive: { borderColor: COLORS.black, backgroundColor: COLORS.black },
  timeChipText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },
  timeChipTextActive: { color: COLORS.white },

  // Switch row
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  switchLabel: { flex: 1 },
  switchTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  switchSub: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 2 },

  // GitHub token row
  tokenRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  tokenInput: { flex: 1 },
  visibilityBtn: {
    width: 44, height: 44,
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  visibilityBtnText: { fontSize: 18 },

  // Help banner
  helpBanner: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  helpBannerText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.accent,
    fontWeight: FONTS.weights.medium,
  },

  // Test button
  testBtn: {
    marginTop: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    height: 44,
    justifyContent: 'center',
  },
  testBtnOk: { borderColor: COLORS.success, backgroundColor: COLORS.successLight },
  testBtnText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },

  // Error box
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.xs,
  },
  errorText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.danger,
    lineHeight: 18,
  },

  // Info rows
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary },
  rowValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium },

  // Save button
  saveBtn: {
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
    borderWidth: 1.5,
    borderColor: COLORS.black,
    height: 52,
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
});
