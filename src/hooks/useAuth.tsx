import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, signInWithGoogle } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          // Fallback to getDoc if we need to create it for the first time
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            const newProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '匿名用户',
              photoURL: currentUser.photoURL || '',
              noShowCount: 0,
              stoodUpCount: 0,
              updatedAt: new Date().toISOString()
            };
            await setDoc(userRef, {
              ...newProfile,
              updatedAt: serverTimestamp()
            });
          }

          unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              setProfile(snapshot.data() as UserProfile);
            }
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          });

        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signIn = async () => {
    await signInWithGoogle();
  };

  const signOutUser = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
