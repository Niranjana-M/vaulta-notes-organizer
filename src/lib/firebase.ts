import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import baseFirebaseConfig from '../../firebase-applet-config.json';

const env = typeof import.meta !== 'undefined' ? import.meta.env : {} as any;

const projectId = env?.VITE_FIREBASE_PROJECT_ID || baseFirebaseConfig.projectId || 'vaulta1-34f24';
const apiKey = env?.VITE_FIREBASE_API_KEY || baseFirebaseConfig.apiKey;
const authDomain = env?.VITE_FIREBASE_AUTH_DOMAIN || baseFirebaseConfig.authDomain || `${projectId}.firebaseapp.com`;
const storageBucket = env?.VITE_FIREBASE_STORAGE_BUCKET || baseFirebaseConfig.storageBucket || `${projectId}.firebasestorage.app`;
const appId = env?.VITE_FIREBASE_APP_ID || baseFirebaseConfig.appId;
const messagingSenderId = env?.VITE_FIREBASE_MESSAGING_SENDER_ID || baseFirebaseConfig.messagingSenderId;
const firestoreDatabaseId = env?.VITE_FIREBASE_DATABASE_ID || baseFirebaseConfig.firestoreDatabaseId || '(default)';

const firebaseConfig = {
  projectId,
  apiKey,
  authDomain,
  storageBucket,
  appId,
  messagingSenderId,
  firestoreDatabaseId
};

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Check if running in browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// Suppress internal offline-notice logs from polluting console
try {
  setLogLevel('silent');
} catch {
  // ignore
}

// Initialize Firestore with specific databaseId and long-polling transport for proxy/iframe stability
export const db = (() => {
  try {
    return initializeFirestore(
      app,
      {
        ...(isBrowser ? { experimentalForceLongPolling: true } : {}),
      },
      firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firestoreDatabaseId);
  }
})();

// Validate connection on startup per Firebase integration guidelines
if (isBrowser) {
  (async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch {
      // Offline mode or test doc not found is expected and handled gracefully
    }
  })();
}

// Structured error handling matching Firebase skill guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initialize Firebase Cloud Storage
export const storage = getStorage(app);

export default app;

