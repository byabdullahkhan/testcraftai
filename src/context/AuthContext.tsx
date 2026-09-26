import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, EmailNotification, cleanUsername } from '../types';
import { apiService } from '../services/apiService';

interface AuthContextType {
  user: UserProfile | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authModalOpen: boolean;
  authModalMode: 'signin' | 'get_started';
  openAuthModal: (mode?: 'signin' | 'get_started', onSuccess?: () => void) => void;
  closeAuthModal: () => void;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  registerWithUsername: (username: string, password: string, displayName?: string) => Promise<void>;
  signOutUser: () => void;
  updateUserProfileData: (displayName: string, username: string) => Promise<void>;
  editProfileModalOpen: boolean;
  setEditProfileModalOpen: (open: boolean) => void;
  recentEmails: EmailNotification[];
  sendAutomatedEmail: (emailData: {
    recipientEmail: string;
    recipientUid?: string;
    subject: string;
    type: 'welcome' | 'test_published' | 'submission_received' | 'weekly_summary';
    bodyText: string;
    meta?: any;
  }) => Promise<void>;
  emailDrawerOpen: boolean;
  setEmailDrawerOpen: (open: boolean) => void;
  // Legacy stubs if any component references them
  signInWithGoogle?: () => Promise<void>;
  signInAsAdminBypass?: () => Promise<void>;
  acceptTermsAndConditions?: () => Promise<void>;
  toggleEmailNotifications?: (enabled: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_SESSION_KEY = 'testcraft_user_session';
const LOCAL_EMAILS_KEY_PREFIX = 'testcraft_emails_';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'get_started'>('signin');
  const [pendingSuccessCallback, setPendingSuccessCallback] = useState<(() => void) | null>(null);
  const [recentEmails, setRecentEmails] = useState<EmailNotification[]>([]);
  const [emailDrawerOpen, setEmailDrawerOpen] = useState(false);
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);

  // Always require fresh sign-in whenever the user leaves and reopens the site
  useEffect(() => {
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      sessionStorage.removeItem(LOCAL_SESSION_KEY);
    } catch {}

    const handleLeaveSite = () => {
      try {
        localStorage.removeItem(LOCAL_SESSION_KEY);
        sessionStorage.removeItem(LOCAL_SESSION_KEY);
      } catch {}
    };

    window.addEventListener('pagehide', handleLeaveSite);
    window.addEventListener('beforeunload', handleLeaveSite);
    return () => {
      window.removeEventListener('pagehide', handleLeaveSite);
      window.removeEventListener('beforeunload', handleLeaveSite);
    };
  }, []);

  const loadUserEmails = (uid: string) => {
    try {
      const cached = localStorage.getItem(`${LOCAL_EMAILS_KEY_PREFIX}${uid}`);
      if (cached) {
        setRecentEmails(JSON.parse(cached));
      }
    } catch {}
  };

  const openAuthModal = (mode: 'signin' | 'get_started' = 'signin', onSuccess?: () => void) => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
    if (onSuccess) {
      setPendingSuccessCallback(() => onSuccess);
    } else {
      setPendingSuccessCallback(null);
    }
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setPendingSuccessCallback(null);
  };

  // Sign In with Username & Password
  const signInWithUsername = async (username: string, password: string) => {
    const rawUname = username.trim().replace(/^@/, '');
    const user = await apiService.signInUser({
      username: rawUname,
      password: password.trim(),
    });

    setUserProfile(user);
    loadUserEmails(user.uid);
    closeAuthModal();

    if (pendingSuccessCallback) {
      pendingSuccessCallback();
      setPendingSuccessCallback(null);
    }
  };

  // Register with Username & Password (Get Started)
  const registerWithUsername = async (username: string, password: string, displayName?: string) => {
    const rawUname = username.trim().replace(/^@/, '');
    const user = await apiService.registerUser({
      username: rawUname,
      password: password.trim(),
      displayName: displayName?.trim() || rawUname,
    });

    setUserProfile(user);
    loadUserEmails(user.uid);
    closeAuthModal();

    if (pendingSuccessCallback) {
      pendingSuccessCallback();
      setPendingSuccessCallback(null);
    }
  };

  const signOutUser = () => {
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      sessionStorage.removeItem(LOCAL_SESSION_KEY);
    } catch {}
    setUserProfile(null);
    setRecentEmails([]);
    closeAuthModal();
  };

  const updateUserProfileData = async (displayName: string, username: string) => {
    if (!userProfile) return;
    const cleanUname = cleanUsername(username).toLowerCase();
    const cleanName = displayName.trim() || userProfile.displayName;

    const updatedProfile: UserProfile = {
      ...userProfile,
      displayName: cleanName,
      username: cleanUname,
    };

    setUserProfile(updatedProfile);

    if (!window.location.hostname.includes('github.io')) {
      try {
        await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUname,
            displayName: cleanName,
          }),
        });
      } catch (e) {
        console.warn('Profile update warning:', e);
      }
    }
  };

  const sendAutomatedEmail = async (emailData: {
    recipientEmail: string;
    recipientUid?: string;
    subject: string;
    type: 'welcome' | 'test_published' | 'submission_received' | 'weekly_summary';
    bodyText: string;
    meta?: any;
  }) => {
    const newEmail: EmailNotification = {
      id: `mail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientEmail: emailData.recipientEmail,
      recipientUid: emailData.recipientUid || userProfile?.uid || 'user',
      subject: emailData.subject,
      type: emailData.type,
      bodyText: emailData.bodyText,
      sentAt: new Date().toISOString(),
      status: 'delivered',
      meta: emailData.meta
    };

    setRecentEmails(prev => {
      const updated = [newEmail, ...prev].slice(0, 30);
      if (emailData.recipientUid || userProfile?.uid) {
        const uid = emailData.recipientUid || userProfile?.uid;
        localStorage.setItem(`${LOCAL_EMAILS_KEY_PREFIX}${uid}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Compatibility stubs
  const signInWithGoogle = async () => {
    openAuthModal('signin');
  };

  const signInAsAdminBypass = async () => {
    await signInWithUsername('byabdullahkhan', 'gemini');
  };

  return (
    <AuthContext.Provider
      value={{
        user: userProfile,
        userProfile,
        loading,
        authModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        signInWithUsername,
        registerWithUsername,
        signOutUser,
        updateUserProfileData,
        editProfileModalOpen,
        setEditProfileModalOpen,
        recentEmails,
        sendAutomatedEmail,
        emailDrawerOpen,
        setEmailDrawerOpen,
        signInWithGoogle,
        signInAsAdminBypass,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
