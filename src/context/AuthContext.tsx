import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  avatarUrl?: string | null;
  createdAt: number;
}

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  avatarUrl?: string | null;
  isAnonymous?: boolean;
};

interface AuthContextType {
  user: AppUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  loginAsGuest: (guestName?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserDisplayName: (name: string) => Promise<void>;
  updateUserAvatar: (avatarUrl: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'vaulta_active_student_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check for stored guest session first if no firebase auth ready
    const storedGuest = localStorage.getItem(GUEST_STORAGE_KEY);
    let guestUser: AppUser | null = null;
    if (storedGuest) {
      try {
        guestUser = JSON.parse(storedGuest);
      } catch (e) {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Clear local guest if real Firebase user exists
        localStorage.removeItem(GUEST_STORAGE_KEY);
        const localSavedAvatar = localStorage.getItem(`vaulta_avatar_${currentUser.uid}`) || null;
        const initialAvatar = currentUser.photoURL || localSavedAvatar;

        const appUser: AppUser = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: initialAvatar,
          avatarUrl: initialAvatar,
          isAnonymous: currentUser.isAnonymous
        };
        setUser(appUser);

        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            const finalAvatar = data.photoURL || data.avatarUrl || currentUser.photoURL || localSavedAvatar || null;
            if (finalAvatar && !localSavedAvatar) {
              try {
                localStorage.setItem(`vaulta_avatar_${currentUser.uid}`, finalAvatar);
              } catch (e) {
                // ignore
              }
            }
            setUserProfile({
              ...data,
              photoURL: finalAvatar,
              avatarUrl: finalAvatar
            });
            setUser((prev) => (prev ? { ...prev, photoURL: finalAvatar, avatarUrl: finalAvatar } : null));
          } else {
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Student',
              photoURL: initialAvatar,
              avatarUrl: initialAvatar,
              createdAt: Date.now()
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (err) {
          console.warn('Firestore profile fetch fallback:', err);
          setUserProfile({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Student',
            photoURL: initialAvatar,
            avatarUrl: initialAvatar,
            createdAt: Date.now()
          });
        }
      } else if (guestUser) {
        // Fallback to local guest user if present
        const localSavedAvatar = localStorage.getItem(`vaulta_avatar_${guestUser.uid}`) || guestUser.photoURL || null;
        const hydratedGuest: AppUser = {
          ...guestUser,
          photoURL: localSavedAvatar,
          avatarUrl: localSavedAvatar
        };
        setUser(hydratedGuest);
        setUserProfile({
          uid: guestUser.uid,
          email: guestUser.email,
          displayName: guestUser.displayName || 'Demo Student',
          photoURL: localSavedAvatar,
          avatarUrl: localSavedAvatar,
          createdAt: Date.now()
        });
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      console.error('Firebase Auth Login Error:', err);
      const code = err.code || '';
      const message = (err.message || '').toLowerCase();
      if (code === 'auth/api-key-not-valid' || message.includes('api-key') || message.includes('api_key')) {
        throw new Error(
          'Firebase Web API key for project "vaulta1-34f24" is not yet configured. Please add VITE_FIREBASE_API_KEY in Settings, or click "Explore as Demo Student" below to use Vaulta immediately.'
        );
      } else if (code === 'auth/network-request-failed') {
        throw new Error(
          'Network connection to Firebase was interrupted. Please check your internet connection or use Demo Student Access to continue organizing offline.'
        );
      } else if (code === 'auth/operation-not-allowed') {
        throw new Error(
          'Email/Password sign-in is disabled in your Firebase console settings. Click "Demo Student Login" below to continue instantly.'
        );
      } else if (code === 'auth/user-not-found') {
        throw new Error('No account found with this email address. Please register first.');
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        throw new Error('Incorrect email or password. Please verify and try again.');
      } else if (code === 'auth/invalid-email') {
        throw new Error('Invalid email format. Please enter a valid email.');
      } else if (code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please wait a few minutes before trying again.');
      } else {
        throw new Error(err.message || 'Login failed. Please check your credentials.');
      }
    }
  };

  const register = async (email: string, password: string, displayName?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newUser = userCredential.user;

      const formattedName = displayName?.trim() || email.split('@')[0] || 'Student';
      try {
        await updateProfile(newUser, { displayName: formattedName });
      } catch (e) {
        console.warn('Could not update auth profile:', e);
      }

      const profileData: UserProfile = {
        uid: newUser.uid,
        email: newUser.email,
        displayName: formattedName,
        createdAt: Date.now()
      };

      try {
        await setDoc(doc(db, 'users', newUser.uid), profileData);
      } catch (firestoreErr) {
        console.warn('Could not create initial user profile document:', firestoreErr);
      }

      setUser({
        uid: newUser.uid,
        email: newUser.email,
        displayName: formattedName,
        isAnonymous: newUser.isAnonymous
      });
      setUserProfile(profileData);
    } catch (err: any) {
      console.error('Firebase Auth Registration Error:', err);
      const code = err.code || '';
      const message = (err.message || '').toLowerCase();
      if (code === 'auth/api-key-not-valid' || message.includes('api-key') || message.includes('api_key')) {
        throw new Error(
          'Firebase Web API key for project "vaulta1-34f24" is not yet configured. Please add VITE_FIREBASE_API_KEY in Settings, or click "Explore as Demo Student" below to use Vaulta immediately.'
        );
      } else if (code === 'auth/network-request-failed') {
        throw new Error(
          'Network connection to Firebase was interrupted. Please check your internet connection or use Demo Student Access to continue organizing offline.'
        );
      } else if (code === 'auth/operation-not-allowed') {
        throw new Error(
          'Email/Password registration is disabled in your Firebase console settings. Click "Demo Student Login" below to start organizing immediately.'
        );
      } else if (code === 'auth/email-already-in-use') {
        throw new Error('An account with this email address already exists. Please log in.');
      } else if (code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters long.');
      } else if (code === 'auth/invalid-email') {
        throw new Error('Invalid email address format.');
      } else {
        throw new Error(err.message || 'Registration failed. Please try again.');
      }
    }
  };

