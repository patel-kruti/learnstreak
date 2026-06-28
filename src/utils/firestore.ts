import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { LearningEntry, StreakData } from '../types';
import { db } from './firebase';

// ── User profile ──────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  userName: string;
  displayName: string;
  createdAt: number;
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', profile.uid), profile);
  // Reserve the username
  await setDoc(doc(db, 'usernames', profile.userName.toLowerCase()), { uid: profile.uid });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// Returns null if username is available, uid if taken
export async function getUserByUsername(userName: string): Promise<UserProfile | null> {
  const usernameSnap = await getDoc(doc(db, 'usernames', userName.toLowerCase()));
  if (!usernameSnap.exists()) return null;
  const { uid } = usernameSnap.data() as { uid: string };
  return getUserProfile(uid);
}

export async function isUsernameTaken(userName: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usernames', userName.toLowerCase()));
  return snap.exists();
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function syncEntryToFirestore(uid: string, entry: LearningEntry): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'entries', entry.id), entry);
  await updateHeatmap(uid);
}

export async function deleteEntryFromFirestore(uid: string, entryId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'entries', entryId));
  await updateHeatmap(uid);
}

export async function getAllEntriesFromFirestore(uid: string): Promise<LearningEntry[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'entries'));
  return snap.docs.map((d) => d.data() as LearningEntry);
}

// ── Streak ────────────────────────────────────────────────────────────────────

export async function syncStreakToFirestore(uid: string, streak: StreakData): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'streak', 'current'), streak);
}

export async function getStreakFromFirestore(uid: string): Promise<StreakData | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'streak', 'current'));
  return snap.exists() ? (snap.data() as StreakData) : null;
}

// ── Heatmap (public — friends read this, never raw entries) ───────────────────
// Stored as a single Firestore doc: { "2025-01-01": 45, "2025-01-02": 90, ... }

export async function updateHeatmap(uid: string): Promise<void> {
  const entries = await getAllEntriesFromFirestore(uid);
  const heatmap: Record<string, number> = {};
  for (const e of entries) {
    heatmap[e.date] = (heatmap[e.date] ?? 0) + e.duration;
  }
  await setDoc(doc(db, 'users', uid, 'heatmap', 'data'), heatmap);
}

export async function getFriendHeatmap(uid: string): Promise<Record<string, number>> {
  const snap = await getDoc(doc(db, 'users', uid, 'heatmap', 'data'));
  return snap.exists() ? (snap.data() as Record<string, number>) : {};
}

export async function getFriendStreak(uid: string): Promise<StreakData | null> {
  return getStreakFromFirestore(uid);
}

// ── Following ─────────────────────────────────────────────────────────────────

export interface FollowEntry {
  uid: string;
  userName: string;
  displayName: string;
  followedAt: number;
}

export async function followUser(myUid: string, target: UserProfile): Promise<void> {
  const entry: FollowEntry = {
    uid:         target.uid,
    userName:    target.userName,
    displayName: target.displayName,
    followedAt:  Date.now(),
  };
  await setDoc(doc(db, 'users', myUid, 'following', target.uid), entry);
}

export async function unfollowUser(myUid: string, targetUid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', myUid, 'following', targetUid));
}

export async function getFollowing(myUid: string): Promise<FollowEntry[]> {
  const snap = await getDocs(collection(db, 'users', myUid, 'following'));
  return snap.docs
    .map((d) => d.data() as FollowEntry)
    .sort((a, b) => b.followedAt - a.followedAt);
}

export async function isFollowing(myUid: string, targetUid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', myUid, 'following', targetUid));
  return snap.exists();
}

// ── Migration: upload all local entries on first login ────────────────────────

export async function migrateLocalDataToFirestore(
  uid: string,
  entries: LearningEntry[],
  streak: StreakData
): Promise<void> {
  // Upload all entries in parallel (batched for safety)
  const BATCH = 20;
  for (let i = 0; i < entries.length; i += BATCH) {
    await Promise.all(
      entries.slice(i, i + BATCH).map((e) =>
        setDoc(doc(db, 'users', uid, 'entries', e.id), e)
      )
    );
  }
  await syncStreakToFirestore(uid, streak);
  await updateHeatmap(uid);
}
