import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../utils/firebase';
import {
  createUserProfile,
  getUserProfile,
  isUsernameTaken,
  migrateLocalDataToFirestore,
  syncStreakToFirestore,
  UserProfile,
} from '../utils/firestore';
import { getAllEntries, getStreak } from '../utils/storage';

interface AuthState {
  user:    User | null;
  profile: UserProfile | null;
  loading: boolean;
}

interface AuthActions {
  signUp: (email: string, password: string, userName: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState & AuthActions>({
  user:    null,
  profile: null,
  loading: true,
  signUp:  async () => {},
  signIn:  async () => {},
  logOut:  async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          const p = await getUserProfile(firebaseUser.uid);
          setProfile(p);
        } else {
          setProfile(null);
        }
      } catch {
        // Firestore read failed — keep user set but profile null; app can still function
        setProfile(null);
      } finally {
        // Always unblock the loading gate so the app doesn't freeze
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  async function signUp(email: string, password: string, userName: string, displayName: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    try {
      // Username check runs while authenticated so Firestore rules are satisfied
      const taken = await isUsernameTaken(userName.trim().toLowerCase());
      if (taken) {
        await deleteUser(cred.user);
        const err = new Error('Username is already taken. Please choose another.');
        (err as any).code = 'username-taken';
        throw err;
      }

      const newProfile: UserProfile = {
        uid:         cred.user.uid,
        email,
        userName:    userName.trim().toLowerCase(),
        displayName: displayName.trim(),
        createdAt:   Date.now(),
      };
      await createUserProfile(newProfile);
      setProfile(newProfile);

      const [localEntries, localStreak] = await Promise.all([getAllEntries(), getStreak()]);
      if (localEntries.length > 0) {
        await migrateLocalDataToFirestore(cred.user.uid, localEntries, localStreak);
      }
    } catch (err) {
      await signOut(auth);
      throw err;
    }
  }

  async function signIn(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      const p = await getUserProfile(cred.user.uid);
      setProfile(p);
    } catch {
      setProfile(null);
    }
    // Push current local streak to Firestore on every login so friends always
    // see up-to-date data (covers offline logging between sessions)
    try {
      const localStreak = await getStreak();
      syncStreakToFirestore(cred.user.uid, localStreak).catch(() => {});
    } catch {}
  }

  async function logOut() {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
