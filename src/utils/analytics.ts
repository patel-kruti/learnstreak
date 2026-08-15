import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from './firebase';

type EventName =
  | 'session_logged'
  | 'streak_milestone'
  | 'freeze_used'
  | 'ai_suggestion_shown'
  | 'ai_suggestion_accepted'
  | 'ai_suggestion_rejected';

interface EventPayload {
  category?: string;
  durationMinutes?: number;
  streakDay?: number;
  badgeId?: string;
  freezesConsumed?: number;
  freezesRemaining?: number;
}

// Writes one event doc to users/{uid}/events — fire-and-forget.
// Silently no-ops for anonymous users and on any Firestore error.
export async function logEvent(event: EventName, payload: EventPayload = {}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await addDoc(collection(db, 'users', uid, 'events'), {
      event,
      ts: Date.now(),
      ...payload,
    });
  } catch {
    // analytics must never surface to the user
  }
}
