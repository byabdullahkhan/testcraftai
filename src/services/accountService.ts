import { AppUser, UserAccountCredential, SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD } from '../types';
import { db } from './firebase';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';

const LOCAL_ACCOUNTS_KEY = 'testcraft_accounts_registry';
const LOCAL_SESSION_KEY = 'testcraft_auth_session';

// Pre-seeded Admin Account
const ADMIN_ACCOUNT: UserAccountCredential = {
  uid: 'usr_byabdullahkhan',
  username: SUPER_ADMIN_USERNAME,
  password: SUPER_ADMIN_PASSWORD,
  displayName: 'Abdullah Khan (Admin)',
  email: 'byabdullahkhan@gmail.com',
  role: 'super_admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Local storage helper
function getLocalAccounts(): Record<string, UserAccountCredential> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    const map: Record<string, UserAccountCredential> = raw ? JSON.parse(raw) : {};
    // Ensure admin is always present
    map[SUPER_ADMIN_USERNAME.toLowerCase()] = ADMIN_ACCOUNT;
    return map;
  } catch {
    return { [SUPER_ADMIN_USERNAME.toLowerCase()]: ADMIN_ACCOUNT };
  }
}

function saveLocalAccount(account: UserAccountCredential) {
  try {
    const map = getLocalAccounts();
    map[account.username.toLowerCase()] = account;
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Could not save account to local storage:', err);
  }
}

export const accountService = {
  // Check if username is available (case-insensitive)
  async checkUsernameAvailable(rawUsername: string): Promise<boolean> {
    const username = rawUsername.trim().toLowerCase();
    if (!username) return false;

    // Admin username is always reserved
    if (username === SUPER_ADMIN_USERNAME.toLowerCase()) {
      return false;
    }

    // 1. Check local registry first
    const localMap = getLocalAccounts();
    if (localMap[username]) {
      return false;
    }

    // 2. Check Firestore accounts collection
    try {
      const docRef = doc(db, 'accounts', username);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return false;
      }
    } catch {
      // Offline fallback: rely on localMap
    }

    // 3. Try backend API if available
    try {
      const res = await fetch(`/api/auth/check-username/${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        return !!data.available;
      }
    } catch {
      // Backend not running, proceed
    }

    return true;
  },

  // Register new user with username and password
  async register(
    rawUsername: string,
    rawPassword: string,
    rawDisplayName?: string
  ): Promise<{ success: boolean; user?: AppUser; error?: string }> {
    const username = rawUsername.trim().toLowerCase();
    const password = rawPassword.trim();
    const displayName = rawDisplayName?.trim() || rawUsername.trim();

    // Validations
    if (!username) {
      return { success: false, error: 'Please enter a username.' };
    }
    if (username.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long.' };
    }
    if (username.length > 24) {
      return { success: false, error: 'Username cannot exceed 24 characters.' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { success: false, error: 'Username can only contain letters, numbers, and underscores (_).' };
    }
    if (!password) {
      return { success: false, error: 'Please enter a password.' };
    }
    if (password.length < 3) {
      return { success: false, error: 'Password must be at least 3 characters long.' };
    }

    // Uniqueness check
    const isAvailable = await this.checkUsernameAvailable(username);
    if (!isAvailable) {
      return {
        success: false,
        error: `Username "${rawUsername.trim()}" is already taken. Please choose another username.`,
      };
    }

    const uid = 'usr_' + username;
    const newCredential: UserAccountCredential = {
      uid,
      username,
      password,
      displayName,
      role: 'instructor',
      createdAt: new Date().toISOString(),
    };

    // Save locally
    saveLocalAccount(newCredential);

    // Save to Firestore accounts collection
    try {
      const docRef = doc(db, 'accounts', username);
      await setDoc(docRef, newCredential);
    } catch (err) {
      console.warn('Firestore account save fallback:', err);
    }

    // Also sync to backend API if available
    try {
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCredential),
      });
    } catch {
      // Backend not running / GitHub Pages static mode
    }

    const appUser: AppUser = {
      uid,
      username,
      displayName,
      role: 'instructor',
    };

    this.setCurrentSession(appUser);

    return { success: true, user: appUser };
  },

  // Login with username and password
  async login(
    rawUsername: string,
    rawPassword: string
  ): Promise<{ success: boolean; user?: AppUser; error?: string }> {
    const username = rawUsername.trim().toLowerCase();
    const password = rawPassword.trim();

    if (!username) {
      return { success: false, error: 'Please enter your username.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    // Special Case: Super Admin
    if (username === SUPER_ADMIN_USERNAME.toLowerCase()) {
      if (password === SUPER_ADMIN_PASSWORD) {
        const adminUser: AppUser = {
          uid: ADMIN_ACCOUNT.uid,
          username: SUPER_ADMIN_USERNAME,
          displayName: ADMIN_ACCOUNT.displayName,
          email: ADMIN_ACCOUNT.email,
          role: 'super_admin',
        };
        saveLocalAccount(ADMIN_ACCOUNT);
        this.setCurrentSession(adminUser);
        return { success: true, user: adminUser };
      } else {
        return { success: false, error: 'Incorrect password for admin account (byabdullahkhan).' };
      }
    }

    // Look up regular account
    let account: UserAccountCredential | null = null;

    // 1. Check local registry
    const localMap = getLocalAccounts();
    if (localMap[username]) {
      account = localMap[username];
    }

    // 2. Check Firestore accounts collection
    if (!account) {
      try {
        const docRef = doc(db, 'accounts', username);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          account = snap.data() as UserAccountCredential;
          saveLocalAccount(account);
        }
      } catch {
        // Fallback
      }
    }

    // 3. Try backend API
    if (!account) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            this.setCurrentSession(data.user);
            return { success: true, user: data.user };
          }
        }
      } catch {
        // Fallback
      }
    }

    if (!account) {
      return {
        success: false,
        error: `Username "${rawUsername.trim()}" not found. Please check your username or click "Get Started" to register.`,
      };
    }

    if (account.password !== password) {
      return {
        success: false,
        error: 'Incorrect password. Please verify your password and try again.',
      };
    }

    const appUser: AppUser = {
      uid: account.uid,
      username: account.username,
      displayName: account.displayName,
      email: account.email,
      role: account.role || 'instructor',
    };

    this.setCurrentSession(appUser);
    return { success: true, user: appUser };
  },

  // Session storage management
  getCurrentSession(): AppUser | null {
    try {
      const raw = localStorage.getItem(LOCAL_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setCurrentSession(user: AppUser | null) {
    try {
      if (user) {
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(LOCAL_SESSION_KEY);
      }
    } catch (err) {
      console.warn('Could not update session storage', err);
    }
  },

  logout() {
    this.setCurrentSession(null);
  },

  // Fetch all registered accounts (for Admin Panel)
  async getAllRegisteredAccounts(): Promise<UserAccountCredential[]> {
    const map = getLocalAccounts();
    const accounts: UserAccountCredential[] = Object.values(map);

    try {
      const colRef = collection(db, 'accounts');
      const snap = await getDocs(colRef);
      snap.forEach(d => {
        const data = d.data() as UserAccountCredential;
        if (data && data.username) {
          map[data.username.toLowerCase()] = data;
        }
      });
    } catch {
      // Offline fallback
    }

    return Object.values(map);
  },
};
