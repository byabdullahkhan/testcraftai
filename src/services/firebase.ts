import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Read config from JSON if available, or fallback to environment variables
const firebaseConfig = {
  projectId: "focused-discipline-zvxch",
  appId: "1:589939583691:web:3d7a7e587476f471c4c94e",
  apiKey: "AIzaSyD8GU8MiWPFFKfe-Kqqy6Xw0E6WzhF3Xf0",
  authDomain: "focused-discipline-zvxch.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-testcraftai-f70b3c24-a993-48a1-a288-3aed1c6b3ab5",
  storageBucket: "focused-discipline-zvxch.firebasestorage.app",
  messagingSenderId: "589939583691"
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Google Auth Provider configured with prompt for account selection
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Firestore targeting the provisioned database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

export default app;
