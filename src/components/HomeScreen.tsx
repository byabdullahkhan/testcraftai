import React, { useState } from 'react';
import { 
  PlusCircle, 
  FolderOpen, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  BookOpen, 
  LogIn 
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
      let identifier = query;
      if (identifier.includes('/test/')) {
        identifier = identifier.split('/test/')[1].split(/[?#]/)[0];
      }
      onTakeTest(identifier);
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
      {/* Title & Introduction */}
      <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
        <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-indigo-600 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
          <span>Intelligent Examination & Assessment Studio</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight font-display mb-4">
          Create & Evaluate Tests Effortlessly
        </h1>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
          Design custom examination papers with multiple choice, true/false, and auto-evaluated conceptual theory questions.
        </p>

        {/* Authentication & Workspace Status Bar */}
        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 py-2 px-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs">
          {user ? (
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-500">Workspace connected:</span>
              <strong className="text-indigo-700 font-mono font-bold">@{user.username}</strong>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="text-emerald-700 font-semibold">Protected & Isolated</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-slate-600 font-medium">New instructor?</span>
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => openAuthModal('get_started')}
                className="font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Options Area */}
      {/* When user is not signed in, a transparent white layer sits above them, making everything underneath unclickable */}
      <div className="relative max-w-5xl mx-auto space-y-8">
        {!user && (
          <div 
            onClick={() => openAuthModal('signin')}
            className="absolute -inset-3 bg-white/75 backdrop-blur-[2px] rounded-3xl z-20 flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none transition-all hover:bg-white/70"
            title="Click to Sign In or Get Started"
          >
            <div className="p-6 rounded-3xl bg-white/95 border border-slate-200 shadow-2xl max-w-sm w-full mx-auto flex flex-col items-center gap-3">
              <Logo size="lg" />
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 font-display">
                  Sign In to Continue
                </h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Please sign in with your username or click Get Started to create your private instructor workspace.
                </p>
              </div>
              <div className="flex items-center gap-2.5 mt-2 w-full">
                <button
                  type="button"
                  onClick={(e) => {
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
                  onClick={(e) => {
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
                <span className="text-slate-300" aria-hidden="true">·</span>
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
                  <span>MCQs with dynamic options count & multi-select</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Auto-expanding theory questions with AI grading</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Instant student shareable link generation</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
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
                <span className="text-slate-300" aria-hidden="true">·</span>
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
                  <span>Real-time student submissions & marksheets</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>AI conceptual evaluation breakdown</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Private workspace isolated to your account</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
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

        {/* STUDENT ENTRANCE: Take a test on any device by title */}
        <div className="rounded-3xl p-6 sm:p-8 border border-indigo-200/90 bg-gradient-to-b from-indigo-50/50 via-white to-white shadow-2xs text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase text-indigo-700 mb-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Student Exam Portal</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-slate-500 font-normal">Works on mobile & desktop</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-display mb-2">
            Taking a Test? Enter Test Title
          </h3>
          <p className="text-slate-600 text-sm max-w-lg mx-auto mb-6">
            If you are a student or taking a test on your mobile phone, enter the test title or paste the test link below to start immediately.
          </p>

          <form onSubmit={handleStudentJoin} className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1 relative">
                <input
                  id="input-student-test-title"
                  type="text"
                  value={studentTestInput}
                  onChange={(e) => {
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
              <p className="text-xs text-rose-600 font-semibold mt-2 text-left">{inputError}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
