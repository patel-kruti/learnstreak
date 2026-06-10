import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, CATEGORIES } from '../../src/constants/theme';
import {
  saveEntry,
  updateStreak,
  getTodayDate,
  generateId,
  getEntryByDate,
  checkAndAwardBadges,
} from '../../src/utils/storage';
import { commitEntryToGitHub } from '../../src/utils/github';
import { scheduleStreakCelebration } from '../../src/utils/notifications';
import { Category, LearningEntry } from '../../src/types';

export default function AddScreen() {
  const today = getTodayDate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [alreadyLogged, setAlreadyLogged] = useState(false);
  const [existingEntry, setExistingEntry] = useState<LearningEntry | null>(null);

  useEffect(() => {
    loadToday();
  }, []);

  async function loadToday() {
    const entry = await getEntryByDate(today);
    if (entry) {
      setAlreadyLogged(true);
      setExistingEntry(entry);
      setTitle(entry.title);
      setDescription(entry.description);
      setDuration(String(entry.duration));
      setSelectedCategories(entry.categories);
    }
  }

  function toggleCategory(cat: Category) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please add a title for today\'s learning.');
      return;
    }
    if (selectedCategories.length === 0) {
      Alert.alert('Pick a category', 'Select at least one learning category.');
      return;
    }

    setSaving(true);
    try {
      const entry: LearningEntry = {
        id: existingEntry?.id ?? generateId(),
        date: today,
        categories: selectedCategories,
        title: title.trim(),
        description: description.trim(),
        duration: parseInt(duration) || 0,
        createdAt: existingEntry?.createdAt ?? Date.now(),
      };

      await saveEntry(entry);
      const newStreak = await updateStreak(today);
      const newBadges = await checkAndAwardBadges(newStreak);

      // Fire celebration notifications for new badges
      if (newBadges.length > 0) {
        await scheduleStreakCelebration(newStreak.currentStreak);
      }

      // Sync to GitHub (non-blocking, best effort)
      commitEntryToGitHub(entry).catch(() => {});

      setAlreadyLogged(true);
      setExistingEntry(entry);

      const streakMsg =
        newStreak.currentStreak > 1
          ? `\n🔥 ${newStreak.currentStreak}-day streak!`
          : '\n🌱 Streak started!';

      Alert.alert(
        alreadyLogged ? '✅ Updated!' : '🎉 Logged!',
        `Today's learning saved.${streakMsg}${newBadges.length > 0 ? '\n🏆 New badge earned!' : ''}`
      );
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.dateLabel}>{formatDisplayDate(today)}</Text>
          <Text style={styles.heading}>
            {alreadyLogged ? '✏️ Edit Today\'s Learning' : '📚 What did you learn today?'}
          </Text>
          {alreadyLogged && (
            <View style={styles.alreadyLoggedBadge}>
              <Text style={styles.alreadyLoggedText}>✅ Logged today</Text>
            </View>
          )}
        </View>

        {/* Categories */}
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const selected = selectedCategories.includes(cat.id as Category);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                onPress={() => toggleCategory(cat.id as Category)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Title */}
        <Text style={styles.label}>What did you learn?</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. React Native navigation patterns"
          placeholderTextColor={COLORS.textTertiary}
          maxLength={100}
        />

        {/* Description */}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Key takeaways, concepts, links, resources..."
          placeholderTextColor={COLORS.textTertiary}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          maxLength={2000}
        />

        {/* Duration */}
        <Text style={styles.label}>Time spent (minutes)</Text>
        <TextInput
          style={[styles.input, styles.shortInput]}
          value={duration}
          onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 45"
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="number-pad"
          maxLength={4}
        />

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveButtonText}>
              {alreadyLogged ? 'Update Entry' : 'Save Today\'s Learning'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatDisplayDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { padding: SPACING.md },

  header: { marginBottom: SPACING.lg },
  dateLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: FONTS.weights.medium,
  },
  heading: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  alreadyLoggedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
  },
  alreadyLoggedText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
    fontWeight: FONTS.weights.medium,
  },

  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  categoryChipSelected: {
    borderColor: COLORS.black,
    backgroundColor: COLORS.black,
  },
  categoryEmoji: { fontSize: 16 },
  categoryLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textSecondary,
  },
  categoryLabelSelected: {
    color: COLORS.white,
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
  textArea: {
    minHeight: 120,
    paddingTop: SPACING.md,
  },
  shortInput: {
    width: 120,
  },

  saveButton: {
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
    borderWidth: 1.5,
    borderColor: COLORS.black,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
});
