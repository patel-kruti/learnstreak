import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { CATEGORIES, COLORS, FONTS, RADIUS, SPACING } from '../../src/constants/theme';
import { LearningEntry } from '../../src/types';
import { deleteEntry, formatDate, getAllEntries } from '../../src/utils/storage';

export default function HistoryScreen() {
  const [entries, setEntries] = useState<LearningEntry[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [])
  );

  async function loadEntries() {
    const all = await getAllEntries();
    setEntries(all);
  }

  function handleDelete(entry: LearningEntry) {
    Alert.alert(
      'Delete entry?',
      `Remove the entry for ${formatDate(entry.date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(entry.id);
            await loadEntries();
          },
        },
      ]
    );
  }

  const filtered = entries.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.date.includes(search)
  );

  // Group by month
  const grouped = groupByMonth(filtered);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>📋 History</Text>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search entries..."
          placeholderTextColor={COLORS.textTertiary}
          clearButtonMode="while-editing"
        />
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>No entries yet.</Text>
          <Text style={styles.emptySubtext}>Go to Add tab to log your first day!</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyText}>No results</Text>
          <Text style={styles.emptySubtext}>Try a different search term.</Text>
        </View>
      ) : (
        Object.entries(grouped)
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([month, monthEntries]) => (
            <View key={month}>
              <Text style={styles.monthLabel}>{month}</Text>
              {monthEntries.map((entry) => (
                <HistoryCard
                  key={entry.id}
                  entry={entry}
                  expanded={expandedId === entry.id}
                  onPress={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  onDelete={() => handleDelete(entry)}
                />
              ))}
            </View>
          ))
      )}
      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

function HistoryCard({
  entry,
  expanded,
  onPress,
  onDelete,
}: {
  entry: LearningEntry;
  expanded: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const isToday = entry.date === today;

  return (
    <TouchableOpacity
      style={[styles.card, isToday && styles.cardToday]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.cardDateBox}>
          <Text style={styles.cardDay}>{entry.date.split('-')[2]}</Text>
          <Text style={styles.cardMonth}>
            {new Date(entry.date + 'T12:00:00').toLocaleString('default', { month: 'short' })}
          </Text>
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={expanded ? undefined : 1}>
            {entry.title}
          </Text>
          <View style={styles.catChips}>
            {entry.category && (() => {
              const catDef = CATEGORIES.find((x) => x.id === entry.category);
              return (
                <View key={entry.category} style={styles.miniChip}>
                  <Text style={styles.miniChipText}>{catDef?.emoji} {catDef?.label ?? entry.category}</Text>
                </View>
              );
            })()}
          </View>
        </View>
        <View style={styles.cardRight}>
          {entry.duration > 0 && (
            <Text style={styles.cardDuration}>{entry.duration}m</Text>
          )}
          <Text style={styles.expandIcon}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </View>

      {/* Expanded content */}
      {expanded && entry.description ? (
        <View style={styles.cardExpanded}>
          <Text style={styles.cardDesc}>{entry.description}</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteBtnText}>🗑 Delete entry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function groupByMonth(entries: LearningEntry[]): Record<string, LearningEntry[]> {
  const groups: Record<string, LearningEntry[]> = {};
  for (const entry of entries) {
    const d = new Date(entry.date + 'T12:00:00');
    const key = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }
  return groups;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { padding: SPACING.md },
  heading: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.md },

  searchRow: { marginBottom: SPACING.md },
  searchInput: {
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md, padding: SPACING.md,
    fontSize: FONTS.sizes.md, color: COLORS.textPrimary,
    backgroundColor: COLORS.offWhite,
  },

  monthLabel: {
    fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary, marginBottom: SPACING.sm, marginTop: SPACING.md,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  card: {
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md, marginBottom: SPACING.sm,
    backgroundColor: COLORS.white, overflow: 'hidden',
  },
  cardToday: { borderColor: COLORS.black, borderWidth: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  cardDateBox: {
    width: 44, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    borderRadius: RADIUS.sm, paddingVertical: 4,
  },
  cardDay: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, lineHeight: 22 },
  cardMonth: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary, marginBottom: 4 },
  catChips: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  miniChip: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  miniChipText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardDuration: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },
  expandIcon: { fontSize: 10, color: COLORS.textTertiary },

  cardExpanded: {
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    padding: SPACING.md, backgroundColor: COLORS.offWhite,
  },
  cardDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
  deleteBtn: {
    marginTop: SPACING.md, alignSelf: 'flex-end',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.danger, borderRadius: RADIUS.sm,
  },
  deleteBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.danger },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  emptySubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 4 },
});
