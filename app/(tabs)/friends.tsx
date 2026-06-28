import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS, FONTS, RADIUS, SPACING } from '../../src/constants/theme';
import {
  followUser,
  getFollowing,
  getUserByUsername,
  isFollowing,
  unfollowUser,
  FollowEntry,
  UserProfile,
} from '../../src/utils/firestore';

export default function FriendsScreen() {
  const { user, profile } = useAuth();

  const [friends,       setFriends]       = useState<FollowEntry[]>([]);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResult,  setSearchResult]  = useState<UserProfile | null | 'not_found'>(null);
  const [searching,     setSearching]     = useState(false);
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [loadingList,   setLoadingList]   = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadFriends();
    }, [user])
  );

  async function loadFriends() {
    if (!user) return;
    setLoadingList(true);
    try {
      const list = await getFollowing(user.uid);
      setFriends(list);
    } finally {
      setLoadingList(false);
    }
  }

  async function handleSearch() {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const found = await getUserByUsername(q);
      if (!found || found.uid === user?.uid) {
        setSearchResult('not_found');
      } else {
        setSearchResult(found);
      }
    } catch {
      setSearchResult('not_found');
    } finally {
      setSearching(false);
    }
  }

  async function handleFollow(target: UserProfile) {
    if (!user) return;
    setFollowLoading(target.uid);
    try {
      const alreadyFollowing = await isFollowing(user.uid, target.uid);
      if (alreadyFollowing) {
        Alert.alert('Already following', `You already follow @${target.userName}.`);
        return;
      }
      await followUser(user.uid, target);
      await loadFriends();
      setSearchQuery('');
      setSearchResult(null);
    } catch {
      Alert.alert('Error', 'Could not follow user. Try again.');
    } finally {
      setFollowLoading(null);
    }
  }

  async function handleUnfollow(entry: FollowEntry) {
    if (!user) return;
    Alert.alert(
      'Unfollow?',
      `Stop following @${entry.userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            setFollowLoading(entry.uid);
            try {
              await unfollowUser(user.uid, entry.uid);
              await loadFriends();
            } finally {
              setFollowLoading(null);
            }
          },
        },
      ]
    );
  }

  function openFriendProfile(uid: string, userName: string) {
    router.push({ pathname: '/friend' as any, params: { uid, userName } });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Your username */}
      {profile && (
        <View style={styles.myTag}>
          <Text style={styles.myTagLabel}>Your username</Text>
          <Text style={styles.myTagValue}>@{profile.userName}</Text>
        </View>
      )}

      {/* Search */}
      <Text style={styles.sectionTitle}>Find a friend</Text>
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Text style={styles.searchAt}>@</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={(t) => {
              setSearchQuery(t.toLowerCase().replace(/[^a-z0-9_]/g, ''));
              setSearchResult(null);
            }}
            placeholder="username"
            placeholderTextColor={COLORS.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, searching && styles.searchBtnDisabled]}
          onPress={handleSearch}
          disabled={searching}
          activeOpacity={0.8}
        >
          {searching
            ? <ActivityIndicator color={COLORS.white} size="small" />
            : <Text style={styles.searchBtnText}>Search</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Search result */}
      {searchResult === 'not_found' && (
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>No user found with that username.</Text>
        </View>
      )}
      {searchResult && searchResult !== 'not_found' && (
        <View style={styles.resultCard}>
          <View style={styles.resultInfo}>
            <Text style={styles.resultDisplayName}>{searchResult.displayName}</Text>
            <Text style={styles.resultUserName}>@{searchResult.userName}</Text>
          </View>
          <TouchableOpacity
            style={[styles.followBtn, followLoading === searchResult.uid && styles.followBtnDisabled]}
            onPress={() => handleFollow(searchResult as UserProfile)}
            disabled={followLoading === searchResult.uid}
            activeOpacity={0.8}
          >
            {followLoading === searchResult.uid
              ? <ActivityIndicator color={COLORS.white} size="small" />
              : <Text style={styles.followBtnText}>Follow</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Following list */}
      <Text style={[styles.sectionTitle, { marginTop: SPACING.xl }]}>
        Following ({friends.length})
      </Text>

      {loadingList ? (
        <ActivityIndicator color={COLORS.textSecondary} style={{ marginTop: SPACING.lg }} />
      ) : friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyText}>No friends yet.</Text>
          <Text style={styles.emptySubText}>Search by username above to follow someone.</Text>
        </View>
      ) : (
        friends.map((entry) => (
          <TouchableOpacity
            key={entry.uid}
            style={styles.friendCard}
            onPress={() => openFriendProfile(entry.uid, entry.userName)}
            activeOpacity={0.8}
          >
            <View style={styles.friendInfo}>
              <Text style={styles.friendDisplayName}>{entry.displayName}</Text>
              <Text style={styles.friendUserName}>@{entry.userName}</Text>
            </View>
            <View style={styles.friendRight}>
              <Text style={styles.viewLabel}>View →</Text>
              <TouchableOpacity
                onPress={() => handleUnfollow(entry)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.unfollowBtn}
              >
                {followLoading === entry.uid
                  ? <ActivityIndicator color={COLORS.danger} size="small" />
                  : <Text style={styles.unfollowText}>Unfollow</Text>
                }
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content:   { padding: SPACING.md },

  myTag: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.accentLight, borderWidth: 1, borderColor: COLORS.accent,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  myTagLabel: { fontSize: FONTS.sizes.sm, color: COLORS.accent, fontWeight: FONTS.weights.semibold },
  myTagValue: { fontSize: FONTS.sizes.md, color: COLORS.accent, fontWeight: FONTS.weights.bold },

  sectionTitle: {
    fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: SPACING.sm,
  },

  searchRow:      { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  searchInputWrap:{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, backgroundColor: COLORS.white },
  searchAt:       { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold },
  searchInput:    { flex: 1, fontSize: FONTS.sizes.md, color: COLORS.textPrimary, padding: SPACING.md, paddingLeft: 4 },
  searchBtn:      { backgroundColor: COLORS.black, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 52, alignItems: 'center', justifyContent: 'center' },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText:  { color: COLORS.white, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm },

  notFound:     { marginTop: SPACING.sm, padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md },
  notFoundText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center' },

  resultCard:   { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, padding: SPACING.md },
  resultInfo:   { flex: 1 },
  resultDisplayName: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  resultUserName:    { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  followBtn:        { backgroundColor: COLORS.black, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, minWidth: 80, alignItems: 'center' },
  followBtnDisabled:{ opacity: 0.6 },
  followBtnText:    { color: COLORS.white, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm },

  emptyState:   { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyEmoji:   { fontSize: 40, marginBottom: SPACING.sm },
  emptyText:    { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textSecondary },
  emptySubText: { fontSize: FONTS.sizes.sm, color: COLORS.textTertiary, marginTop: 4, textAlign: 'center' },

  friendCard:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  friendInfo:        { flex: 1 },
  friendDisplayName: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textPrimary },
  friendUserName:    { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  friendRight:       { alignItems: 'flex-end', gap: SPACING.xs },
  viewLabel:         { fontSize: FONTS.sizes.sm, color: COLORS.accent, fontWeight: FONTS.weights.semibold },
  unfollowBtn:       { padding: 2 },
  unfollowText:      { fontSize: FONTS.sizes.xs, color: COLORS.danger },
});
