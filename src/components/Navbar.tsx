import React, { useState, useRef, useEffect } from 'react';
import { 
  LogIn, 
  UserPlus, 
  LogOut, 
  ShieldCheck, 
  ChevronDown, 
  FolderOpen,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatUsername } from '../types';
import { Logo } from './Logo';

interface NavbarProps {
  onGoHome?: () => void;
  onMakeTest?: () => void;
  onViewProjects?: () => void;
  currentView?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onGoHome,
  onMakeTest,
  onViewProjects,
  currentView = 'home'
}) => {
  const { 
    user, 
    userProfile, 
    openAuthModal, 
    signOutUser, 
    setEditProfileModalOpen 
  } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div 
          onClick={onGoHome}
          className="cursor-pointer group select-none"
        >
          <Logo size="sm" showText />
        </div>

        {/* Center / Nav Links */}
        <div className="hidden md:flex items-center gap-1.5">
          {onMakeTest && (
            <button
              onClick={() => {
                if (!user) {
                  openAuthModal('signin');
                } else {
                  onMakeTest();
                }
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                currentView === 'creator'
                  ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <span>Make Test</span>
            </button>
          )}

          {onViewProjects && (
            <button
              id="btn-nav-previous-projects"
              onClick={() => {
                if (!user) {
                  openAuthModal('signin');
                } else {
                  onViewProjects();
                }
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                currentView === 'projects'
                  ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Previous Projects</span>
            </button>
          )}
        </div>

        {/* Right side: Username Sign-In & User Account State */}
        <div className="flex items-center gap-2.5">
          {!user ? (
            /* Two Options: Sign In or Get Started */
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-nav-signin"
                onClick={() => openAuthModal('signin')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                id="btn-nav-get-started"
                onClick={() => openAuthModal('get_started')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Get Started</span>
              </button>
            </div>
          ) : (
            /* Logged in User Menu */
            <div className="flex items-center gap-2">
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  id="btn-user-menu"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 p-1.5 pl-2 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
                >
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase">
                    {(user.username || user.displayName || 'U').charAt(0)}
                  </div>

                  <div className="text-left hidden sm:block pr-1 max-w-[140px]">
                    <span className="text-xs font-bold text-slate-800 truncate block">
                      {user.displayName || user.username}
                    </span>
                    <span className="text-[10px] text-indigo-600 font-semibold truncate block font-mono">
                      {formatUsername(userProfile?.username || user.username)}
                    </span>
                  </div>

                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 pr-1" />
                </button>

                {/* Dropdown Menu */}
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 animate-in fade-in zoom-in-95 duration-100 z-50">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-700 mb-1">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Private Account</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-mono font-bold">
                          {formatUsername(userProfile?.username || user.username)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-800 font-bold block truncate">
                        {user.displayName || user.username}
                      </span>
                    </div>

                    <div className="py-1">
                      <button
                        id="btn-edit-profile-username"
                        onClick={() => {
                          setMenuOpen(false);
                          setEditProfileModalOpen(true);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left cursor-pointer"
                      >
                        <span className="flex items-center gap-2 font-semibold">
                          <User className="w-4 h-4 text-indigo-600" />
                          <span>Profile Settings</span>
                        </span>
                        <span className="text-[10px] text-indigo-600 font-mono font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                          {formatUsername(userProfile?.username || user.username)}
                        </span>
                      </button>

                      {onViewProjects && (
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            onViewProjects();
                          }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left cursor-pointer"
                        >
                          <span className="flex items-center gap-2 font-semibold">
                            <FolderOpen className="w-4 h-4 text-indigo-600" />
                            <span>Previous Projects</span>
                          </span>
                        </button>
                      )}

                      <div className="border-t border-slate-100 my-1" />

                      <button
                        id="btn-sign-out"
                        onClick={() => {
                          setMenuOpen(false);
                          signOutUser();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left font-semibold cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
