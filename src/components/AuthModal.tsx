import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Lock, 
  AtSign, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Sparkles,
  ShieldCheck,
  UserPlus,
  LogIn
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD } from '../types';
import { apiService } from '../services/apiService';

export const AuthModal: React.FC = () => {
  const { 
    authModalOpen, 
    authModalMode, 
    openAuthModal,
    closeAuthModal, 
    signInWithUsername, 
    registerWithUsername 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'signin' | 'get_started'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameAvailability, setUsernameAvailability] = useState<{ available?: boolean; message?: string } | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    if (authModalOpen) {
      setActiveTab(authModalMode);
      setError(null);
      setUsernameAvailability(null);
    }
  }, [authModalOpen, authModalMode]);

  // Check username availability while typing in "Get Started" mode
  useEffect(() => {
    if (activeTab !== 'get_started') {
      setUsernameAvailability(null);
      return;
    }

    const clean = username.trim().replace(/^@/, '');
    if (clean.length < 3) {
      setUsernameAvailability(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const result = await apiService.checkUsername(clean);
        setUsernameAvailability(result);
      } catch {
        setUsernameAvailability(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [username, activeTab]);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUname = username.trim().replace(/^@/, '');
    if (!cleanUname) {
      setError('Please enter a username.');
      return;
    }
    if (cleanUname.length < 3) {
      setError('Username must be at least 3 characters long (letters, numbers, underscore).');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'get_started') {
        await registerWithUsername(cleanUname, password.trim(), displayName.trim() || undefined);
      } else {
        await signInWithUsername(cleanUname, password.trim());
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setActiveTab('signin');
    setUsername(SUPER_ADMIN_USERNAME);
    setPassword(SUPER_ADMIN_PASSWORD);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
            <Logo size="xs" />
            <span>TestCraft Workspace Access</span>
          </div>

          <button
            onClick={closeAuthModal}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers: Sign In vs Get Started */}
        <div className="px-6 pt-2 pb-1">
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              id="tab-auth-signin"
              onClick={() => {
                setActiveTab('signin');
                setError(null);
              }}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'signin'
                  ? 'bg-white text-indigo-700 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              id="tab-auth-get-started"
              onClick={() => {
                setActiveTab('get_started');
                setError(null);
              }}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'get_started'
                  ? 'bg-white text-indigo-700 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Get Started</span>
            </button>
          </div>
        </div>

        {/* Body Form */}
        <div className="p-6 pt-3 space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-display">
              {activeTab === 'get_started' ? 'Create Your Account' : 'Welcome Back'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {activeTab === 'get_started'
                ? 'Choose your unique username handle and password to set up your isolated test workspace.'
                : 'Enter your account username and password to open your examinations and reports.'}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold leading-relaxed flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {activeTab === 'get_started' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full / Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    id="input-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Prof. Sarah Jenkins"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Username *
                </label>
                {activeTab === 'get_started' && username.trim().length >= 3 && (
                  <span className="text-[10px] font-bold">
                    {checkingUsername ? (
                      <span className="text-slate-400">Checking...</span>
                    ) : usernameAvailability?.available === false ? (
                      <span className="text-rose-600">Already Taken ✗</span>
                    ) : usernameAvailability?.available === true ? (
                      <span className="text-emerald-600">Available ✓</span>
                    ) : null}
                  </span>
                )}
              </div>
              <div className="relative">
                <AtSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  id="input-username"
                  required
                  value={username.replace(/^@/, '')}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. sarah_teacher"
                  className={`w-full h-11 pl-10 pr-3.5 rounded-xl border text-xs font-mono font-bold focus:ring-2 transition-all ${
                    activeTab === 'get_started' && usernameAvailability?.available === false
                      ? 'border-rose-400 focus:ring-rose-200 text-rose-900 bg-rose-50/30'
                      : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900'
                  }`}
                />
              </div>
              {activeTab === 'get_started' && usernameAvailability?.available === false && (
                <p className="text-[11px] text-rose-600 font-semibold mt-1">
                  Username '@{username.trim().replace(/^@/, '')}' is already taken. Please choose another username.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="input-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="btn-submit-auth"
              disabled={loading || (activeTab === 'get_started' && usernameAvailability?.available === false)}
              className="w-full mt-2 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{activeTab === 'get_started' ? 'Create Account & Get Started' : 'Sign In to Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
            {activeTab === 'get_started' ? (
              <span>
                Already created your username?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signin');
                    setError(null);
                  }}
                  className="font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Visiting for the first time?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('get_started');
                    setError(null);
                  }}
                  className="font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Get Started
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
