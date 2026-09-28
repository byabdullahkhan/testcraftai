import React, { useState } from 'react';
import {
  PlusCircle,
  FolderOpen,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  XCircle,
  BookOpen,
  LogIn,
  Clock,
  ShieldCheck,
  Share2,
  Download,
  Award,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

interface HomeScreenProps {
  onMakeTest: () => void;
  onViewProjects?: () => void;
  onTakeTest?: (testSlugOrTitle: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onMakeTest,
  onViewProjects,
  onTakeTest,
}) => {
  const { user, openAuthModal } = useAuth();
  const [studentTestInput, setStudentTestInput] = useState('');
  const [inputError, setInputError] = useState('');

  const handleStudentJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const query = studentTestInput.trim();
    if (!query) {
      setInputError('Please enter a test title or code');
      return;
    }
    setInputError('');
    if (onTakeTest) {
      onTakeTest(query);
    }
  };

  const handleActionClick = (action: () => void) => {
    if (!user) {
      openAuthModal('signin');
      return;
    }
    action();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Hero Title & Introduction */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
        <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-indigo-600 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
          <span>#1 Free AI Online Test Maker & Conceptual Exam Evaluator</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight font-display mb-4">
          Create & Grade Online Tests with AI Theory Evaluation
        </h1>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
          Design custom exams with <strong>MCQs (single & multi-select partial marking)</strong>,{' '}
          <strong>True/False</strong>, and <strong>AI-graded Theory questions</strong>. Share a short
          WhatsApp-ready link—students take tests with a live timer and no login required.
        </p>

        {/* Authentication & Workspace Status Bar */}
        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 py-2 px-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs">
          {user ? (
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-500">Workspace connected:</span>
              <strong className="text-indigo-700 font-mono font-bold">
                {user.email || `@${user.username}`}
              </strong>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-emerald-700 font-semibold">Protected & Isolated</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-slate-600 font-medium">Teacher or Instructor?</span>
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Sign In with Google or Email
              </button>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                onClick={() => openAuthModal('get_started')}
                className="font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Options Area */}
      <div className="relative max-w-5xl mx-auto space-y-8">
        {!user && (
          <div
            onClick={() => openAuthModal('signin')}
            className="absolute -inset-3 bg-white/75 backdrop-blur-[2px] rounded-3xl z-20 flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none transition-all hover:bg-white/70"
            title="Click to Sign In with Google or Email"
          >
            <div className="p-6 rounded-3xl bg-white/95 border border-slate-200 shadow-2xl max-w-sm w-full mx-auto flex flex-col items-center gap-3">
              <Logo size="lg" />
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 font-display">
                  Sign In to Create & Manage Tests
                </h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Continue with Google or your email address to access your private teacher workspace, generate short test links, and view live student scores.
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
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Two Options: Make a Test and Previous Projects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* OPTION 1: Make a Test */}
          <div
            id="btn-option-make-test"
            onClick={() => handleActionClick(onMakeTest)}
            className="group relative bg-white rounded-3xl p-7 sm:p-8 border border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-indigo-400 transition-all duration-300 flex flex-col justify-between cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-13 h-13 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
                  <PlusCircle className="w-6 h-6" />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2 text-xs font-bold tracking-wider uppercase text-indigo-600">
                <span>Creator Studio</span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-400 font-normal">Paper Generation</span>
              </div>

              <h2 className="text-2xl font-extrabold text-slate-900 font-display mb-2 group-hover:text-indigo-600 transition-colors">
                Make a Test
              </h2>

              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                Create a new examination from scratch or presets. Configure multiple options, single/dual correct answers, partial marks, time limits, and conceptual theory grading.
              </p>

              <div className="space-y-2.5 text-xs font-semibold text-slate-600 mb-6">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>MCQs with dynamic options count & multi-select partial marks</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Auto-expanding theory questions with instant AI grading</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Instant short student shareable link generation</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                handleActionClick(onMakeTest);
              }}
              className="w-full flex items-center justify-center gap-2 h-12 px-6 rounded-2xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 group-hover:shadow-lg transition-all cursor-pointer"
            >
              <span>Start Making Test</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* OPTION 2: Previous Projects */}
          <div
            id="btn-option-previous-projects"
            onClick={() => handleActionClick(() => onViewProjects && onViewProjects())}
            className="group relative bg-white rounded-3xl p-7 sm:p-8 border border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-indigo-400 transition-all duration-300 flex flex-col justify-between cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-13 h-13 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                  <FolderOpen className="w-6 h-6 text-indigo-600" />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2 text-xs font-bold tracking-wider uppercase text-slate-600">
                <span>Management</span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-400 font-normal">Repository</span>
              </div>

              <h2 className="text-2xl font-extrabold text-slate-900 font-display mb-2 group-hover:text-indigo-600 transition-colors">
                Previous Projects
              </h2>

              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                Access your published test papers, view real-time student submissions, analyze scoring reports, and copy shareable exam links.
              </p>

              <div className="space-y-2.5 text-xs font-semibold text-slate-600 mb-6">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Real-time student submissions & downloadable marksheets</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>AI conceptual evaluation breakdown per question</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Private workspace isolated to your account</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                handleActionClick(() => onViewProjects && onViewProjects());
              }}
              className="w-full flex items-center justify-center gap-2 h-12 px-6 rounded-2xl font-bold text-sm bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-200 hover:border-slate-300 transition-all cursor-pointer"
            >
              <span>View Projects</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* STUDENT ENTRANCE: Always interactive for students on any device */}
      <div className="max-w-5xl mx-auto mt-8 rounded-3xl p-6 sm:p-8 border border-indigo-200/90 bg-gradient-to-b from-indigo-50/50 via-white to-white shadow-2xs text-center">
        <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase text-indigo-700 mb-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <span>Student Exam Portal</span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span className="text-slate-500 font-normal">No Student Login Required</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-display mb-2">
          Taking a Test? Enter Test Title or Link
        </h2>
        <p className="text-slate-600 text-sm max-w-lg mx-auto mb-6">
          Students can open their teacher's test directly on any mobile phone, tablet, or computer—enter the test title or paste the shareable link below to begin.
        </p>

        <form onSubmit={handleStudentJoin} className="max-w-md mx-auto">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 relative">
              <input
                id="input-student-test-title"
                type="text"
                value={studentTestInput}
                onChange={e => {
                  setStudentTestInput(e.target.value);
                  setInputError('');
                }}
                placeholder="Enter test title or link"
                className="w-full h-13 px-4 sm:px-5 rounded-2xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none text-sm sm:text-base shadow-2xs transition-colors"
              />
            </div>

            <button
              id="btn-student-start-test"
              type="submit"
              className="h-13 px-6 rounded-2xl font-bold text-sm shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 hover:shadow-md transition-all shrink-0 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Start Test</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {inputError && (
            <p className="text-xs font-semibold text-rose-600 mt-2">{inputError}</p>
          )}
        </form>
      </div>

      {/* SEO & COMPETITIVE ADVANTAGES SECTION: Why TestCraft AI Beats Google Forms & Traditional Quiz Makers */}
      <section
        aria-labelledby="why-testcraft-heading"
        className="max-w-5xl mx-auto mt-14 sm:mt-16 pt-12 border-t border-slate-200/80"
      >
        <div className="text-center max-w-3xl mx-auto mb-10">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">
            Why Educators Choose TestCraft AI Over Google Forms & Quizizz
          </p>
          <h2
            id="why-testcraft-heading"
            className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display mb-3"
          >
            The Only Free Online Test Maker That Grades Both MCQs & Theory Answers Instantly
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Traditional form builders only auto-grade multiple-choice questions and force teachers to manually check written answers. TestCraft AI combines objective testing and conceptual AI theory evaluation in a single link.
          </p>
        </div>

        {/* 6 Core Plus Points Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          <article className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              1. Instant AI Conceptual Theory Grader
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Students write descriptive or subjective answers in their own words. Our AI compares their concept against your reference answer and awards accurate marks with feedback immediately.
            </p>
          </article>

          <article className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              2. Multi-Select MCQ Partial Marking
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Create single-choice or multiple-correct MCQs (2 to 6 options) and choose whether partially correct answers earn <strong>Half Marks</strong> or <strong>Zero Marks</strong>.
            </p>
          </article>

          <article className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Share2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              3. Zero Student Login (WhatsApp Ready)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Share a clean, short test link in your class WhatsApp group. Students never need to create an account or remember passwords—they enter their name and roll number and start.
            </p>
          </article>

          <article className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              4. Built-In Countdown Timer & Auto-Submit
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Unlike Google Forms which requires third-party plugins for timers, TestCraft AI includes a native countdown clock that automatically submits the paper when time expires.
            </p>
          </article>

          <article className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              5. Strict 1-Attempt Lock & Clean Exam Mode
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Each student is restricted to a single submission per test, and the student exam screen displays only your test title with zero platform branding or distractions.
            </p>
          </article>

          <article className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              6. 1-Click Downloadable Report Card Image
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Both teachers and students can download a high-resolution PNG report card showing total score, accuracy, time taken, and question-by-question AI explanations.
            </p>
          </article>
        </div>

        {/* Comparison Table */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 font-display">
              Feature Comparison: TestCraft AI vs. Other Online Test Makers
            </h3>
            <span className="text-xs text-indigo-600 font-semibold">
              100% Free for Teachers & Students
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/50">
                  <th className="py-3.5 px-4 sm:px-6 font-bold">Exam Feature</th>
                  <th className="py-3.5 px-4 font-extrabold text-indigo-700 bg-indigo-50/50">
                    TestCraft AI
                  </th>
                  <th className="py-3.5 px-4 font-semibold">Google Forms</th>
                  <th className="py-3.5 px-4 font-semibold">Quizizz / Kahoot</th>
                  <th className="py-3.5 px-4 font-semibold">Paid Exam Portals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-slate-700">
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-semibold">
                    Instant AI Conceptual Theory Grading
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-700 bg-indigo-50/30">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Yes (Automatic)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                      Manual only
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                      No
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">Paid Plans Only</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-semibold">
                    Multi-Select MCQ Partial Marking (Half / Zero)
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-700 bg-indigo-50/30">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Yes (Built-In)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                      No
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                      No
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">Paid Plans Only</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-semibold">
                    1-Attempt Lock Without Forcing Student Login
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-700 bg-indigo-50/30">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Yes
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">Requires Google Sign-In</td>
                  <td className="py-3 px-4 text-slate-500">No</td>
                  <td className="py-3 px-4 text-slate-500">Paid Plans Only</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-semibold">
                    Built-In Exam Timer with Auto-Submit
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-700 bg-indigo-50/30">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Yes
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">Requires Add-ons</td>
                  <td className="py-3 px-4 text-slate-500">Per-question timer</td>
                  <td className="py-3 px-4 text-slate-500">Yes</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 sm:px-6 font-semibold">
                    White-Label Student Exam View & PNG Report Card
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-700 bg-indigo-50/30">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Yes (Free)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">No</td>
                  <td className="py-3 px-4 text-slate-500">No</td>
                  <td className="py-3 px-4 text-slate-500">$29–$99 / month</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
