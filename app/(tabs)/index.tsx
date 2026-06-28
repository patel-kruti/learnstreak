import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VoiceInput from '../../src/components/VoiceInput';
import { ThirstyCrowWidget } from '../../widgets/ThirstyCrowWidget';
import { CATEGORIES, COLORS, CUSTOM_CATEGORY_COLORS, EMOJI_PRESETS, FONTS, RADIUS, SPACING } from '../../src/constants/theme';
import { Category, CustomCategory, LearningEntry } from '../../src/types';
import { commitEntryToGitHub } from '../../src/utils/github';
import { scheduleStreakCelebration } from '../../src/utils/notifications';
import {
  checkAndAwardBadges,
  clearPendingEdit,
  deleteCustomCategory,
  deleteEntry,
  formatMinutes,
  generateId,
  getCustomCategories,
  getEntriesForDate,
  getPendingEdit,
  getTodayDate,
  saveCustomCategory,
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

  // ── Custom categories ───────────────────────────────────────────────────────
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showAddCatModal, setShowAddCatModal]   = useState(false);
  const [newCatName, setNewCatName]             = useState('');
  const [newCatEmoji, setNewCatEmoji]           = useState('');

  // ── Session list ────────────────────────────────────────────────────────────
  const [todaySessions, setTodaySessions] = useState<LearningEntry[]>([]);

  useFocusEffect(useCallback(() => {
    loadTodaySessions();
    getCustomCategories().then(setCustomCategories);

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

  // ── All categories (built-in + custom) ──────────────────────────────────────
  const allCategories = [
    ...CATEGORIES,
    ...customCategories.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji })),
  ];

  function getCatDef(id: string) {
    return allCategories.find((c) => c.id === id);
  }

  // ── Add / delete custom category ─────────────────────────────────────────────

  function openAddCatModal() {
    setNewCatName('');
    setNewCatEmoji('');
    setShowAddCatModal(true);
  }

  async function handleCreateCategory() {
    const label = newCatName.trim();
    if (!label || !newCatEmoji) return;
    const color = CUSTOM_CATEGORY_COLORS[customCategories.length % CUSTOM_CATEGORY_COLORS.length];
    const cat: CustomCategory = { id: `custom_${generateId()}`, label, emoji: newCatEmoji, color };
    await saveCustomCategory(cat);
    const updated = await getCustomCategories();
    setCustomCategories(updated);
    setSelectedCategory(cat.id);
    setShowAddCatModal(false);
  }

  function handleLongPressCategory(cat: { id: string; label: string }) {
    // Only allow deleting custom categories
    if (!customCategories.find((c) => c.id === cat.id)) return;
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete category "${cat.label}"? Sessions using it are kept.`)) {
        deleteCat(cat.id);
      }
    } else {
      Alert.alert(
        'Delete category?',
        `"${cat.label}" will be removed. Sessions using it are kept.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteCat(cat.id) },
        ]
      );
    }
  }

  async function deleteCat(id: string) {
    await deleteCustomCategory(id);
    const updated = await getCustomCategories();
    setCustomCategories(updated);
    if (selectedCategory === id) setSelectedCategory(null);
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
          xAlert('✅ Session added', `+${duration}m of ${getCatDef(selectedCategory!)?.label ?? selectedCategory!} logged.`);
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
          {allCategories.map((cat) => {
            const selected = selectedCategory === cat.id;
            const isCustom = !!customCategories.find((c) => c.id === cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                onPress={() => setSelectedCategory(cat.id as Category)}
                onLongPress={() => handleLongPressCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                  {cat.label}
                </Text>
                {isCustom && (
                  <Text style={[styles.categoryCustomDot, selected && styles.categoryCustomDotSelected]}>
                    ·
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
          {/* Add new category chip */}
          <TouchableOpacity
            style={styles.addCatChip}
            onPress={openAddCatModal}
            activeOpacity={0.7}
          >
            <Text style={styles.addCatIcon}>+</Text>
            <Text style={styles.addCatLabel}>New</Text>
          </TouchableOpacity>
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
        <View style={styles.durationInputWrap}>
          <TextInput
            style={[styles.durationInput, duration.length > 0 && styles.durationInputWithClear]}
            value={duration}
            onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ''))}
            placeholder="or type any number e.g. 73"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="number-pad"
            maxLength={4}
          />
          {duration.length > 0 && (
            <TouchableOpacity
              style={styles.durationClearBtn}
              onPress={() => setDuration('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.durationClearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

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
                allCategories={allCategories}
              />
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total today</Text>
              <Text style={styles.totalValue}>{formatMinutes(totalTodayMinutes)}</Text>
            </View>

            {/* ── Thirsty Crow Widget ───────────────────────────────────── */}
            <ThirstyCrowWidget
              sessions={todaySessions.map(e => ({ date: e.date, duration: e.duration }))}
              goalMinutes={60}
            />
          </>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {/* ── Add Category Modal ───────────────────────────────────────────── */}
      <Modal
        visible={showAddCatModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddCatModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddCatModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalBox} onPress={() => {}}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Category</Text>
              <TouchableOpacity onPress={() => setShowAddCatModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text style={styles.modalLabel}>Name <Text style={styles.required}>*</Text></Text>
            <View style={styles.modalInputRow}>
              <TextInput
                style={styles.modalInput}
                value={newCatName}
                onChangeText={setNewCatName}
                placeholder="e.g. Photography"
                placeholderTextColor={COLORS.textTertiary}
                maxLength={30}
                autoFocus
              />
              {newCatName.length > 0 && (
                <TouchableOpacity
                  style={styles.modalClearBtn}
                  onPress={() => setNewCatName('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.modalClearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Emoji picker */}
            <Text style={styles.modalLabel}>Emoji <Text style={styles.required}>*</Text></Text>
            <View style={styles.emojiGrid}>
              {EMOJI_PRESETS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.emojiOption, newCatEmoji === emoji && styles.emojiOptionSelected]}
                  onPress={() => setNewCatEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Create */}
            <TouchableOpacity
              style={[
                styles.createCatBtn,
                (!newCatName.trim() || !newCatEmoji) && styles.createCatBtnDisabled,
              ]}
              onPress={handleCreateCategory}
              disabled={!newCatName.trim() || !newCatEmoji}
            >
              <Text style={styles.createCatBtnText}>
                {newCatEmoji ? `${newCatEmoji} Create` : 'Create'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  entry,
  isBeingEdited,
  onEdit,
  onDelete,
  allCategories,
}: {
  entry: LearningEntry;
  isBeingEdited: boolean;
  onEdit: () => void;
  onDelete: () => void;
  allCategories: { id: string; label: string; emoji: string }[];
}) {
  const catDef = allCategories.find((c) => c.id === entry.category);
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

  categoryGrid:            { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  categoryChip:            { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.white },
  categoryChipSelected:    { borderColor: COLORS.black, backgroundColor: COLORS.black },
  categoryEmoji:           { fontSize: 16 },
  categoryLabel:           { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.textSecondary },
  categoryLabelSelected:   { color: COLORS.white },
  categoryCustomDot:       { fontSize: FONTS.sizes.sm, color: COLORS.textTertiary },
  categoryCustomDotSelected:{ color: COLORS.white },
  addCatChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.white, borderStyle: 'dashed' },
  addCatIcon:  { fontSize: FONTS.sizes.md, color: COLORS.textTertiary, lineHeight: 20 },
  addCatLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.textTertiary },

  durationRow:             { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap', marginBottom: SPACING.sm },
  durationChip:            { borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 7 },
  durationChipSelected:    { borderColor: COLORS.black, backgroundColor: COLORS.black },
  durationChipText:        { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.textSecondary },
  durationChipTextSelected:{ color: COLORS.white },
  durationInputWrap:       { position: 'relative' },
  durationInput: {
    borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: FONTS.sizes.md, color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  durationInputWithClear:  { paddingRight: 52 },
  durationClearBtn:        { position: 'absolute', right: SPACING.sm, top: '50%', marginTop: -18, width: 36, height: 36, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center' },
  durationClearIcon:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' as const },

  // Add category modal
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:       { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xxl },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  modalTitle:     { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
  modalClose:     { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, padding: 4 },
  modalLabel:     { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textSecondary, marginBottom: SPACING.sm, marginTop: SPACING.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInputRow:  { position: 'relative' },
  modalInput:     { borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, padding: SPACING.md, paddingRight: 52, fontSize: FONTS.sizes.md, color: COLORS.textPrimary, backgroundColor: COLORS.white },
  modalClearBtn:  { position: 'absolute', right: SPACING.sm, top: '50%', marginTop: -18, width: 36, height: 36, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center' },
  modalClearIcon: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' as const },
  emojiGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  emojiOption:    { width: 44, height: 44, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  emojiOptionSelected: { borderColor: COLORS.black, backgroundColor: COLORS.black },
  emojiText:      { fontSize: 22 },
  createCatBtn:        { backgroundColor: COLORS.black, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg, height: 52, justifyContent: 'center' },
  createCatBtnDisabled:{ opacity: 0.35 },
  createCatBtnText:    { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },

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