  const loginAsGuest = async (guestName: string = 'College Student') => {
    try {
      // 1. Try Firebase anonymous sign-in first
      const cred = await signInAnonymously(auth);
      const anonUser = cred.user;
      try {
        await updateProfile(anonUser, { displayName: guestName });
      } catch (e) {
        // ignore
      }
      setUser({
        uid: anonUser.uid,
        email: 'demo.student@university.edu',
        displayName: guestName,
        isAnonymous: true
      });
      setUserProfile({
        uid: anonUser.uid,
        email: 'demo.student@university.edu',
        displayName: guestName,
        createdAt: Date.now()
      });
    } catch (err) {
      console.warn('Anonymous auth failed or not allowed, using local student session:', err);
      // 2. Fallback to resilient local session
      const fallbackUid = 'student_' + Math.random().toString(36).substring(2, 10);
      const guestSession: AppUser = {
        uid: fallbackUid,
        email: 'demo.student@university.edu',
        displayName: guestName,
        isAnonymous: true
      };
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestSession));
      setUser(guestSession);
      setUserProfile({
        uid: fallbackUid,
        email: 'demo.student@university.edu',
        displayName: guestName,
        createdAt: Date.now()
      });
    }
  };

  const logout = async () => {
    localStorage.removeItem(GUEST_STORAGE_KEY);
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (err: any) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setUserProfile(null);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      console.error('Password reset error:', err);
      const code = err.code || '';
      if (code === 'auth/operation-not-allowed') {
        throw new Error('Password reset is disabled in your Firebase console.');
      } else if (code === 'auth/user-not-found') {
        throw new Error('No account found with this email address.');
      } else if (code === 'auth/invalid-email') {
        throw new Error('Invalid email format.');
      } else {
        throw new Error(err.message || 'Failed to send password reset email.');
      }
    }
  };

  const updateUserDisplayName = async (name: string) => {
    if (!user) return;
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
      }
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { displayName: name }, { merge: true });
      } catch (e) {
        // ignore firestore error if guest
      }

      const updatedUser = { ...user, displayName: name };
      setUser(updatedUser);
      if (user.isAnonymous) {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updatedUser));
      }
      setUserProfile((prev) => (prev ? { ...prev, displayName: name } : null));
    } catch (err: any) {
      console.error('Failed to update display name:', err);
      throw new Error(err.message || 'Failed to update name');
    }
  };

  const updateUserAvatar = async (avatarUrl: string | null) => {
    if (!user) return;
    try {
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { photoURL: avatarUrl || '' });
        } catch (authErr) {
          console.warn('Could not update Firebase Auth photoURL:', authErr);
        }
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { photoURL: avatarUrl, avatarUrl: avatarUrl }, { merge: true });
      } catch (firestoreErr) {
        console.warn('Could not update Firestore user avatar:', firestoreErr);
      }

      // Synchronize in local persistent storage per user ID
      try {
        if (avatarUrl) {
          localStorage.setItem(`vaulta_avatar_${user.uid}`, avatarUrl);
        } else {
          localStorage.removeItem(`vaulta_avatar_${user.uid}`);
        }
      } catch (storageErr) {
        // ignore
      }

      const updatedUser = { ...user, photoURL: avatarUrl, avatarUrl: avatarUrl };
      setUser(updatedUser);
      if (user.isAnonymous) {
        try {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updatedUser));
        } catch (e) {
          // ignore
        }
      }
      setUserProfile((prev) => (prev ? { ...prev, photoURL: avatarUrl, avatarUrl: avatarUrl } : null));
    } catch (err: any) {
      console.error('Failed to update user avatar:', err);
      throw new Error(err.message || 'Failed to update avatar');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        login,
        register,
        loginAsGuest,
        logout,
        resetPassword,
        updateUserDisplayName,
        updateUserAvatar
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

