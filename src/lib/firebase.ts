import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const isFirebaseConfigured = true;

const app = initializeApp(firebaseConfig);

// Using long polling can improve connection stability in some restricted environments, 
// but we'll monitor if it's necessary.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

// Test connection and log specific errors for debugging
async function testConnection() {
  const testPath = 'system/connection_test';
  try {
    // Attempting a read to verify connectivity
    await getDocFromServer(doc(db, testPath));
    console.log("Firebase connected successfully.");
  } catch (error: any) {
    console.log("Firebase Connection Info:", error.code, error.message);
    
    if (error.code === 'permission-denied') {
      console.log("Firebase connectivity verified (Permission Denied is expected with current rules).");
    } else if (error.code === 'unavailable') {
      console.error("Firestore backend is unreachable. This may be a transient network issue or the API is not enabled.");
      // We don't throw here to avoid crashing the app startup, but we log the info.
    } else {
      handleFirestoreError(error, OperationType.GET, testPath);
    }
  }
}
testConnection();
