import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Clock, 
  HelpCircle, 
  CheckSquare, 
  ToggleLeft, 
  BookOpen, 
  Sparkles, 
  Share2, 
  Copy, 
  Check, 
  ArrowRight,
  AlertCircle,
  FileCheck,
  PlusCircle,
  Settings2,
  ExternalLink,
  ArrowLeft,
  FolderClock,
  Lock
} from 'lucide-react';
import { Question, QuestionType, Test } from '../types';
import { AutoExpandingTextarea } from './AutoExpandingTextarea';
import { getStudentShareUrl } from '../utils/urlHelper';
import { apiService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

interface TestCreatorProps {
  onTestCreated: (test: Test) => void;
  onGoToTest: (testId: string) => void;
  onBackToHome?: () => void;
  onGoToPreviousProjects?: () => void;
}

export const TestCreator: React.FC<TestCreatorProps> = ({
  onTestCreated,
  onGoToTest,
  onBackToHome,
  onGoToPreviousProjects,
}) => {
  const { user, userProfile, openAuthModal, sendAutomatedEmail } = useAuth();

  // Test basic metadata
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [creatorName, setCreatorName] = useState(user?.displayName || 'Prof. Instructor');
  const [instructions, setInstructions] = useState('Read each question attentively. Note questions with multiple correct choices. Submit before the timer expires.');
  const [hasTimeLimit, setHasTimeLimit] = useState(true);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(20);

  // Questions array
  const [questions, setQuestions] = useState<Question[]>([]);

  // UI helpers
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTest, setCreatedTest] = useState<Test | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick Mode helper (e.g. user requested "whole mcqs base or custom selection")
  const [creationMode, setCreationMode] = useState<'custom' | 'all_mcq' | 'mixed_preset'>('custom');

  // Calculate dynamic total marks
  const totalCalculatedMarks = questions.reduce((acc, q) => acc + (Number(q.marks) || 0), 0);

  // Question adding handlers
  const handleAddQuestion = (type: QuestionType) => {
    const qIndex = questions.length + 1;
    let newQ: Question;

    if (type === 'mcq') {
      newQ = {
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        type: 'mcq',
        questionText: `Multiple Choice Question ${qIndex}`,
        marks: 4,
        options: [
          { id: 'opt_1', text: 'Option 1' },
          { id: 'opt_2', text: 'Option 2' },
          { id: 'opt_3', text: 'Option 3' },
          { id: 'opt_4', text: 'Option 4' },
        ],
        correctOptionIds: ['opt_1'],
        partialMarkingRule: 'half',
      };
    } else if (type === 'true_false') {
      newQ = {
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        type: 'true_false',
        questionText: `Statement ${qIndex} is factually correct.`,
        marks: 3,
        correctBoolean: true,
      };
    } else {
      newQ = {
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        type: 'theory',
        questionText: `Explain the fundamental principles of Topic ${qIndex}.`,
        marks: 10,
        modelAnswer: 'Provide the key concepts, primary mechanism, and essential details that a complete answer should convey.',
      };
    }

    setQuestions([...questions, newQ]);
  };

  const handleApplyPreset = (preset: 'all_mcq' | 'mixed') => {
    if (preset === 'all_mcq') {
      setTitle(title || 'Comprehensive MCQ Assessment');
      setSubject(subject || 'General Studies');
      setQuestions([
        {
          id: `q_mcq_1`,
          type: 'mcq',
          questionText: 'Which data structure follows the Last-In First-Out (LIFO) principle?',
          marks: 4,
          options: [
            { id: 'opt_1', text: 'Queue' },
            { id: 'opt_2', text: 'Stack' },
            { id: 'opt_3', text: 'Binary Tree' },
            { id: 'opt_4', text: 'Hash Map' },
          ],
          correctOptionIds: ['opt_2'],
        },
        {
          id: `q_mcq_2`,
          type: 'mcq',
          questionText: 'Which of the following are interpreted or scripting languages? (Select 2 correct options)',
          marks: 6,
          options: [
            { id: 'opt_a', text: 'Python' },
            { id: 'opt_b', text: 'C++' },
            { id: 'opt_c', text: 'JavaScript' },
            { id: 'opt_d', text: 'Rust' },
          ],
          correctOptionIds: ['opt_a', 'opt_c'],
          partialMarkingRule: 'half',
        },
        {
          id: `q_mcq_3`,
          type: 'mcq',
          questionText: 'What is the speed of light in vacuum approximately?',
          marks: 5,
          options: [
            { id: 'opt_x', text: '300,000 km/s' },
            { id: 'opt_y', text: '150,000 km/s' },
            { id: 'opt_z', text: '3,000 km/s' },
          ],
          correctOptionIds: ['opt_x'],
        },
      ]);
    } else {
      // Mixed preset: 2 theory + 2 MCQs + 1 True/False as requested in prompt example
      setTitle(title || 'Mid-Term Mixed Theory & Objective Exam');
      setSubject(subject || 'Physics & Computing');
      setQuestions([
        {
          id: `q_mix_1`,
          type: 'mcq',
          questionText: 'Which layer of the OSI model handles end-to-end packet delivery?',
          marks: 4,
          options: [
            { id: 'o1', text: 'Physical Layer' },
            { id: 'o2', text: 'Transport Layer' },
            { id: 'o3', text: 'Application Layer' },
            { id: 'o4', text: 'Data Link Layer' },
          ],
          correctOptionIds: ['o2'],
        },
        {
          id: `q_mix_2`,
          type: 'mcq',
          questionText: 'Which of the following are greenhouse gases? (Select 2 correct options)',
          marks: 6,
          options: [
            { id: 'g1', text: 'Methane (CH4)' },
            { id: 'g2', text: 'Pure Oxygen (O2)' },
            { id: 'g3', text: 'Carbon Dioxide (CO2)' },
            { id: 'g4', text: 'Argon (Ar)' },
          ],
          correctOptionIds: ['g1', 'g3'],
          partialMarkingRule: 'half',
        },
        {
          id: `q_mix_3`,
          type: 'true_false',
          questionText: 'Energy can be created from nothing under standard thermodynamic laws.',
          marks: 3,
          correctBoolean: false,
        },
        {
          id: `q_mix_4`,
          type: 'theory',
          questionText: 'Describe Newton\'s Third Law of Motion and give a real-world example.',
          marks: 6,
          modelAnswer: 'Newton\'s Third Law states that whenever one object exerts a force on a second object, the second object exerts an equal and opposite force on the first (for every action, there is an equal and opposite reaction). A standard example is rocket propulsion: burning gas is pushed backward with high force, pushing the rocket forward with equal force.',
        },
        {
          id: `q_mix_5`,
          type: 'theory',
          questionText: 'Explain the difference between renewable and non-renewable resources, highlighting environmental impacts.',
          marks: 8,
          modelAnswer: 'Renewable resources naturally replenish over human timescales, such as solar, wind, and hydro power, producing minimal greenhouse emissions during operation. Non-renewable resources like coal, oil, and gas exist in finite supplies and emit carbon dioxide and pollutants when burned, contributing to climate change and environmental degradation.',
        },
      ]);
    }
  };

  const handleUpdateQuestion = (index: number, updated: Partial<Question>) => {
    const updatedList = [...questions];
    updatedList[index] = { ...updatedList[index], ...updated };
    setQuestions(updatedList);
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // MCQ Options Count setter (e.g. 2, 3, 4, 5, 6 options or custom)
  const handleSetOptionsCount = (qIndex: number, targetCount: number) => {
    const q = questions[qIndex];
    if (q.type !== 'mcq') return;

    const currentOptions = q.options ? [...q.options] : [];
    if (currentOptions.length < targetCount) {
      for (let i = currentOptions.length; i < targetCount; i++) {
        currentOptions.push({
          id: `opt_${Date.now()}_${i + 1}`,
          text: `Option ${i + 1}`,
        });
      }
    } else if (currentOptions.length > targetCount) {
      currentOptions.splice(targetCount);
    }

    // Filter correct ids that might no longer exist
    const validIds = currentOptions.map(o => o.id);
    const updatedCorrect = (q.correctOptionIds || []).filter(id => validIds.includes(id));

    handleUpdateQuestion(qIndex, {
      options: currentOptions,
      correctOptionIds: updatedCorrect.length > 0 ? updatedCorrect : [validIds[0] || ''],
    });
  };

  // Toggle correct option for MCQ
  const handleToggleCorrectOption = (qIndex: number, optionId: string, isMultiple: boolean) => {
    const q = questions[qIndex];
    if (q.type !== 'mcq') return;

    let updatedCorrect: string[];
    if (!isMultiple) {
      // Single correct option
      updatedCorrect = [optionId];
    } else {
      // Multiple correct options
      const current = q.correctOptionIds || [];
      if (current.includes(optionId)) {
        // Only remove if more than 1 remain
        updatedCorrect = current.filter(id => id !== optionId);
      } else {
        updatedCorrect = [...current, optionId];
      }
    }

    // Ensure at least 1 option is selected
    if (updatedCorrect.length === 0) {
      updatedCorrect = [optionId];
    }

    // Auto-update question text note if multiple are selected (as user requested: "so this has to mention in question that 2 are correct or select two")
    let newText = q.questionText;
    const correctCount = updatedCorrect.length;

    // Check if question text already has a "Select X" notice or we add/replace it cleanly
    if (correctCount > 1) {
      const notice = `(Select ${correctCount} correct options)`;
      if (!newText.includes('(Select') && !newText.includes('correct options')) {
        newText = `${newText.trim()} ${notice}`;
      } else {
        newText = newText.replace(/\(Select \d+ correct options?\)/gi, notice);
      }
    } else {
      // Remove any existing multi-select notice
      newText = newText.replace(/\(Select \d+ correct options?\)/gi, '').trim();
    }

    handleUpdateQuestion(qIndex, {
      correctOptionIds: updatedCorrect,
      questionText: newText,
    });
  };

  // Submit and Upload test
  const handlePublishTest = async () => {
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Please provide a Test Title.');
      return;
    }

    if (questions.length === 0) {
      setErrorMessage('Please add at least one question before publishing the test.');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setErrorMessage(`Question ${i + 1} is missing question text.`);
        return;
      }
      if (q.type === 'mcq') {
        if (!q.options || q.options.length < 2) {
          setErrorMessage(`Question ${i + 1} (MCQ) must have at least 2 options.`);
          return;
        }
        if (!q.correctOptionIds || q.correctOptionIds.length === 0) {
          setErrorMessage(`Question ${i + 1} (MCQ) must have at least one correct option selected.`);
          return;
        }
      }
      if (q.type === 'theory' && (!q.modelAnswer || !q.modelAnswer.trim())) {
        setErrorMessage(`Question ${i + 1} (Theory) must have a teacher model/reference answer for AI conceptual analysis.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        subject: subject.trim() || 'General Subject',
        instructions: instructions.trim(),
        creatorName: creatorName.trim() || user?.displayName || user?.username || 'Instructor',
        creatorUsername: userProfile?.username || user?.username || undefined,
        creatorUid: user?.uid,
        creatorEmail: user?.email,
        timeLimitMinutes: hasTimeLimit ? Math.max(1, timeLimitMinutes) : null,
        questions,
      };

      const created = await apiService.createTest(payload);
      setCreatedTest(created);
      onTestCreated(created);

      // Automated email notification to the creator's Google email
      if (user?.email) {
        const shareLink = getStudentShareUrl(created.id, created);
        sendAutomatedEmail({
          recipientEmail: user.email,
          recipientUid: user.uid,
          subject: `Test Published: ${created.title} (${created.subject})`,
          type: 'test_published',
          bodyText: `Hello ${user.displayName || 'Instructor'},\n\nYour test "${created.title}" is now published and active!\n\n• Subject: ${created.subject}\n• Total Questions: ${created.questions.length}\n• Total Marks: ${created.totalMarks}\n• Duration: ${created.timeLimitMinutes ? `${created.timeLimitMinutes} minutes` : 'Untimed'}\n\nCandidate Share Link:\n${shareLink}\n\nCandidate submissions will be evaluated automatically, and performance reports will be dispatched directly to this email.`,
          meta: {
            testId: created.id,
            testTitle: created.title
          }
        }).catch(console.error);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error publishing test.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getShareableUrl = (testId: string) => {
    return getStudentShareUrl(testId, createdTest || undefined);
  };

  const handleCopyLink = (testId: string) => {
    navigator.clipboard.writeText(getShareableUrl(testId));
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Guard: if user is not signed in, show Sign In screen
  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl">
          <div className="flex justify-center mb-5">
            <Logo size="lg" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200 mb-3">
            Authentication Required
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display mb-2">
            Sign In to Make Tests
          </h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            Please sign in with your username or click Get Started to design and upload test papers.
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Sign In or Get Started
            </button>
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="w-full h-11 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              >
                Return to Home
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If test is successfully published, display clear share modal
  if (createdTest) {
    const shareUrl = getShareableUrl(createdTest.id);

    return (
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckSquare className="w-8 h-8" />
          </div>

          <h2 className="text-3xl font-extrabold text-slate-900 font-display mb-2">
            Test Uploaded Successfully!
          </h2>
          <p className="text-slate-600 max-w-lg mx-auto mb-8 text-base">
            Your test is now live. Share the unique link below with your students. Each student can take this test once and their answers will be automatically evaluated.
          </p>

          {/* Test Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left mb-8 max-w-xl mx-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Test Overview</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                /test/{createdTest.slug || createdTest.id}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500 block text-xs">Title</span>
                <span className="font-bold text-slate-900 text-base">{createdTest.title}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Subject</span>
                <span className="font-medium text-slate-800">{createdTest.subject}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Total Questions</span>
                <span className="font-bold text-slate-900">{createdTest.questions.length} Questions</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Total Marks</span>
                <span className="font-bold text-indigo-600">{createdTest.totalMarks} Marks</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Time Limit</span>
                <span className="font-medium text-slate-800">
                  {createdTest.timeLimitMinutes ? `${createdTest.timeLimitMinutes} Minutes` : 'No time limit'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">AI Theory Grader</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Active
                </span>
              </div>
            </div>
          </div>

          {/* Shareable Link Box */}
          <div className="max-w-xl mx-auto mb-8">
            <label className="block text-left text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Test Link (Copy & Share with Students)
            </label>
            <div className="flex items-center gap-2 bg-white border-2 border-indigo-200 rounded-2xl p-2 shadow-sm">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 text-sm text-slate-800 font-mono bg-transparent outline-none truncate select-all"
              />
              <button
                id="btn-copy-test-link"
                onClick={() => handleCopyLink(createdTest.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm cursor-pointer shrink-0 ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2.5 text-left">
              Share this single link with your students. Anyone with this link can open and attempt the test on any device (phone, tablet, or PC).
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              id="btn-open-as-student"
              onClick={() => onGoToTest(createdTest.id)}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-md cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              Preview Test
            </button>

            {onGoToPreviousProjects && (
              <button
                id="btn-view-previous-projects"
                onClick={onGoToPreviousProjects}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20"
              >
                <FolderClock className="w-4 h-4" />
                Go to Previous Projects
              </button>
            )}

            {onBackToHome && (
              <button
                id="btn-back-home-success"
                onClick={onBackToHome}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Home
              </button>
            )}

            <button
              id="btn-create-another-test"
              onClick={() => {
                setCreatedTest(null);
                setQuestions([]);
                setTitle('');
              }}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Create Another Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pt-8 pb-36 px-4 sm:px-6 lg:px-8">
      {/* Top Header & Intro */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3">
              {onBackToHome && (
                <button
                  id="btn-creator-back-home"
                  onClick={onBackToHome}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  Home
                </button>
              )}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-display">
                Make a New Test
              </h1>
            </div>
            <p className="text-slate-600 text-xs sm:text-sm mt-1 sm:ml-0.5">
              Create customized exams with MCQs, True/False, and AI-evaluated theory questions.
            </p>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 text-xs font-semibold">
            <span className="text-slate-500 pl-2 pr-1 font-medium">Quick Start:</span>
            <button
              id="btn-preset-all-mcq"
              onClick={() => handleApplyPreset('all_mcq')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
              Whole MCQs
            </button>
            <button
              id="btn-preset-mixed"
              onClick={() => handleApplyPreset('mixed')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
              Custom Mix (MCQ + Theory)
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 mb-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Test General Settings Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-8">
        <h2 className="text-lg font-bold text-slate-900 font-display mb-4 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-indigo-600" />
          Test Details & Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Test Title *
            </label>
            <input
              id="input-test-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Physics Chapter 4 Quiz, Computer Science Midterm"
              className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none text-slate-800 text-sm font-medium transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Subject / Course
            </label>
            <input
              id="input-test-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Science, Mathematics, History, English"
              className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none text-slate-800 text-sm font-medium transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Teacher / Instructor Name
              </label>
              {userProfile?.username && (
                <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  @{userProfile.username.replace(/^@/, '')}
                </span>
              )}
            </div>
            <input
              id="input-test-creator"
              type="text"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="e.g. Prof. Anderson"
              className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none text-slate-800 text-sm font-medium transition-all"
            />
          </div>

          {/* Time Limit Setting */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Test Duration / Timer
            </label>
            <div className="w-full flex items-center gap-3">
              <button
                type="button"
                id="btn-toggle-timelimit"
                onClick={() => setHasTimeLimit(!hasTimeLimit)}
                className={`h-12 px-4 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  hasTimeLimit
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-4 h-4" aria-hidden="true" />
                {hasTimeLimit ? 'Timed Test' : 'No Time Limit'}
              </button>

              {hasTimeLimit ? (
                <div className="flex-1 flex items-center justify-between h-12 px-3.5 rounded-xl border border-slate-300 bg-white focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
                  <input
                    id="input-time-limit"
                    type="number"
                    min="1"
                    max="300"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                    aria-label="Test duration in minutes"
                    className="w-full h-full bg-transparent outline-none text-sm font-bold text-slate-800"
                  />
                  <span className="text-xs font-medium text-slate-500 pl-2 shrink-0">Minutes</span>
                </div>
              ) : (
                <div className="flex-1 h-12 px-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center text-xs text-slate-400">
                  <span>Untimed examination</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            Instructions for Students
          </label>
          <textarea
            id="input-test-instructions"
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Important guidelines for students before taking the test..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none text-slate-800 text-sm transition-all resize-none"
          />
        </div>
      </div>

      {/* Questions Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold text-slate-900 font-display">
              Questions ({questions.length})
            </h2>
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/80">
              <span>Total:</span>
              <span className="font-mono">{totalCalculatedMarks} Marks</span>
            </div>
          </div>

          <span className="text-xs text-slate-500">
            {questions.length === 0
              ? 'Add your first question to activate test upload'
              : 'Add as many questions as you need'}
          </span>
        </div>

        {/* Empty state */}
        {questions.length === 0 && (
          <div className="bg-white rounded-3xl p-10 border-2 border-dashed border-slate-300 text-center mb-6">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileCheck className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No Questions Added Yet</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
              Choose a question type below to begin. You can mix MCQs, True/False, and Theory questions in any combination.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                id="btn-add-initial-mcq"
                type="button"
                onClick={() => handleAddQuestion('mcq')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-indigo-700 border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/50 shadow-2xs transition-all cursor-pointer"
              >
                <CheckSquare className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                <span>+ Multiple Choice (MCQ)</span>
              </button>
              <button
                id="btn-add-initial-tf"
                type="button"
                onClick={() => handleAddQuestion('true_false')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-emerald-700 border-2 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50/50 shadow-2xs transition-all cursor-pointer"
              >
                <ToggleLeft className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>+ True / False</span>
              </button>
              <button
                id="btn-add-initial-theory"
                type="button"
                onClick={() => handleAddQuestion('theory')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-purple-700 border-2 border-purple-200 hover:border-purple-500 hover:bg-purple-50/50 shadow-2xs transition-all cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-purple-600" aria-hidden="true" />
                <span>+ Theory (AI Graded)</span>
              </button>
            </div>
          </div>
        )}

        {/* Questions list */}
        <div className="space-y-6">
          {questions.map((question, qIndex) => {
            const isMcq = question.type === 'mcq';
            const isTf = question.type === 'true_false';
            const isTheory = question.type === 'theory';

            const correctCount = (question.correctOptionIds || []).length;
            const isMultipleCorrect = isMcq && correctCount > 1;

            return (
              <div
                key={question.id}
                id={`card-question-${qIndex + 1}`}
                className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm transition-all hover:border-slate-300"
              >
                {/* Question Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-extrabold font-display">
                      {qIndex + 1}
                    </span>

                    {/* Question Type Badge */}
                    {isMcq && (
                      <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <CheckSquare className="w-3.5 h-3.5" /> Multiple Choice (MCQ)
                      </span>
                    )}
                    {isTf && (
                      <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ToggleLeft className="w-3.5 h-3.5" /> True / False
                      </span>
                    )}
                    {isTheory && (
                      <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                        <BookOpen className="w-3.5 h-3.5" /> Theory (AI Evaluated)
                      </span>
                    )}

                    {isMultipleCorrect && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                        ★ {correctCount} Correct Options
                      </span>
                    )}
                  </div>

                  {/* Marks input & Delete */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Marks:</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={question.marks}
                        onChange={(e) => handleUpdateQuestion(qIndex, { marks: Math.max(1, Number(e.target.value)) })}
                        className="w-16 px-2.5 py-1 rounded-lg border border-slate-300 font-bold text-sm text-center outline-none focus:border-indigo-600"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(qIndex)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Question Statement
                  </label>
                  <input
                    type="text"
                    value={question.questionText}
                    onChange={(e) => handleUpdateQuestion(qIndex, { questionText: e.target.value })}
                    placeholder="Enter question text here..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none text-slate-800 text-sm font-medium transition-all"
                  />
                </div>

                {/* ----------------- MCQ Specific Controls ----------------- */}
                {isMcq && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    {/* Options count selector */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-600">Total Options:</span>
                        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                          {[2, 3, 4, 5, 6].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleSetOptionsCount(qIndex, num)}
                              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                                (question.options || []).length === num
                                  ? 'bg-white text-indigo-600 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSetOptionsCount(qIndex, (question.options || []).length + 1)}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        + Add Custom Option
                      </button>
                    </div>

                    {/* Notice for correct answer configuration */}
                    <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Click the checkmark next to an option to mark it as correct. Pick 1, 2, or more!</span>
                      </div>

                      {/* Multiple correct partial marking setting */}
                      {isMultipleCorrect && (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">If 1 is correct & 1 is wrong:</span>
                          <select
                            value={question.partialMarkingRule || 'half'}
                            onChange={(e) => handleUpdateQuestion(qIndex, { partialMarkingRule: e.target.value as any })}
                            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                          >
                            <option value="half">Award Half Marks (50%)</option>
                            <option value="zero">Award 0 Marks (No credit)</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Option items list */}
                    <div className="space-y-2.5">
                      {(question.options || []).map((opt, optIndex) => {
                        const isCorrect = (question.correctOptionIds || []).includes(opt.id);

                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                              isCorrect
                                ? 'bg-emerald-50/70 border-emerald-300'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            {/* Toggle Correct Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleCorrectOption(qIndex, opt.id, true)}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'border-2 border-slate-300 text-transparent hover:border-emerald-400'
                              }`}
                              title={isCorrect ? 'Correct Option' : 'Click to set as correct'}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>

                            <span className="text-xs font-bold text-slate-400 uppercase w-5">
                              {String.fromCharCode(65 + optIndex)}.
                            </span>

                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => {
                                const newOpts = [...(question.options || [])];
                                newOpts[optIndex] = { ...newOpts[optIndex], text: e.target.value };
                                handleUpdateQuestion(qIndex, { options: newOpts });
                              }}
                              placeholder={`Option ${optIndex + 1} text`}
                              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-indigo-600"
                            />

                            {isCorrect && (
                              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider px-2 py-0.5 bg-emerald-100 rounded-md">
                                Correct Answer
                              </span>
                            )}

                            {(question.options || []).length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const filtered = (question.options || []).filter((_, i) => i !== optIndex);
                                  handleUpdateQuestion(qIndex, { options: filtered });
                                }}
                                className="text-slate-400 hover:text-rose-500 p-1"
                                title="Remove option"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ----------------- True/False Specific Controls ----------------- */}
                {isTf && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Select Correct Answer:
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuestion(qIndex, { correctBoolean: true })}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                          question.correctBoolean === true
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Check className="w-4 h-4" /> True
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateQuestion(qIndex, { correctBoolean: false })}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                          question.correctBoolean === false
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Check className="w-4 h-4" /> False
                      </button>
                    </div>
                  </div>
                )}

                {/* ----------------- Theory Specific Controls ----------------- */}
                {isTheory && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Teacher's Model / Reference Answer (Concept & Rubric)
                      </label>
                      <span className="text-xs font-semibold text-purple-700 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> Evaluated conceptually by Gemini AI
                      </span>
                    </div>

                    <AutoExpandingTextarea
                      value={question.modelAnswer || ''}
                      onChange={(val) => handleUpdateQuestion(qIndex, { modelAnswer: val })}
                      placeholder="Enter the core concepts, principles, and key facts. The AI will evaluate students conceptually without requiring identical wording..."
                      minRows={3}
                    />

                    <p className="text-xs text-slate-500 mt-2">
                      Tip: Students will not be penalized for using different synonyms or phrasings as long as the underlying concept matches this model answer.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Question Selector Buttons - only shown when questions already exist */}
        {questions.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-700 mr-1">
              Add another question:
            </span>

            <button
              type="button"
              id="btn-add-mcq"
              onClick={() => handleAddQuestion('mcq')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-indigo-700 border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/50 shadow-2xs transition-all cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              <span>+ Multiple Choice (MCQ)</span>
            </button>

            <button
              type="button"
              id="btn-add-tf"
              onClick={() => handleAddQuestion('true_false')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-emerald-700 border-2 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50/50 shadow-2xs transition-all cursor-pointer"
            >
              <ToggleLeft className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <span>+ True / False</span>
            </button>

            <button
              type="button"
              id="btn-add-theory"
              onClick={() => handleAddQuestion('theory')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-purple-700 border-2 border-purple-200 hover:border-purple-500 hover:bg-purple-50/50 shadow-2xs transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-purple-600" aria-hidden="true" />
              <span>+ Theory (AI Graded)</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar: Upload / Publish Test */}
      <div className="sticky bottom-4 z-30 bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-lg font-display">
              {questions.length} Question{questions.length === 1 ? '' : 's'}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-indigo-400 font-bold">
              {totalCalculatedMarks} Total Marks
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-300 text-xs">
              {hasTimeLimit ? `${timeLimitMinutes} mins timer` : 'Untimed'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {questions.length === 0
              ? 'Add at least 1 question to enable uploading test'
              : 'Ready to publish and generate student link'}
          </p>
        </div>

        <button
          id="btn-upload-test"
          type="button"
          disabled={questions.length === 0 || isSubmitting}
          onClick={handlePublishTest}
          className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${
            questions.length === 0 || isSubmitting
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.02] shadow-indigo-500/25'
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Uploading Test...
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              Upload & Generate Test Link
            </>
          )}
        </button>
      </div>
    </div>
  );
};
