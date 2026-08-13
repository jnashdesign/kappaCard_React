import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import { claimAnonymousEncounters } from '../lib/encounters';
import { claimFoundingBasic } from '../lib/foundingPromo';
import {
  createUserProfile,
  deleteMyAccount,
  ensureUserTimezone,
  getUserById,
  updateUserProfile,
} from '../lib/users';
import { recordSessionLogin } from '../lib/userStats';
import type { MembershipTier, UserProfile } from '../types';

/** Best-effort founding-100 grant after a free-tier signup. */
async function maybeClaimFoundingBasic(
  created: UserProfile
): Promise<UserProfile> {
  if (
    created.admin ||
    created.excludeFromInaugural ||
    created.tier === 'basic' ||
    created.tier === 'premium'
  ) {
    return created;
  }
  try {
    const result = await claimFoundingBasic();
    if (result.status === 'granted' || result.status === 'already') {
      const refreshed = await getUserById(created.id);
      return refreshed || created;
    }
  } catch {
    // Promo may be exhausted or functions offline — leave as free for Checkout.
  }
  return created;
}

interface SignUpInput {
  email: string;
  password: string;
  name: string;
  username: string;
  chapter: string;
  initiationYear: number;
  inviteCode: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signInWithGoogle: (inviteCode?: string) => Promise<'needs_profile' | 'ready'>;
  completeGoogleSignup: (input: Omit<SignUpInput, 'email' | 'password'> & { email?: string }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  saveProfile: (updates: Partial<UserProfile>) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!auth?.currentUser) {
      setProfile(null);
      return;
    }
    const next = await getUserById(auth.currentUser.uid);
    setProfile(next);
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const next = await getUserById(user.uid);
          setProfile(next);
          if (next) {
            void ensureUserTimezone(user.uid, next.timezone)
              .then((timezone) => {
                if (!next.timezone) {
                  setProfile((prev) => (prev ? { ...prev, timezone } : prev));
                }
              })
              .catch(() => undefined);
            void recordSessionLogin(user.uid)
              .then(() => refreshProfile())
              .catch(() => undefined);
            void claimAnonymousEncounters(user.uid).catch(() => undefined);
          }
        } catch (error) {
          console.error('Failed to load profile', error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsub;
  }, [refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase is not configured.');
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    if (!auth) throw new Error('Firebase is not configured.');
    const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
    await updateProfile(credential.user, { displayName: input.name });
    const created = await createUserProfile(credential.user.uid, {
      email: input.email,
      name: input.name,
      username: input.username,
      chapter: input.chapter,
      initiationYear: input.initiationYear,
      inviteCode: input.inviteCode,
      tier: 'free',
    });
    const profileAfterPromo = await maybeClaimFoundingBasic(created);
    setProfile(profileAfterPromo);
    void claimAnonymousEncounters(credential.user.uid).catch(() => undefined);
  }, []);

  const signInWithGoogle = useCallback(async (_inviteCode?: string) => {
    if (!auth) throw new Error('Firebase is not configured.');
    const result = await signInWithPopup(auth, googleProvider);
    const existing = await getUserById(result.user.uid);
    if (existing) {
      setProfile(existing);
      void claimAnonymousEncounters(result.user.uid).catch(() => undefined);
      return 'ready' as const;
    }
    // New Google users always finish invite + profile fields next
    return 'needs_profile' as const;
  }, []);

  const completeGoogleSignup = useCallback(
    async (input: Omit<SignUpInput, 'email' | 'password'> & { email?: string }) => {
      if (!auth?.currentUser) throw new Error('You must sign in with Google first.');
      const created = await createUserProfile(auth.currentUser.uid, {
        email: input.email || auth.currentUser.email || '',
        name: input.name,
        username: input.username,
        chapter: input.chapter,
        initiationYear: input.initiationYear,
        inviteCode: input.inviteCode,
        tier: 'free' as MembershipTier,
      });
      const profileAfterPromo = await maybeClaimFoundingBasic(created);
      setProfile(profileAfterPromo);
      void claimAnonymousEncounters(auth.currentUser.uid).catch(() => undefined);
    },
    []
  );

  const resetPassword = useCallback(async (email: string) => {
    if (!auth) throw new Error('Firebase is not configured.');
    await sendPasswordResetEmail(auth, email);
  }, []);

  const logout = useCallback(async () => {
    if (!auth) return;
    await signOut(auth);
    setProfile(null);
  }, []);

  const saveProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!auth?.currentUser || !profile) throw new Error('Not signed in.');
      await updateUserProfile(auth.currentUser.uid, updates, profile.username);
      await refreshProfile();
    },
    [profile, refreshProfile]
  );

  const deleteAccount = useCallback(
    async (password?: string) => {
      if (!profile) throw new Error('Not signed in.');
      await deleteMyAccount(profile, { password });
      setProfile(null);
      setFirebaseUser(null);
    },
    [profile]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      configured: isFirebaseConfigured,
      refreshProfile,
      signIn,
      signUp,
      signInWithGoogle,
      completeGoogleSignup,
      resetPassword,
      logout,
      saveProfile,
      deleteAccount,
    }),
    [
      firebaseUser,
      profile,
      loading,
      refreshProfile,
      signIn,
      signUp,
      signInWithGoogle,
      completeGoogleSignup,
      resetPassword,
      logout,
      saveProfile,
      deleteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
