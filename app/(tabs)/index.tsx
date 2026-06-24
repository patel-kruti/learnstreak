import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
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
import VoiceInput from '../../src/components/VoiceInput';
import { CATEGORIES, COLORS, FONTS, RADIUS, SPACING } from '../../src/constants/theme';
import { Category, LearningEntry } from '../../src/types';
import { commitEntryToGitHub } from '../../src/utils/github';
import { scheduleStreakCelebration } from '../../src/utils/notifications';
import {
  checkAndAwardBadges,
  clearPendingEdit,
  deleteEntry,
  formatMinutes,
  generateId,
  getEntriesForDate,
  getPendingEdit,
  getTodayDate,
  saveEntry,
  updateStreak,
} from '../../src/utils/storage';

function xAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export default function AddScreen() {
  const today = getTodayDate();
  const scrollRef = useRef<ScrollView>(null);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration]       = useState('');
  const [saving, setSaving]           = useState(false);

  // editingEntry: null = adding new, non-null = editing existing
  const [editingEntry, setEditingEntry] = useState<LearningEntry | null>(null);

  // ── Session list ────────────────────────────────────────────────────────────
  const [todaySessions, setTodaySessions] = useState<LearningEntry[]>([]);

  useFocusEffect(useCallback(() => {
    // Run both on every focus — this fires even when navigating between tabs
    // because tab screens stay mounted (useFocusEffect fires on every re-focus)
    loadTodaySessions();

    // Check if History tab left a pending edit for us
    getPendingEdit().then((pending) => {
      if (!pending) return;
      clearPendingEdit();
      setEditingEntry(pending);
      setSelectedCategory(pending.category);
      setTitle(pending.title);
      setDescription(pending.description);
      setDuration(String(pending.duration));
      // Small delay so layout is ready before scrolling
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  async function loadTodaySessions() {
    const entries = await getEntriesForDate(today);
    setTodaySessions([...entries].sort((a, b) => a.createdAt - b.createdAt));
  }

  // ── Form helpers ────────────────────────────────────────────────────────────

  function resetForm() {
    setSelectedCategory(null);
    setTitle('');
    setDescription('');
    setDuration('');
    setEditingEntry(null);
  }

  // Load a session into the form for editing, then scroll to top
  function startEditing(entry: LearningEntry) {
    setEditingEntry(entry);
    setSelectedCategory(entry.category);
    setTitle(entry.title);
    setDescription(entry.description);
    setDuration(String(entry.duration));
    // Scroll to top so the user sees the form
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function validate(): string | null {
    if (!selectedCategory) return 'Pick a category for this session.';
    if (!title.trim())     return 'Add a title — what did you learn?';
    const mins = parseInt(duration);
    if (!duration || isNaN(mins) || mins <= 0) return 'Enter the time you spent (in minutes).';
    return null;
  }

  // ── Save / Update ───────────────────────────────────────────────────────────

  async function handleSave() {
    const err = validate();
    if (err) { xAlert('Missing info', err); return; }

    setSaving(true);
    try {
      if (editingEntry) {
        // ── UPDATE existing entry ──────────────────────────────────────────
        // Preserve id, date, createdAt — only overwrite the user-editable fields
        const updated: LearningEntry = {
          ...editingEntry,
          category:    selectedCategory!,
          title:       title.trim(),
          description: description.trim(),
          duration:    parseInt(duration),
        };
        await saveEntry(updated);
        commitEntryToGitHub(updated).catch(() => {});
        xAlert('✅ Session updated', `"${updated.title}" saved.`);
        resetForm();
        await loadTodaySessions();

      } else {
        // ── ADD new entry ──────────────────────────────────────────────────
        const isFirstEntryToday = todaySessions.length === 0;
        const entry: LearningEntry = {
          id:          generateId(),
          date:        today,
          category:    selectedCategory!,
          title:       title.trim(),
          description: description.trim(),
          duration:    parseInt(duration),
          createdAt:   Date.now(),
        };

        await saveEntry(entry);

        if (isFirstEntryToday) {
          const newStreak = await updateStreak(today);
          const newBadges = await checkAndAwardBadges(newStreak);
          if (newBadges.length > 0) await scheduleStreakCelebration(newStreak.currentStreak);
          const streakMsg = newStreak.currentStreak > 1
            ? `\n🔥 ${newStreak.currentStreak}-day streak!` : '\n🌱 Streak started!';
          xAlert('🎉 Session logged!',
            `Great work!${streakMsg}${newBadges.length > 0 ? '\n🏆 New badge earned!' : ''}`);
        } else {
          xAlert('✅ Session added', `+${duration}m of ${getCategoryLabel(selectedCategory!)} logged.`);
        }

        commitEntryToGitHub(entry).catch(() => {});
        resetForm();
        await loadTodaySessions();
      }
    } catch {
      xAlert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(entry: LearningEntry) {
    // If we're currently editing this entry, cancel the edit first
    if (editingEntry?.id === entry.id) resetForm();

    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Remove "${entry.title}"?`)
      : await new Promise<boolean>((resolve) =>
          Alert.alert('Delete session?', `Remove "${entry.title}"?`, [
            { text: 'Cancel',  style: 'cancel',      onPress: () => resolve(false) },
            { text: 'Delete',  style: 'destructive',  onPress: () => resolve(true)  },
          ])
        );
    if (!confirmed) return;
    await deleteEntry(entry.id);
    await loadTodaySessions();
  }

  const totalTodayMinutes = todaySessions.reduce((sum, e) => sum + e.duration, 0);
  const isEditing = editingEntry !== null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.dateLabel}>{formatDisplayDate(today)}</Text>
          <Text style={styles.heading}>
            {isEditing ? '✏️ Edit session' : '📚 Log a learning session'}
          </Text>
          {todaySessions.length > 0 && !isEditing && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>
                ✅ {todaySessions.length} session{todaySessions.length > 1 ? 's' : ''} · {formatMinutes(totalTodayMinutes)} today
              </Text>
            </View>
          )}
          {/* Edit mode banner */}
          {isEditing && (
            <View style={styles.editBanner}>
              <Text style={styles.editBannerText}>
                Editing: {editingEntry!.title}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <Text style={styles.editBannerCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Category ────────────────────────────────────────────────────── */}
        <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const selected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                onPress={() => setSelectedCategory(cat.id as Category)}
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

        {/* ── Title ───────────────────────────────────────────────────────── */}
        <Text style={styles.label}>What did you learn? <Text style={styles.required}>*</Text></Text>
        <VoiceInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. React Native navigation patterns"
          maxLength={100}
        />

        {/* ── Notes ───────────────────────────────────────────────────────── */}
        <Text style={styles.label}>Notes <Text style={styles.optional}>(optional)</Text></Text>
        <VoiceInput
          value={description}
          onChangeText={setDescription}
          placeholder="Key takeaways, links, resources..."
          multiline
          numberOfLines={4}
          maxLength={2000}
        />

        {/* ── Duration ────────────────────────────────────────────────────── */}
        <Text style={styles.label}>Time spent (minutes) <Text style={styles.required}>*</Text></Text>
        <View style={styles.durationRow}>
          {[15, 30, 45, 60, 90].map((mins) => (
            <TouchableOpacity
              key={mins}
              style={[styles.durationChip, duration === String(mins) && styles.durationChipSelected]}
              onPress={() => setDuration(String(mins))}
            >
              <Text style={[styles.durationChipText, duration === String(mins) && styles.durationChipTextSelected]}>
                {mins}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.durationInput}
          value={duration}
          onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ''))}
          placeholder="or type any number e.g. 73"
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="number-pad"
          maxLength={4}
        />

        {/* ── Save / Update button ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            isEditing && styles.saveButtonEdit,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.saveButtonText}>
                {isEditing ? '✓ Update Session' : '+ Add Session'}
              </Text>
          }
        </TouchableOpacity>

        {/* ── Today's sessions ────────────────────────────────────────────── */}
        {todaySessions.length > 0 && (
          <>
            <View style={styles.sessionsDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>Today's sessions</Text>
              <View style={styles.dividerLine} />
            </View>

            {todaySessions.map((entry) => (
              <SessionCard
                key={entry.id}
                entry={entry}
                isBeingEdited={editingEntry?.id === entry.id}
                onEdit={() => startEditing(entry)}
                onDelete={() => handleDelete(entry)}
              />
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total today</Text>
              <Text style={styles.totalValue}>{formatMinutes(totalTodayMinutes)}</Text>
            </View>
          </>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  entry,
  isBeingEdited,
  onEdit,
  onDelete,
}: {
  entry: LearningEntry;
  isBeingEdited: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const catDef = CATEGORIES.find((c) => c.id === entry.category);
  return (
    <View style={[styles.sessionCard, isBeingEdited && styles.sessionCardEditing]}>
      <View style={styles.sessionLeft}>
        <View style={styles.sessionCatChip}>
          <Text style={styles.sessionCatEmoji}>{catDef?.emoji}</Text>
          <Text style={styles.sessionCatLabel}>{catDef?.label}</Text>
        </View>
        <Text style={styles.sessionTitle} numberOfLines={1}>{entry.title}</Text>
        {entry.description
          ? <Text style={styles.sessionDesc} numberOfLines={1}>{entry.description}</Text>
          : null}
      </View>

      <View style={styles.sessionRight}>
        <Text style={styles.sessionDuration}>{formatMinutes(entry.duration)}</Text>
        <View style={styles.sessionActions}>
          {/* Edit button */}
          <TouchableOpacity
            onPress={onEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.actionBtn, isBeingEdited && styles.actionBtnActive]}
          >
            <Text style={styles.actionBtnIcon}>✏️</Text>
          </TouchableOpacity>
          {/* Delete button */}
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.actionBtn}
          >
            <Text style={styles.sessionDelete}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDisplayDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getCategoryLabel(cat: Category): string {
  return CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.white },
  content:   { padding: SPACING.md },

  header:         { marginBottom: SPACING.lg },
  dateLabel:      { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: 4, fontWeight: FONTS.weights.medium },
  heading:        { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  todayBadge:     { alignSelf: 'flex-start', backgroundColor: COLORS.successLight, borderWidth: 1, borderColor: COLORS.success, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4 },
  todayBadgeText: { fontSize: FONTS.sizes.sm, color: COLORS.success, fontWeight: FONTS.weights.medium },

  // Edit mode banner
  editBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.accentLight, borderWidth: 1, borderColor: COLORS.accent,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  editBannerText:   { fontSize: FONTS.sizes.sm, color: COLORS.accent, fontWeight: FONTS.weights.medium, flex: 1 },
  editBannerCancel: { fontSize: FONTS.sizes.sm, color: COLORS.accent, fontWeight: FONTS.weights.bold, marginLeft: SPACING.sm },

  label:    { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textSecondary, marginBottom: SPACING.sm, marginTop: SPACING.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  required: { color: COLORS.danger, fontWeight: FONTS.weights.bold },
  optional: { color: COLORS.textTertiary, fontWeight: '400', textTransform: 'none' },

  categoryGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  categoryChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.white },
  categoryChipSelected: { borderColor: COLORS.black, backgroundColor: COLORS.black },
  categoryEmoji:        { fontSize: 16 },
  categoryLabel:        { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.textSecondary },
  categoryLabelSelected:{ color: COLORS.white },

  durationRow:             { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap', marginBottom: SPACING.sm },
  durationChip:            { borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 7 },
  durationChipSelected:    { borderColor: COLORS.black, backgroundColor: COLORS.black },
  durationChipText:        { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.textSecondary },
  durationChipTextSelected:{ color: COLORS.white },
  durationInput: {
    borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: FONTS.sizes.md, color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },

  saveButton:         { backgroundColor: COLORS.black, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.xl, borderWidth: 1.5, borderColor: COLORS.black, height: 52, justifyContent: 'center' },
  saveButtonEdit:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText:     { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },

  sessionsDivider: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xl, marginBottom: SPACING.md },
  dividerLine:     { flex: 1, height: 1.5, backgroundColor: COLORS.borderLight },
  dividerLabel:    { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold, color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },

  sessionCard:        { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.white, gap: SPACING.sm },
  sessionCardEditing: { borderColor: COLORS.accent, borderWidth: 2, backgroundColor: COLORS.accentLight },
  sessionLeft:        { flex: 1, gap: 3 },
  sessionCatChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: COLORS.surface, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.borderLight },
  sessionCatEmoji:    { fontSize: 12 },
  sessionCatLabel:    { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },
  sessionTitle:       { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  sessionDesc:        { fontSize: FONTS.sizes.sm, color: COLORS.textTertiary },
  sessionRight:       { alignItems: 'flex-end', gap: 6 },
  sessionDuration:    { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  sessionActions:     { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  actionBtn:          { padding: 2 },
  actionBtnActive:    { opacity: 0.6 },
  actionBtnIcon:      { fontSize: 14 },
  sessionDelete:      { fontSize: 14, color: COLORS.textTertiary, fontWeight: FONTS.weights.bold },

  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm, borderTopWidth: 1.5, borderTopColor: COLORS.borderLight, marginTop: 4 },
  totalLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
});
