import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  AtSign, 
  Mail, 
  ShieldCheck, 
  Check, 
  Save, 
  AlertCircle,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cleanUsername, formatUsername, isSuperAdmin } from '../types';

export const UserProfileModal: React.FC = () => {
  const { 
    user, 
    userProfile, 
    editProfileModalOpen, 
    setEditProfileModalOpen, 
    updateUserProfileData 
  } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setUsername(userProfile.username || '');
    }
  }, [userProfile, editProfileModalOpen]);

  if (!editProfileModalOpen || !user || !userProfile) return null;

  const isAdmin = isSuperAdmin(user.email);
  const cleanedPreview = cleanUsername(username || displayName || user.email?.split('@')[0] || 'user');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please provide a valid username.');
      return;
    }
    const validated = cleanUsername(username);
    if (validated.length < 3) {
      setError('Username must be at least 3 alphanumeric characters or underscores.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateUserProfileData(displayName.trim(), validated);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setEditProfileModalOpen(false);
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-display">
                Profile & Username System
              </h3>
              <p className="text-[11px] text-slate-500">
                Customize your account handle and workspace identity
              </p>
            </div>
          </div>

          <button
            onClick={() => setEditProfileModalOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Avatar & Email Identity Card */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Avatar" 
                className="w-12 h-12 rounded-2xl object-cover border border-slate-300"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-extrabold text-lg flex items-center justify-center">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 text-sm truncate">
                  {userProfile.displayName}
                </span>
                {isAdmin ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black border border-rose-200">
                    SUPER ADMIN
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                    INSTRUCTOR
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 font-mono block truncate mt-0.5">
                {user.email}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Username & profile updated successfully!</span>
            </div>
          )}

          {/* Username Field */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
              <span>Account Handle (@username) *</span>
              <span className="text-[10px] text-indigo-600 font-mono font-bold">
                {formatUsername(cleanedPreview)}
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                @
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                maxLength={24}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-900 font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Your unique public identifier for published test papers and evaluation marksheets. (3-24 characters: lowercase, numbers, underscores).
            </p>
          </div>

          {/* Display Name Field */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1">
              Full Display Name *
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Professor Sarah Connor"
              maxLength={40}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-900"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setEditProfileModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
