import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBKgtI_je-Tf-tDv73S7cFT55-awk1xR5o',
  authDomain: 'learnstreak-92558.firebaseapp.com',
  projectId: 'learnstreak-92558',
  storageBucket: 'learnstreak-92558.firebasestorage.app',
  messagingSenderId: '214855438213',
  appId: '1:214855438213:web:421eaf23f397739a1ffeec',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// getReactNativePersistence exists at runtime in Firebase 12 but is missing from its
// TS types for the web bundle — require() bypasses the type gap without a cast.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('firebase/auth');

let _auth: ReturnType<typeof getAuth>;
try {
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // initializeAuth throws on hot-reload re-runs; getAuth returns the existing instance
  _auth = getAuth(app);
}

export const auth = _auth;
export const db   = getFirestore(app);
