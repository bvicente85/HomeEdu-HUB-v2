import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/database';
import { isDevelopmentEnvironment } from '../lib/supabase';
import { GraduationCap, Lock, Mail, User, ShieldCheck, ArrowRight, AlertCircle, Info, RefreshCw } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { signIn, signUp, resendConfirmationEmail, error, clearError, isSupabaseLive } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('parent');
  const [familyName, setFamilyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const isDev = isDevelopmentEnvironment();

  const isUnconfirmedError =
    Boolean(error && (error.toLowerCase().includes('confirm') || error.toLowerCase().includes('not confirmed')));

  const handleResendConfirmation = async () => {
    if (!email.trim() || !email.includes('@')) {
      setFormError('Please enter your email address to resend the confirmation email.');
      return;
    }
    setIsResending(true);
    setResendNotice(null);
    clearError();
    setFormError(null);
    try {
      await resendConfirmationEmail(email.trim());
      setResendNotice('Confirmation email resent! Please check your email inbox and spam folder.');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Could not resend confirmation email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setFormError(null);
    setInfoMessage(null);
    setResendNotice(null);

    if (!email || !password) {
      setFormError('Email address and password are required.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        if (!fullName.trim()) {
          setFormError('Full name is required.');
          setIsSubmitting(false);
          return;
        }
        const result = await signUp(
          email,
          password,
          fullName.trim(),
          role,
          familyName.trim() || undefined
        );
        if (result?.confirmationRequired) {
          setInfoMessage('Account created! Please check your email inbox to confirm your account, then sign in below.');
          setMode('signin');
        }
      }
    } catch (err: unknown) {
      console.error('Authentication error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDevQuickFill = (type: 'parent' | 'student') => {
    clearError();
    setFormError(null);
    setInfoMessage(null);
    setResendNotice(null);
    setMode('signin');
    if (type === 'parent') {
      setEmail('parent@homeeduhub.internal');
      setPassword('StudyPass2026!');
    } else {
      setEmail('oliver@homeeduhub.internal');
      setPassword('StudyPass2026!');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 bg-stone-900 rounded-lg mx-auto flex items-center justify-center text-white mb-4">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          HomeEdu Hub
        </h1>
        <p className="mt-1 text-xs text-stone-500">
          Private Family Educational Platform · Key Stage 3 & GCSE
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 border border-stone-200 shadow-xs sm:rounded-lg sm:px-10 space-y-6">
          {/* Segmented Mode Selector */}
          <div className="flex border-b border-stone-200">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                clearError();
                setFormError(null);
                setResendNotice(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors ${
                mode === 'signin'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                clearError();
                setFormError(null);
                setResendNotice(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors ${
                mode === 'signup'
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              Create Account
            </button>
          </div>

          {(error || formError) && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md space-y-2 text-xs text-rose-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{formError || error}</span>
              </div>
              {isUnconfirmedError && (
                <div className="pt-1.5 flex items-center justify-between border-t border-rose-200/60">
                  <span className="text-2xs text-rose-600">Need another confirmation email?</span>
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResending}
                    className="text-2xs font-semibold text-rose-900 underline hover:text-rose-700 inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    {isResending && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                    <span>{isResending ? 'Resending...' : 'Resend confirmation'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {infoMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md space-y-2 text-xs text-emerald-800">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{infoMessage}</span>
              </div>
              <div className="pt-1.5 flex items-center justify-between border-t border-emerald-200/60">
                <span className="text-2xs text-emerald-700">Didn't receive the email?</span>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={isResending}
                  className="text-2xs font-semibold text-emerald-950 underline hover:text-emerald-800 inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {isResending && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                  <span>{isResending ? 'Resending...' : 'Resend confirmation email'}</span>
                </button>
              </div>
            </div>
          )}

          {resendNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-start gap-2 text-xs text-emerald-800">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{resendNotice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Sarah Harrison"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400"
                    />
                  </div>
                </div>

                {/* Account Role Selection */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Account Role <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('parent')}
                      className={`p-3 text-left border rounded-md transition-colors ${
                        role === 'parent'
                          ? 'border-stone-900 bg-stone-50 text-stone-900'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <div className="font-semibold text-xs text-stone-900">Parent</div>
                      <div className="text-2xs text-stone-500 mt-0.5">Family & study management</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`p-3 text-left border rounded-md transition-colors ${
                        role === 'student'
                          ? 'border-stone-900 bg-stone-50 text-stone-900'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <div className="font-semibold text-xs text-stone-900">Student</div>
                      <div className="text-2xs text-stone-500 mt-0.5">Direct daily study access</div>
                    </button>
                  </div>
                  <p className="text-2xs text-stone-400 mt-1">
                    Note: Roles are permanent and protected at the database level by Row Level Security.
                  </p>
                </div>

                {role === 'parent' && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Family Workspace Name
                    </label>
                    <input
                      type="text"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder="e.g. The Harrison Family"
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>
            </div>

            {mode === 'signin' && (
              <div className="flex items-center justify-between text-2xs">
                <span className="text-stone-400">Need confirmation email resent?</span>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={isResending}
                  className="font-medium text-stone-700 hover:text-stone-900 underline disabled:opacity-50"
                >
                  {isResending ? 'Resending...' : 'Resend confirmation'}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2 px-4 text-xs font-semibold text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Authenticating...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Development Quick-Fill presets */}
          {isDev && (
            <div className="pt-4 border-t border-stone-100 space-y-2">
              <div className="flex items-center gap-1.5 text-2xs text-stone-500 font-mono uppercase tracking-wider">
                <Info className="w-3 h-3 text-stone-400" />
                <span>Development Sandbox Presets</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDevQuickFill('parent')}
                  className="text-2xs py-1.5 px-2 border border-stone-200 rounded text-stone-700 hover:bg-stone-50 text-left truncate"
                >
                  Fill: <strong>Sarah (Parent)</strong>
                </button>
                <button
                  type="button"
                  onClick={() => handleDevQuickFill('student')}
                  className="text-2xs py-1.5 px-2 border border-stone-200 rounded text-stone-700 hover:bg-stone-50 text-left truncate"
                >
                  Fill: <strong>Oliver (Student)</strong>
                </button>
              </div>
            </div>
          )}

          {/* Production & Security footer disclaimer */}
          <div className="pt-3 border-t border-stone-100 flex items-center gap-2 text-2xs text-stone-400">
            <ShieldCheck className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <span>
              {isSupabaseLive
                ? 'Secured by Supabase PostgreSQL Row Level Security'
                : 'Development Environment: Supabase configuration required in production'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
