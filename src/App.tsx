import React, { useState, useEffect } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { TestCreator } from './components/TestCreator';
import { PreviousProjects } from './components/PreviousProjects';
import { TestTaker } from './components/TestTaker';
import { TestResultReport } from './components/TestResultReport';
import { Navbar } from './components/Navbar';
import { Logo } from './components/Logo';
import { AuthModal } from './components/AuthModal';
import { AutomatedEmailDrawer } from './components/AutomatedEmailDrawer';
import { UserProfileModal } from './components/UserProfileModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Test, TestSubmission } from './types';
import { apiService } from './services/apiService';
import { extractAndSyncTestFromUrl, getStudentShareUrl } from './utils/urlHelper';

export type AppView = 'home' | 'creator' | 'projects' | 'taker';

const CREATED_TESTS_STORAGE_KEY = 'testcraft_created_test_ids_v7_clean';

function AppContent() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<TestSubmission | null>(null);
  const [userCreatedTestIds, setUserCreatedTestIds] = useState<string[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const { user, openAuthModal } = useAuth();

  // Clean up any legacy previous projects from older storage versions once on mount
  useEffect(() => {
    try {
      localStorage.removeItem('testcraft_local_tests_v6');
      localStorage.removeItem('testcraft_created_test_ids');
    } catch {}
  }, []);

  // If user signs out while on creator or projects view, immediately return to home
  useEffect(() => {
    if (!user && (currentView === 'creator' || currentView === 'projects')) {
      setCurrentView('home');
    }
  }, [user, currentView]);

  // Load tests belonging strictly to the signed-in username
  useEffect(() => {
    if (user) {
      apiService
        .getTests(user.uid, user.username)
        .then(allTests => {
          if (allTests && allTests.length > 0) {
            const userOnly = allTests.filter(
              t =>
                (t.creatorUsername &&
                  t.creatorUsername.toLowerCase().trim().replace(/^@/, '') ===
                    user.username.toLowerCase().trim().replace(/^@/, '')) ||
                t.creatorUid === user.uid
            );
            setUserCreatedTestIds(userOnly.map(t => t.id));
          } else {
            setUserCreatedTestIds([]);
          }
        })
        .catch(console.error);
    } else {
      setUserCreatedTestIds([]);
    }
  }, [user]);

  // Parse URL on load and on navigation: supports /test/:slug, ?test=..., ?d=... on any email/device
  useEffect(() => {
    const checkUrlForTest = () => {
      const { testId, decodedTest } = extractAndSyncTestFromUrl();
      const targetId = decodedTest?.id || testId;
      if (targetId) {
        setActiveTestId(targetId);
        setCurrentView('taker');
        setCurrentSubmission(null);
        setIsPreviewMode(false);
      }
    };

    checkUrlForTest();
    window.addEventListener('popstate', checkUrlForTest);
    window.addEventListener('hashchange', checkUrlForTest);
    return () => {
      window.removeEventListener('popstate', checkUrlForTest);
      window.removeEventListener('hashchange', checkUrlForTest);
    };
  }, []);

  // When a test is created or uploaded by teacher
  const handleTestCreated = (newTest: Test) => {
    setActiveTestId(newTest.id);
    setUserCreatedTestIds(prev => {
      const updated = Array.from(new Set([newTest.id, ...prev]));
      try {
        localStorage.setItem(CREATED_TESTS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // Open / Take test as student
  const handlePreviewTest = (testIdOrSlugOrUrl: string) => {
    const { testId: extractedId, decodedTest } = extractAndSyncTestFromUrl(testIdOrSlugOrUrl);
    const resolvedId = decodedTest?.id || extractedId || testIdOrSlugOrUrl;

    setActiveTestId(resolvedId);
    setCurrentSubmission(null);
    setIsPreviewMode(Boolean(user));
    setCurrentView('taker');

    try {
      const shareUrl = getStudentShareUrl(resolvedId, decodedTest || undefined);
      const parsed = new URL(shareUrl, window.location.origin);
      window.history.pushState({}, '', `${parsed.pathname}${parsed.search}${parsed.hash}`);
    } catch {
      if (
        window.location.hostname.includes('github.io') ||
        window.location.hostname.includes('testcraftai.online')
      ) {
        const cleanPath = window.location.pathname.replace(/\/test\/.*$/, '');
        window.history.pushState({}, '', `${cleanPath}?test=${encodeURIComponent(resolvedId)}`);
      } else {
        window.history.pushState({}, '', `/test/${encodeURIComponent(resolvedId)}`);
      }
    }
  };

  // Navigation handlers
  const handleMakeTest = () => {
    if (!user) {
      openAuthModal('signin', () => setCurrentView('creator'));
      return;
    }
    setCurrentView('creator');
  };

  const handleViewProjects = () => {
    if (!user) {
      openAuthModal('signin', () => setCurrentView('projects'));
      return;
    }
    setCurrentView('projects');
  };

  // When student submits test
  const handleSubmissionComplete = (submission: TestSubmission) => {
    setCurrentSubmission(submission);
  };

  // When viewing prior result for single-attempt candidate
  const handleViewPriorResult = (submissionId: string) => {
    apiService
      .getSubmissionById(submissionId)
      .then(sub => {
        if (sub) {
          setCurrentSubmission(sub);
        }
      })
      .catch(console.error);
  };

  // Return to home
  const handleBackToHome = () => {
    setCurrentView('home');
    setCurrentSubmission(null);
    setIsPreviewMode(false);
    setActiveTestId(null);
    if (window.location.hostname.includes('github.io')) {
      const cleanPath = window.location.pathname.replace(/\/test\/.*$/, '') || '/';
      window.history.pushState({}, '', cleanPath);
    } else {
      window.history.pushState({}, '', '/');
    }
  };

  // ==========================================
  // 1. STUDENT VIEW / TEST-TAKING SCREEN
  // (Clean standalone test & result view — no logo, no site name, no account name)
  // ==========================================
  if (currentView === 'taker' && activeTestId) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-indigo-100">
        <main className="py-6">
          {currentSubmission ? (
            <TestResultReport submission={currentSubmission} />
          ) : (
            <TestTaker
              key={activeTestId}
              testId={activeTestId}
              onSubmissionComplete={handleSubmissionComplete}
              onViewPriorResult={handleViewPriorResult}
            />
          )}
        </main>
      </div>
    );
  }

  // ==========================================
  // 2. MAIN TEACHER / CREATOR WORKSPACE
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased selection:bg-indigo-100">
      <Navbar
        onGoHome={handleBackToHome}
        onMakeTest={handleMakeTest}
        onViewProjects={handleViewProjects}
        currentView={currentView}
      />

      <main className="flex-1">
        {currentView === 'home' && (
          <HomeScreen
            onMakeTest={handleMakeTest}
            onViewProjects={handleViewProjects}
            onTakeTest={handlePreviewTest}
          />
        )}

        {currentView === 'creator' && user && (
          <TestCreator
            onTestCreated={handleTestCreated}
            onGoToTest={handlePreviewTest}
            onGoToPreviousProjects={handleViewProjects}
            onBackToHome={handleBackToHome}
          />
        )}

        {currentView === 'projects' && user && (
          <PreviousProjects
            onBackToHome={handleBackToHome}
            onMakeNewTest={handleMakeTest}
            onPreviewAsStudent={handlePreviewTest}
            onTestCreated={handleTestCreated}
            filteredTestIds={userCreatedTestIds}
          />
        )}
      </main>

      <AuthModal />
      <UserProfileModal />
      <AutomatedEmailDrawer />

      {currentView === 'home' && (
        <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200/70">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 px-4">
            <Logo size="xs" showText textClassName="text-xs" />
            <span className="hidden sm:inline text-slate-300" aria-hidden="true">•</span>
            <p>Online Examination & Conceptual Evaluation System • Full Account Privacy & Isolation</p>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
