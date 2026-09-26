import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  PlusCircle,
  Users,
  Copy,
  Check,
  Sparkles,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FolderOpen,
  Trash2,
  Eye,
  Upload,
  Download,
  Plus,
  LogIn,
  ChevronRight,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import { Test, TestSubmission, Question, QuestionType } from '../types';
import { getStudentShareUrl } from '../utils/urlHelper';
import { apiService } from '../services/apiService';
import { subscribeToLiveSubmissions } from '../utils/cloudSync';
import { useAuth } from '../context/AuthContext';
import { downloadSubmissionAsImage } from '../utils/downloadReportImage';

interface TestSummary {
  id: string;
  slug?: string;
  title: string;
  subject: string;
  instructions?: string;
  totalMarks: number;
  timeLimitMinutes: number | null;
  questionCount: number;
  questions?: Question[];
  createdAt: string;
  creatorName: string;
  creatorUid?: string;
  creatorUsername?: string;
  creatorEmail?: string;
  submissionCount: number;
}

interface PreviousProjectsProps {
  onBackToHome: () => void;
  onMakeNewTest: () => void;
  onPreviewAsStudent: (testId: string) => void;
  onTestCreated?: (newTest: Test) => void;
  filteredTestIds?: string[];
}

export const PreviousProjects: React.FC<PreviousProjectsProps> = ({
  onBackToHome,
  onMakeNewTest,
  onTestCreated,
}) => {
  const { user, userProfile, openAuthModal } = useAuth();
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'details' | 'see_test'>('list');

  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<TestSubmission | null>(null);

  const [loadingTests, setLoadingTests] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [copiedTestId, setCopiedTestId] = useState<string | null>(null);

  // State for "See the Test" & Editable Test Builder
  const [loadingFullTest, setLoadingFullTest] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editHasTimeLimit, setEditHasTimeLimit] = useState(false);
  const [editTimeLimitMinutes, setEditTimeLimitMinutes] = useState<number>(30);
  const [editQuestions, setEditQuestions] = useState<Question[]>([]);
  const [uploadingEditedTest, setUploadingEditedTest] = useState(false);
  const [newlyUploadedTest, setNewlyUploadedTest] = useState<Test | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchUserProjects = () => {
    if (!user) {
      setTests([]);
      setLoadingTests(false);
      return;
    }
    setLoadingTests(true);
    apiService
      .getTests(user.uid, user.username)
      .then(allTestsList => {
        const allTests: TestSummary[] = (allTestsList || []).filter(
          t =>
            (t.creatorUsername &&
              t.creatorUsername.toLowerCase().trim().replace(/^@/, '') ===
                user.username.toLowerCase().trim().replace(/^@/, '')) ||
            (t.creatorUid && t.creatorUid === user.uid)
        );
        setTests(allTests);
        setLoadingTests(false);
        // Pre-warm cloud submissions in background for all user projects
        allTests.forEach(t => {
          apiService.getSubmissions(t.id, t.title).catch(() => {});
        });
      })
      .catch(err => {
        console.error(err);
        setLoadingTests(false);
      });
  };

  useEffect(() => {
    fetchUserProjects();
  }, [user]);

  const refreshSubmissions = (silent = false) => {
    if (!selectedTestId) return;
    if (!silent) setLoadingSubmissions(true);
    const currentTest = tests.find(t => t.id === selectedTestId);
    apiService
      .getSubmissions(selectedTestId, currentTest?.title)
      .then(subs => {
        setSubmissions(subs || []);
        if (!silent) setLoadingSubmissions(false);
      })
      .catch(err => {
        console.error(err);
        if (!silent) setLoadingSubmissions(false);
      });
  };

  // Fetch and live-sync submissions when a project is opened
  useEffect(() => {
    if (!selectedTestId) {
      setSubmissions([]);
      setSelectedSubmission(null);
      return;
    }

    const currentTest = tests.find(t => t.id === selectedTestId);
    refreshSubmissions(false);

    const unsubscribe = subscribeToLiveSubmissions(
      selectedTestId,
      currentTest?.title,
      newSub => {
        setSubmissions(prev => {
          if (prev.some(s => s.id === newSub.id)) return prev;
          return [newSub, ...prev];
        });
        refreshSubmissions(true);
      }
    );

    const pollInterval = setInterval(() => {
      refreshSubmissions(true);
    }, 4000);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshSubmissions(true);
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [selectedTestId, tests.length]);

  const handleCopyLink = (testOrId: TestSummary | Test | string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const testObj =
      typeof testOrId === 'object' ? testOrId : tests.find(t => t.id === testOrId);
    const testId = typeof testOrId === 'string' ? testOrId : testOrId.id;
    const url = getStudentShareUrl(testId, testObj);
    navigator.clipboard.writeText(url);
    setCopiedTestId(testId);
    setTimeout(() => setCopiedTestId(null), 2500);
  };

  const handleOpenProjectDetails = (testId: string) => {
    setSelectedTestId(testId);
    setSelectedSubmission(null);
    setNewlyUploadedTest(null);
    setViewMode('details');
  };

  const handleOpenSeeTest = async (testId: string) => {
    setLoadingFullTest(true);
    setEditError(null);
    setNewlyUploadedTest(null);
    setViewMode('see_test');

    try {
      const fullTest = await apiService.getTestById(testId);
      if (fullTest) {
        setEditTitle(fullTest.title || '');
        setEditSubject(fullTest.subject || '');
        setEditInstructions(fullTest.instructions || '');
        setEditHasTimeLimit(Boolean(fullTest.timeLimitMinutes));
        setEditTimeLimitMinutes(fullTest.timeLimitMinutes || 30);
        setEditQuestions(JSON.parse(JSON.stringify(fullTest.questions || [])));
      }
    } catch (e) {
      console.error('Failed to load test details:', e);
    } finally {
      setLoadingFullTest(false);
    }
  };

  const handleDeleteTest = async (testId: string) => {
    await apiService.deleteTest(testId);
    setTests(prev => prev.filter(t => t.id !== testId));
    setSelectedTestId(null);
    setSelectedSubmission(null);
    setViewMode('list');
  };

  // Question editing helpers inside "See the Test"
  const handleAddQuestion = (type: QuestionType) => {
    const newId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    if (type === 'mcq') {
      setEditQuestions(prev => [
        ...prev,
        {
          id: newId,
          type: 'mcq',
          questionText: '',
          marks: 2,
          options: [
            { id: `opt_${Date.now()}_1`, text: '' },
            { id: `opt_${Date.now()}_2`, text: '' },
            { id: `opt_${Date.now()}_3`, text: '' },
            { id: `opt_${Date.now()}_4`, text: '' },
          ],
          correctOptionIds: [`opt_${Date.now()}_1`],
          partialMarkingRule: 'half',
        },
      ]);
    } else if (type === 'true_false') {
      setEditQuestions(prev => [
        ...prev,
        {
          id: newId,
          type: 'true_false',
          questionText: '',
          marks: 2,
          correctBoolean: true,
        },
      ]);
    } else {
      setEditQuestions(prev => [
        ...prev,
        {
          id: newId,
          type: 'theory',
          questionText: '',
          marks: 5,
          modelAnswer: '',
        },
      ]);
    }
  };

  const handleRemoveQuestion = (qId: string) => {
    setEditQuestions(prev => prev.filter(q => q.id !== qId));
  };

  const handleUpdateQuestion = (qId: string, updater: (q: Question) => Question) => {
    setEditQuestions(prev => prev.map(q => (q.id === qId ? updater(q) : q)));
  };

  // Upload edited test as a brand-new project with a new link
  const handleUploadEditedTest = async () => {
    setEditError(null);
    if (!editTitle.trim()) {
      setEditError('Please enter a test title.');
      return;
    }
    if (editQuestions.length === 0) {
      setEditError('Please include at least one question.');
      return;
    }

    for (let i = 0; i < editQuestions.length; i++) {
      const q = editQuestions[i];
      if (!q.questionText.trim()) {
        setEditError(`Question #${i + 1} is missing its question text.`);
        return;
      }
      if (q.type === 'mcq') {
        const opts = q.options || [];
        if (opts.length < 2) {
          setEditError(`Question #${i + 1} (MCQ) needs at least 2 options.`);
          return;
        }
        if (!q.correctOptionIds || q.correctOptionIds.length === 0) {
          setEditError(`Please select at least one correct option for Question #${i + 1}.`);
          return;
        }
      }
    }

    setUploadingEditedTest(true);
    try {
      const payload = {
        title: editTitle.trim(),
        subject: editSubject.trim() || 'General',
        instructions: editInstructions.trim(),
        creatorName: user?.displayName || user?.username || 'Instructor',
        creatorUsername: userProfile?.username || user?.username,
        creatorUid: user?.uid,
        creatorEmail: user?.email,
        timeLimitMinutes: editHasTimeLimit ? Math.max(1, Number(editTimeLimitMinutes) || 30) : null,
        questions: editQuestions,
      };

      const created = await apiService.createTest(payload);
      setNewlyUploadedTest(created);
      if (onTestCreated) {
        onTestCreated(created);
      }
      fetchUserProjects();
    } catch (err: any) {
      setEditError(err.message || 'Failed to upload test.');
    } finally {
      setUploadingEditedTest(false);
    }
  };

  const selectedTest = tests.find(t => t.id === selectedTestId);

  return (
    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Unauthenticated overlay */}
      {!user && (
        <div
          onClick={() => openAuthModal('signin')}
          className="absolute inset-0 bg-white/75 backdrop-blur-[2px] rounded-3xl z-20 flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none transition-all hover:bg-white/70"
        >
          <div className="p-6 rounded-3xl bg-white/95 border border-slate-200 shadow-2xl max-w-sm w-full mx-auto flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 font-display">
                Sign In to View Projects
              </h3>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                Please sign in with your username and password to access your private projects.
              </p>
            </div>
            <div className="flex items-center gap-2.5 mt-2 w-full">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  openAuthModal('signin');
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  openAuthModal('get_started');
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <span>Get Started</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-to-home"
            onClick={() => {
              if (viewMode === 'see_test') {
                setViewMode('details');
              } else if (viewMode === 'details') {
                setSelectedTestId(null);
                setSelectedSubmission(null);
                setViewMode('list');
              } else {
                onBackToHome();
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>
              {viewMode === 'see_test'
                ? 'Back to Project Details'
                : viewMode === 'details'
                ? 'Back to Projects'
                : 'Home'}
            </span>
          </button>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display">
              {viewMode === 'see_test'
                ? 'See & Edit Test'
                : viewMode === 'details' && selectedTest
                ? selectedTest.title
                : 'Previous Projects'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {viewMode === 'see_test'
                ? 'Review or edit your test below. Click Upload Test to form a new link and save as another project.'
                : viewMode === 'details' && selectedTest
                ? `Subject: ${selectedTest.subject}`
                : 'Click on any project to view its test link, see/edit the test, or inspect student reports.'}
            </p>
          </div>
        </div>

        <button
          id="btn-make-another-test"
          onClick={onMakeNewTest}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Make a Test</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: PROJECTS LIST (ONLY TITLE & SUBJECT SHOWN)                  */}
      {/* =================================================================== */}
      {viewMode === 'list' && (
        <>
          {loadingTests ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Loading your projects...</p>
            </div>
          ) : tests.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 sm:p-16 text-center border border-slate-200 shadow-sm max-w-2xl mx-auto my-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-5 shadow-xs">
                <FolderOpen className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 font-display mb-2">
                No Previous Projects Yet
              </h2>
              <p className="text-slate-600 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                Your private workspace currently has no projects. Create a test to see it listed here.
              </p>
              <button
                onClick={onMakeNewTest}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Make Your First Test</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tests.map(test => (
                <div
                  key={test.id}
                  id={`project-card-${test.id}`}
                  onClick={() => handleOpenProjectDetails(test.id)}
                  className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 mb-2">
                      {test.subject || 'General'}
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-900 font-display group-hover:text-indigo-600 transition-colors truncate">
                      {test.title}
                    </h3>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-indigo-600 text-slate-400 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: PROJECT DETAILS (SEE THE TEST, DELETE TEST, LINK & REPORTS) */}
      {/* =================================================================== */}
      {viewMode === 'details' && selectedTest && (
        <div className="space-y-6">
          {/* Project Header & Action Controls */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-block text-xs font-bold px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 mb-2">
                  Subject: {selectedTest.subject}
                </span>
                <h2 className="text-2xl font-extrabold text-slate-900 font-display">
                  {selectedTest.title}
                </h2>
              </div>

              {/* Action Buttons: See the Test & Delete Test */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  id="btn-see-the-test"
                  onClick={() => handleOpenSeeTest(selectedTest.id)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-extrabold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>See the Test</span>
                </button>

                <button
                  type="button"
                  id="btn-delete-test"
                  onClick={() => handleDeleteTest(selectedTest.id)}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Test</span>
                </button>
              </div>
            </div>

            {/* Test Link Section (Behind See the Test option) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                Student Test Link
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="text"
                  readOnly
                  value={getStudentShareUrl(selectedTest.id, selectedTest)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-mono text-slate-800 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink(selectedTest)}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shrink-0 ${
                    copiedTestId === selectedTest.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {copiedTestId === selectedTest.id ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied Link</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Test Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Student Report Section (Behind Test Link) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 font-display">
                  Student Reports ({submissions.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click on any student name below to open their full report and download their test image.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!selectedSubmission && (
                  <button
                    type="button"
                    onClick={() => refreshSubmissions(false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    title="Sync latest student reports from all devices"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingSubmissions ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                )}

                {selectedSubmission && (
                  <button
                    type="button"
                    onClick={() => setSelectedSubmission(null)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Student List</span>
                  </button>
                )}
              </div>
            </div>

            {loadingSubmissions ? (
              <div className="p-10 text-center">
                <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Loading student reports...</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 rounded-2xl border border-slate-200/80">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="font-bold text-slate-800 text-sm">No Student Submissions Yet</h4>
                <p className="text-xs text-slate-500 mt-1">
                  When students complete this test using the link above, their names and marks will appear here.
                </p>
              </div>
            ) : !selectedSubmission ? (
              /* Student List: Shows ONLY Student Name & Marks */
              <div className="space-y-3">
                {submissions.map(sub => (
                  <div
                    key={sub.id}
                    id={`student-report-row-${sub.id}`}
                    onClick={() => setSelectedSubmission(sub)}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/30 transition-all cursor-pointer flex items-center justify-between gap-4 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold text-sm flex items-center justify-center font-display">
                        {sub.studentName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base">
                          {sub.studentName}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white font-extrabold text-sm font-display">
                        {sub.totalScore} / {sub.maxScore} Marks
                      </span>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Selected Student Full Report: Shows which question is right or wrong + Download button */
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 block">
                      Candidate Full Report
                    </span>
                    <h4 className="text-xl font-extrabold text-slate-900 font-display mt-0.5">
                      {selectedSubmission.studentName}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Marks: <strong className="text-slate-900">{selectedSubmission.totalScore} / {selectedSubmission.maxScore}</strong> ({selectedSubmission.percentage}% • Grade {selectedSubmission.grade})
                    </p>
                  </div>

                  <button
                    type="button"
                    id="btn-download-student-report-top"
                    onClick={() => downloadSubmissionAsImage(selectedSubmission)}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-extrabold text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>

                {/* Questions Right or Wrong Breakdown */}
                <div className="space-y-4">
                  {selectedSubmission.evaluations.map((ev, idx) => {
                    const isCorrect = ev.status === 'correct';
                    const isPartial = ev.status === 'partial';

                    return (
                      <div
                        key={ev.questionId || idx}
                        className={`p-5 rounded-2xl border-2 ${
                          isCorrect
                            ? 'bg-white border-emerald-200'
                            : isPartial
                            ? 'bg-white border-amber-200'
                            : 'bg-rose-50/30 border-rose-300'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase flex items-center gap-1 ${
                                isCorrect
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isPartial
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-600 text-white'
                              }`}
                            >
                              {isCorrect ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Right
                                </>
                              ) : isPartial ? (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5" /> Partial
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" /> Wrong
                                </>
                              )}
                            </span>
                            <span className="font-extrabold text-slate-900 text-sm">
                              Question {idx + 1}
                            </span>
                          </div>

                          <span className="text-xs font-extrabold text-slate-700">
                            {ev.marksAwarded} / {ev.maxMarks} Marks
                          </span>
                        </div>

                        <p className="text-sm font-bold text-slate-900 mb-3">
                          {ev.questionText}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div
                            className={`p-3 rounded-xl border ${
                              isCorrect
                                ? 'bg-emerald-50/60 border-emerald-200'
                                : isPartial
                                ? 'bg-amber-50/60 border-amber-200'
                                : 'bg-rose-100/70 border-rose-300'
                            }`}
                          >
                            <span className="font-extrabold uppercase text-slate-500 block mb-1">
                              Student's Answer:
                            </span>
                            <span className="font-bold text-slate-900 text-sm">
                              {ev.studentAnswerDisplay || '(No answer submitted)'}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                            <span className="font-extrabold uppercase text-emerald-800 block mb-1">
                              Correct Answer:
                            </span>
                            <span className="font-bold text-emerald-950 text-sm">
                              {ev.correctAnswerDisplay}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Download Button Behind Full Report */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedSubmission(null)}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Student List</span>
                  </button>

                  <button
                    type="button"
                    id="btn-download-student-report-bottom"
                    onClick={() => downloadSubmissionAsImage(selectedSubmission)}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-extrabold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Student Test Image</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 3: SEE THE TEST & EDIT -> UPLOAD AS NEW PROJECT WITH NEW LINK  */}
      {/* =================================================================== */}
      {viewMode === 'see_test' && selectedTest && (
        <div className="space-y-6">
          {newlyUploadedTest && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 sm:p-8 shadow-md space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 font-display">
                    New Test Uploaded & Added to Previous Projects!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600">
                    A brand-new test link has been generated and saved as a new project in your account.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-emerald-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="text"
                  readOnly
                  value={getStudentShareUrl(newlyUploadedTest.id, newlyUploadedTest)}
                  className="flex-1 px-3 py-2 text-xs sm:text-sm font-mono text-slate-800 bg-transparent outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink(newlyUploadedTest)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedTestId === newlyUploadedTest.id ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied New Link</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy New Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {loadingFullTest ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Loading full test paper...</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                  <Edit3 className="w-4 h-4" />
                  <span>Full Test View & Editor (Edit anything and click Upload Test)</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteTest(selectedTest.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete This Test</span>
                </button>
              </div>

              {editError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {editError}
                </div>
              )}

              {/* Basic Test Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Test Title *
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-indigo-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={e => setEditSubject(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={editInstructions}
                    onChange={e => setEditInstructions(e.target.value)}
                    placeholder="Instructions for students..."
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm text-slate-800 focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Time Limit (Minutes)
                  </label>
                  <div className="flex items-center gap-3 h-11">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editHasTimeLimit}
                        onChange={e => setEditHasTimeLimit(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span>Enable Timer</span>
                    </label>
                    {editHasTimeLimit && (
                      <input
                        type="number"
                        min={1}
                        value={editTimeLimitMinutes}
                        onChange={e => setEditTimeLimitMinutes(Number(e.target.value) || 1)}
                        className="w-28 h-11 px-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4 pt-2">
                <h3 className="text-base font-extrabold text-slate-900 font-display">
                  Test Questions ({editQuestions.length})
                </h3>

                {editQuestions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800">
                        Question #{qIdx + 1} • {q.type.toUpperCase()}
                      </span>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-600">Marks:</span>
                          <input
                            type="number"
                            min={1}
                            value={q.marks}
                            onChange={e =>
                              handleUpdateQuestion(q.id, item => ({
                                ...item,
                                marks: Math.max(1, Number(e.target.value) || 1),
                              }))
                            }
                            className="w-16 h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-center"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(q.id)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                          title="Remove Question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Question Text
                      </label>
                      <textarea
                        rows={2}
                        value={q.questionText}
                        onChange={e =>
                          handleUpdateQuestion(q.id, item => ({
                            ...item,
                            questionText: e.target.value,
                          }))
                        }
                        className="w-full p-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 outline-none focus:border-indigo-600"
                      />
                    </div>

                    {/* MCQ Options Editor */}
                    {q.type === 'mcq' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-600">
                          Options (Check the box to mark the correct option)
                        </label>
                        {(q.options || []).map((opt, oIdx) => {
                          const letter = String.fromCharCode(65 + oIdx);
                          const isChecked = (q.correctOptionIds || []).includes(opt.id);
                          return (
                            <div key={opt.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  handleUpdateQuestion(q.id, item => {
                                    const cur = item.correctOptionIds || [];
                                    const exists = cur.includes(opt.id);
                                    const next = exists
                                      ? cur.filter(id => id !== opt.id)
                                      : [...cur, opt.id];
                                    return { ...item, correctOptionIds: next };
                                  })
                                }
                                className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                              />
                              <span className="w-7 text-xs font-extrabold text-slate-700">
                                {letter}.
                              </span>
                              <input
                                type="text"
                                value={opt.text}
                                onChange={e =>
                                  handleUpdateQuestion(q.id, item => ({
                                    ...item,
                                    options: (item.options || []).map(o =>
                                      o.id === opt.id ? { ...o, text: e.target.value } : o
                                    ),
                                  }))
                                }
                                className={`flex-1 h-9 px-3 rounded-lg border text-xs font-medium ${
                                  isChecked
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                    : 'bg-white border-slate-300 text-slate-800'
                                }`}
                              />
                              {(q.options || []).length > 2 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateQuestion(q.id, item => ({
                                      ...item,
                                      options: (item.options || []).filter(o => o.id !== opt.id),
                                      correctOptionIds: (item.correctOptionIds || []).filter(
                                        id => id !== opt.id
                                      ),
                                    }))
                                  }
                                  className="text-xs text-rose-500 hover:text-rose-700 px-1.5 cursor-pointer"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQuestion(q.id, item => ({
                              ...item,
                              options: [
                                ...(item.options || []),
                                { id: `opt_${Date.now()}_${Math.random()}`, text: '' },
                              ],
                            }))
                          }
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 pt-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Option
                        </button>
                      </div>
                    )}

                    {/* True/False Editor */}
                    {q.type === 'true_false' && (
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-slate-600">Correct Answer:</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQuestion(q.id, item => ({
                              ...item,
                              correctBoolean: true,
                            }))
                          }
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                            q.correctBoolean === true
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          True
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateQuestion(q.id, item => ({
                              ...item,
                              correctBoolean: false,
                            }))
                          }
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                            q.correctBoolean === false
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          False
                        </button>
                      </div>
                    )}

                    {/* Theory Editor */}
                    {q.type === 'theory' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Model / Reference Answer
                        </label>
                        <textarea
                          rows={2}
                          value={q.modelAnswer || ''}
                          onChange={e =>
                            handleUpdateQuestion(q.id, item => ({
                              ...item,
                              modelAnswer: e.target.value,
                            }))
                          }
                          className="w-full p-3 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 outline-none focus:border-indigo-600"
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Question Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleAddQuestion('mcq')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add MCQ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuestion('true_false')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add True/False
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuestion('theory')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Theory Question
                  </button>
                </div>
              </div>

              {/* Bottom Upload Test Action Bar */}
              <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setViewMode('details')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Project Details</span>
                </button>

                <button
                  type="button"
                  id="btn-upload-edited-test"
                  disabled={uploadingEditedTest}
                  onClick={handleUploadEditedTest}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-extrabold text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {uploadingEditedTest
                      ? 'Uploading New Test...'
                      : 'Upload Test (Generate New Link & Add Project)'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
