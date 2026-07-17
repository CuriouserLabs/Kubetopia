import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Kubetopia shares the KubeQuest Firebase project (kubequest-dd648) so one
 * Google sign-in works across kubequest.org and play.kubequest.org.
 *
 * These are Firebase WEB config values — NOT secrets. They ship in every
 * client bundle by design; data access is enforced by Auth + Firestore
 * rules. Env vars override them so forks can point at their own project.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyDzo6QVYmRJZhzk1Ug2kJj8TTeVArhkWJs",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "kubequest-dd648.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "kubequest-dd648",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "kubequest-dd648.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "251179039389",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:251179039389:web:f7e0c86e1c79f0bc5b3274",
};

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

/** Initialised lazily and only in the browser — SSR never touches Firebase. */
function ensureApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  ensureApp();
  return authInstance;
}

export function getDb(): Firestore | null {
  ensureApp();
  return dbInstance;
}

export const googleProvider = new GoogleAuthProvider();
