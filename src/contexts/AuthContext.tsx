import React, { createContext, useContext, useEffect, useState } from 'react';
import { Family, Profile, UserRole } from '../types/database';
import { databaseService } from '../lib/databaseService';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  isSupabaseReachable,
  markSupabaseConnectivityFailed,
  isProductionEnvironment,
  isDevelopmentEnvironment,
  getAuthRedirectUrl,
} from '../lib/supabase';

interface AuthContextType {
  user: { id: string; email?: string } | null;
  profile: Profile | null;
  family: Family | null;
  role: UserRole; // Immutable authenticated role from database record
  isStudentPreview: boolean; // Parent preview mode flag (does not change auth identity)
  setStudentPreview: (enabled: boolean) => void;
  isSupabaseLive: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    familyName?: string
  ) => Promise<{ confirmationRequired: boolean }>;
  launchDevelopmentSandbox: (role?: 'parent' | 'student') => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  reloadFamily: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_ACTIVE_USER_ID_STORAGE = 'homeedu_dev_active_user_id';
const DEV_DEFAULT_PARENT_ID = '00000000-0000-0000-0000-000000000001';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [role, setRole] = useState<UserRole>('parent');
  const [isStudentPreview, setIsStudentPreviewState] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSupabaseLive = isSupabaseConfigured();

  // Load session
  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check production constraint
      if (isProductionEnvironment() && !isSupabaseLive) {
        setError('Supabase credentials are required in production. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
        setIsLoading(false);
        return;
      }

      if (isSupabaseLive) {
        const supabase = getSupabaseClient()!;

        // Handle PKCE authentication callback code in URL if returning from email link
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');
          if (code) {
            try {
              const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
              if (exchangeErr) {
                console.warn('Supabase code exchange notice:', exchangeErr.message);
              } else {
                // Clean the search params to keep browser URL clean
                const cleanUrl = window.location.pathname + window.location.hash;
                window.history.replaceState({}, document.title, cleanUrl);
              }
            } catch (exchangeEx) {
              console.warn('Exchange code error:', exchangeEx);
            }
          }
        }

        try {
          const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) throw sessionErr;

          if (sessionData?.session?.user && sessionData?.session?.access_token) {
            // Verify with Supabase auth server that the stored session is actively valid
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError || !userData?.user) {
              console.warn('Stored session is invalid or expired. Resetting session state cleanly.');
              await supabase.auth.signOut().catch(() => {});
              setUser(null);
              setProfile(null);
              setFamily(null);
              setIsLoading(false);
              return;
            }

            const authUser = userData.user;
            setUser({ id: authUser.id, email: authUser.email });

            let loadedProfile = await databaseService.getProfile(authUser.id);
            if (!loadedProfile) {
              const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
              const metaRole = (meta.role as UserRole) || 'parent';
              const metaName = (meta.full_name as string) || authUser.email?.split('@')[0] || 'User';

              try {
                loadedProfile = await databaseService.createProfile({
                  id: authUser.id,
                  role: metaRole,
                  full_name: metaName,
                  email: authUser.email,
                });
              } catch (createErr) {
                console.warn('Profile creation fallback notice on init:', createErr);
                loadedProfile = await databaseService.getProfile(authUser.id);
              }
            }

            if (loadedProfile) {
              setProfile(loadedProfile);
              setRole(loadedProfile.role); // Locked to database profile role
            }

            try {
              let famInfo = await databaseService.getFamilyForUser(authUser.id);
              if (!famInfo && loadedProfile?.role === 'parent') {
                const defaultFamilyName = `${loadedProfile.full_name.split(' ')[0] || 'Our'}'s Family`;
                const { family: newFam } = await databaseService.createFamily(defaultFamilyName, authUser.id);
                famInfo = { family: newFam, role: 'parent' };
              }
              if (famInfo) {
                setFamily(famInfo.family);
              }
            } catch (famErr) {
              console.warn('Family initialization note:', famErr);
            }
            setIsLoading(false);
            return;
          }
        } catch (authInitErr: unknown) {
          const isFetchError =
            authInitErr instanceof TypeError ||
            (authInitErr instanceof Error &&
              (authInitErr.message.includes('fetch') || authInitErr.message.includes('Network')));

          if (isFetchError && isDevelopmentEnvironment()) {
            console.warn('Supabase remote endpoint unreachable during boot. Activating development sandbox session.');
            markSupabaseConnectivityFailed(true);
            const savedUserId = localStorage.getItem(DEV_ACTIVE_USER_ID_STORAGE) || DEV_DEFAULT_PARENT_ID;
            const loadedProfile = await databaseService.getProfile(savedUserId);
            if (loadedProfile) {
              setUser({ id: loadedProfile.id, email: loadedProfile.email });
              setProfile(loadedProfile);
              setRole(loadedProfile.role);
              const famInfo = await databaseService.getFamilyForUser(loadedProfile.id);
              if (famInfo) setFamily(famInfo.family);
              setIsLoading(false);
              return;
            }
          }
        }

        // Live Supabase is configured, but there is no active session yet.
        // Keep user unauthenticated so the clean login/confirmation UI renders.
        setUser(null);
        setProfile(null);
        setFamily(null);
        setIsLoading(false);
        return;
      }

      // Development fallback session ONLY when Supabase is not connected
      if (!isSupabaseLive && isDevelopmentEnvironment()) {
        const savedUserId = localStorage.getItem(DEV_ACTIVE_USER_ID_STORAGE) || DEV_DEFAULT_PARENT_ID;
        const loadedProfile = await databaseService.getProfile(savedUserId);
        if (loadedProfile) {
          setUser({ id: loadedProfile.id, email: loadedProfile.email });
          setProfile(loadedProfile);
          setRole(loadedProfile.role);
          const famInfo = await databaseService.getFamilyForUser(loadedProfile.id);
          if (famInfo) setFamily(famInfo.family);
        }
      }
    } catch (err: unknown) {
      console.error('Authentication initialisation failed:', err);
      // Only set error if it is not a normal unauthenticated or network fallback condition
      const msg = err instanceof Error ? err.message : 'Authentication initialization error';
      if (!msg.toLowerCase().includes('session') && !msg.toLowerCase().includes('jwt') && !msg.toLowerCase().includes('fetch')) {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeAuth();

    if (isSupabaseLive) {
      const supabase = getSupabaseClient()!;
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          // If signed out or session lacks an active access token, reset state cleanly
          if (event === 'SIGNED_OUT' || !session?.user || !session?.access_token) {
            setUser(null);
            setProfile(null);
            setFamily(null);
            setIsStudentPreviewState(false);
            return;
          }

          setUser({ id: session.user.id, email: session.user.email });
          let prof = await databaseService.getProfile(session.user.id);
          if (!prof) {
            const meta = (session.user.user_metadata || {}) as Record<string, unknown>;
            const metaRole = (meta.role as UserRole) || 'parent';
            const metaName = (meta.full_name as string) || session.user.email?.split('@')[0] || 'User';

            try {
              prof = await databaseService.createProfile({
                id: session.user.id,
                role: metaRole,
                full_name: metaName,
                email: session.user.email,
              });
            } catch (createErr) {
              console.warn('Profile creation fallback notice in onAuthStateChange:', createErr);
              prof = await databaseService.getProfile(session.user.id);
            }
          }
          if (prof) {
            setProfile(prof);
            setRole(prof.role); // Locked to database profile role
          }
          try {
            let famInfo = await databaseService.getFamilyForUser(session.user.id);
            if (!famInfo && prof?.role === 'parent') {
              const defaultFamilyName = `${prof.full_name.split(' ')[0] || 'Our'}'s Family`;
              const { family: newFam } = await databaseService.createFamily(defaultFamilyName, session.user.id);
              famInfo = { family: newFam, role: 'parent' };
            }
            if (famInfo) setFamily(famInfo.family);
          } catch (famErr) {
            console.warn('Auth state family note:', famErr);
          }
        } catch (authChangeErr) {
          console.warn('Auth state change handler notice:', authChangeErr);
        }
      });

      return () => {
        authListener?.subscription.unsubscribe();
      };
    }
  }, [isSupabaseLive]);

  const reloadFamily = async () => {
    if (!user) return;
    const famInfo = await databaseService.getFamilyForUser(user.id);
    if (famInfo) {
      setFamily(famInfo.family);
    }
  };

  // Direct Sandbox Launcher for Development Mode
  const launchDevelopmentSandbox = async (targetRole: 'parent' | 'student' = 'parent') => {
    setIsLoading(true);
    setError(null);
    try {
      const targetId =
        targetRole === 'student'
          ? '00000000-0000-0000-0000-000000000002'
          : '00000000-0000-0000-0000-000000000001';

      localStorage.setItem(DEV_ACTIVE_USER_ID_STORAGE, targetId);
      const prof = await databaseService.getProfile(targetId);
      if (prof) {
        setUser({ id: prof.id, email: prof.email });
        setProfile(prof);
        setRole(prof.role);
        const famInfo = await databaseService.getFamilyForUser(targetId);
        if (famInfo) setFamily(famInfo.family);
      }
    } catch (err: unknown) {
      console.error('Launch sandbox error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Standardised Email/Password Sign In
  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (isProductionEnvironment() && !isSupabaseLive) {
        throw new Error('Supabase authentication is mandatory in production.');
      }

      if (isSupabaseLive && isSupabaseReachable()) {
        try {
          const supabase = getSupabaseClient()!;
          const { data, error: signInErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signInErr) {
            // If in development mode and using internal demo accounts that are not in live Supabase,
            // activate the dev sandbox session
            if (isDevelopmentEnvironment() && email.toLowerCase().endsWith('@homeeduhub.internal')) {
              console.info('Internal dev credentials detected: activating sandbox mode session.');
              await launchDevelopmentSandbox(
                email.toLowerCase().includes('student') || email.toLowerCase().includes('oliver')
                  ? 'student'
                  : 'parent'
              );
              return;
            }
            throw signInErr;
          }

          if (data.user) {
            setUser({ id: data.user.id, email: data.user.email });
            let prof = await databaseService.getProfile(data.user.id);

            // If profile does not exist yet (e.g. created after email confirmation),
            // create it safely because user is authenticated (auth.uid() = data.user.id)
            if (!prof) {
              const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
              const metaRole = (meta.role as UserRole) || 'parent';
              const metaName = (meta.full_name as string) || data.user.email?.split('@')[0] || 'User';

              try {
                prof = await databaseService.createProfile({
                  id: data.user.id,
                  role: metaRole,
                  full_name: metaName,
                  email: data.user.email,
                });
              } catch (pErr) {
                console.warn('Profile creation notice on sign-in:', pErr);
                prof = await databaseService.getProfile(data.user.id);
              }
            }

            if (prof) {
              setProfile(prof);
              setRole(prof.role);
            }

            try {
              let famInfo = await databaseService.getFamilyForUser(data.user.id);
              if (!famInfo && prof?.role === 'parent') {
                const defaultFamilyName = `${prof.full_name.split(' ')[0] || 'Our'}'s Family`;
                const { family: newFam } = await databaseService.createFamily(defaultFamilyName, data.user.id);
                famInfo = { family: newFam, role: 'parent' };
              }
              if (famInfo) setFamily(famInfo.family);
            } catch (famErr) {
              console.warn('Sign-in family note:', famErr);
            }
          }
        } catch (authEx: unknown) {
          const isFetchError =
            authEx instanceof TypeError ||
            (authEx instanceof Error &&
              (authEx.message.includes('fetch') ||
                authEx.message.includes('Network') ||
                authEx.message.includes('Failed to fetch')));

          if (isFetchError && isDevelopmentEnvironment()) {
            console.warn('Supabase remote network failure (Failed to fetch). Activating development sandbox session.');
            markSupabaseConnectivityFailed(true);
            await launchDevelopmentSandbox(
              email.toLowerCase().includes('student') || email.toLowerCase().includes('oliver')
                ? 'student'
                : 'parent'
            );
            return;
          }
          throw authEx;
        }
      } else if (isDevelopmentEnvironment()) {
        await launchDevelopmentSandbox(
          email.toLowerCase().includes('student') || email.toLowerCase().includes('oliver')
            ? 'student'
            : 'parent'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Standardised Email/Password Sign Up
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    chosenRole: UserRole,
    familyName: string = 'Our Home Education'
  ): Promise<{ confirmationRequired: boolean }> => {
    setIsLoading(true);
    setError(null);
    try {
      if (isProductionEnvironment() && !isSupabaseLive) {
        throw new Error('Supabase authentication is mandatory in production.');
      }

      if (isSupabaseLive && isSupabaseReachable()) {
        try {
          const supabase = getSupabaseClient()!;
          const redirectUrl = getAuthRedirectUrl();

          const { data: authData, error: authErr } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: redirectUrl,
              data: { full_name: fullName, role: chosenRole },
            },
          });
          if (authErr) throw authErr;

          if (authData.user) {
            // If an active session is returned immediately (email confirmation disabled or auto-confirmed)
            if (authData.session) {
              try {
                const prof = await databaseService.createProfile({
                  id: authData.user.id,
                  role: chosenRole,
                  full_name: fullName,
                  email: email.trim(),
                });
                setProfile(prof);
                setUser({ id: authData.user.id, email });
                setRole(chosenRole);

                if (chosenRole === 'parent') {
                  const { family: newFam } = await databaseService.createFamily(familyName, authData.user.id);
                  setFamily(newFam);
                }
              } catch (createErr) {
                console.warn('Profile provisioning notice on sign-up:', createErr);
                const existing = await databaseService.getProfile(authData.user.id);
                if (existing) {
                  setProfile(existing);
                  setUser({ id: authData.user.id, email });
                  setRole(existing.role);
                }
              }
              return { confirmationRequired: false };
            } else {
              // Email confirmation is required; user must confirm email before session token is granted.
              return { confirmationRequired: true };
            }
          }
          return { confirmationRequired: false };
        } catch (signUpEx: unknown) {
          const isFetchError =
            signUpEx instanceof TypeError ||
            (signUpEx instanceof Error &&
              (signUpEx.message.includes('fetch') ||
                signUpEx.message.includes('Network') ||
                signUpEx.message.includes('Failed to fetch')));

          if (isFetchError && isDevelopmentEnvironment()) {
            console.warn('Supabase remote network failure (Failed to fetch). Activating local development account.');
            markSupabaseConnectivityFailed(true);
            const newId = crypto.randomUUID();
            const prof = await databaseService.createProfile({
              id: newId,
              role: chosenRole,
              full_name: fullName,
              email: email.trim(),
            });

            localStorage.setItem(DEV_ACTIVE_USER_ID_STORAGE, newId);
            setUser({ id: newId, email: email.trim() });
            setProfile(prof);
            setRole(chosenRole);

            if (chosenRole === 'parent') {
              const { family: newFam } = await databaseService.createFamily(familyName, newId);
              setFamily(newFam);
            }
            return { confirmationRequired: false };
          }
          throw signUpEx;
        }
      } else if (isDevelopmentEnvironment()) {
        const newId = crypto.randomUUID();
        const prof = await databaseService.createProfile({
          id: newId,
          role: chosenRole,
          full_name: fullName,
          email: email.trim(),
        });

        localStorage.setItem(DEV_ACTIVE_USER_ID_STORAGE, newId);
        setUser({ id: newId, email: email.trim() });
        setProfile(prof);
        setRole(chosenRole);

        if (chosenRole === 'parent') {
          const { family: newFam } = await databaseService.createFamily(familyName, newId);
          setFamily(newFam);
        }
        return { confirmationRequired: false };
      }
      return { confirmationRequired: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Email Confirmation
  const resendConfirmationEmail = async (emailToResend: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      if (!emailToResend || !emailToResend.includes('@')) {
        throw new Error('Please provide a valid email address.');
      }

      if (isSupabaseLive) {
        const supabase = getSupabaseClient()!;
        const redirectUrl = getAuthRedirectUrl();

        const { error: resendErr } = await supabase.auth.resend({
          type: 'signup',
          email: emailToResend.trim(),
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        if (resendErr) throw resendErr;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend confirmation email';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseLive) {
        const supabase = getSupabaseClient()!;
        await supabase.auth.signOut();
      }
      localStorage.removeItem(DEV_ACTIVE_USER_ID_STORAGE);
      setUser(null);
      setProfile(null);
      setFamily(null);
      setIsStudentPreviewState(false);
    } catch (err: unknown) {
      console.error('Sign out error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Parent Preview toggle - strictly restricted to parents and does NOT change auth identity
  const setStudentPreview = (enabled: boolean) => {
    if (role !== 'parent') return;
    setIsStudentPreviewState(enabled);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        family,
        role,
        isStudentPreview,
        setStudentPreview,
        isSupabaseLive,
        isLoading,
        error,
        signIn,
        signUp,
        resendConfirmationEmail,
        launchDevelopmentSandbox,
        signOut,
        reloadFamily,
        clearError: () => setError(null),
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
