import React, { useState, useEffect } from 'react';
import {
  X,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    resetPasswordWithEmail,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authModalOpen) {
      setError(null);
      setSuccessMessage(null);
      setGoogleLoading(false);
      setEmailLoading(false);
      setResetLoading(false);
    }
  }, [authModalOpen]);

  if (!authModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMessage(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError(null);
      } else if (code === 'auth/unauthorized-domain') {
        const currentHost =
          typeof window !== 'undefined' ? window.location.hostname : 'testcraftai.online';
        setError(
          `Domain "${currentHost}" is not yet authorized in Firebase. Open Firebase Console (testcraftai-online) → Authentication → Settings → Authorized domains → Add "${currentHost}".`
        );
      } else if (code === 'auth/operation-not-allowed') {
        setError(
          'Google Sign-In is not yet enabled in Firebase Console. Open Firebase Console (testcraftai-online) → Authentication → Sign-in method → Enable Google.'
        );
      } else {
        setError(err?.message || 'Google Sign-In could not be completed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanMail = email.trim();
    const cleanPass = password.trim();

    if (!cleanMail || !cleanMail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (cleanPass.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setEmailLoading(true);
    try {
      await signInWithEmail(cleanMail, cleanPass);
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (code === 'auth/weak-password') {
        setError('Password should be at least 6 characters long.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err?.message || 'Sign in failed. Please try again.');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setSuccessMessage(null);
    const cleanMail = email.trim();
    if (!cleanMail || !cleanMail.includes('@')) {
      setError('Enter your email address above first, then click "Forgot password?".');
      return;
    }
    setResetLoading(true);
    try {
      await resetPasswordWithEmail(cleanMail);
      setSuccessMessage(`Password reset link sent to ${cleanMail}. Please check your inbox.`);
    } catch (err: any) {
      setError(err?.message || 'Could not send password reset email. Please verify your email.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={closeAuthModal}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
            <Logo size="xs" />
            <span>TestCraft AI Workspace</span>
          </div>

          <button
            onClick={closeAuthModal}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 pt-2 space-y-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 font-display">Sign In</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Continue with Google or sign in with your email address.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold leading-relaxed flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold leading-relaxed flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Primary Google Sign-In Button */}
          <button
            type="button"
            id="btn-google-signin"
            disabled={googleLoading || emailLoading}
            onClick={handleGoogleSignIn}
            className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-bold text-sm border-2 border-slate-200 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
          >
            {googleLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-200" />
            <span className="shrink-0 mx-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              or continue with email
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          {/* 2. Direct Email & Password Sign-In Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none text-sm text-slate-900"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">Password</label>
                <button
                  type="button"
                  disabled={resetLoading}
                  onClick={handleForgotPassword}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                >
                  {resetLoading ? 'Sending...' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none text-sm text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={emailLoading || googleLoading}
              className="w-full py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm shadow-sm shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {emailLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Continue with Email</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Privacy Note */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Your tests and student reports stay private to your account. Students open test links directly without signing in.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
