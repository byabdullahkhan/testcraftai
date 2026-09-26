import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Lock, 
  Send, 
  User, 
  FileText, 
  Check, 
  HelpCircle,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  LogIn
} from 'lucide-react';
import { Test, StudentAnswer, TestSubmission } from '../types';
import { AutoExpandingTextarea } from './AutoExpandingTextarea';
import { apiService } from '../services/apiService';

interface TestTakerProps {
  testId: string;
  onSubmissionComplete: (submission: TestSubmission) => void;
  onViewPriorResult?: (submissionId: string) => void;
}

export const TestTaker: React.FC<TestTakerProps> = ({
  testId,
  onSubmissionComplete,
  onViewPriorResult,
}) => {
  // Test data loaded from server
  const [testData, setTestData] = useState<any | null>(null);
  const [loadingTest, setLoadingTest] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Student Details Screen
  const [hasStarted, setHasStarted] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [checkingStudent, setCheckingStudent] = useState(false);
  const [alreadyAttemptedError, setAlreadyAttemptedError] = useState<{
    hasAttempted: boolean;
    submissionId: string;
    submittedAt: string;
  } | null>(null);

  // Active Test State
  const [answers, setAnswers] = useState<Map<string, StudentAnswer>>(new Map());
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

  // Fetch sanitized test info
  useEffect(() => {
    let isMounted = true;
    setLoadingTest(true);
    setLoadError(null);

    const loadTest = async () => {
      try {
        const test = await apiService.getTestForTaking(testId);
        if (isMounted) {
          setTestData(test);
          if (test?.title) {
            document.title = test.title;
          }
          setLoadingTest(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setLoadError(err.message || 'Failed to load test');
          setLoadingTest(false);
        }
      }
    };

    loadTest();

    return () => {
      isMounted = false;
    };
  }, [testId]);

  // Handle student start & single-attempt verification
  const handleStartTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!studentName.trim()) {
      setFormError('Please enter your name to start the test.');
      return;
    }

    setCheckingStudent(true);
    setAlreadyAttemptedError(null);

    try {
      const targetId = testData?.id || testId;
      const checkData = await apiService.checkStudentAttempt(
        targetId,
        studentName.trim(),
        studentId.trim()
      );

      if (checkData.hasAttempted) {
        setAlreadyAttemptedError({
          hasAttempted: true,
          submissionId: checkData.submissionId || '',
          submittedAt: checkData.submittedAt || new Date().toISOString(),
        });
        setCheckingStudent(false);
        return;
      }

      // Initialize answers map
      const initialMap = new Map<string, StudentAnswer>();
      testData.questions.forEach((q: any) => {
        initialMap.set(q.id, {
          questionId: q.id,
          selectedOptionIds: [],
          selectedBoolean: null,
          theoryAnswer: '',
          isLocked: false,
        });
      });

      setAnswers(initialMap);
      setHasStarted(true);
      setStartTime(Date.now());

      if (testData.timeLimitMinutes) {
        setSecondsRemaining(testData.timeLimitMinutes * 60);
      }
    } catch (err: any) {
      console.error(err);
      setLoadError('Error verifying student attempt.');
    } finally {
      setCheckingStudent(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!hasStarted || secondsRemaining === null) return;

    if (secondsRemaining <= 0) {
      // Time is up -> automatically trigger submission
      triggerAutoSubmit();
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasStarted, secondsRemaining]);

  // Answer selection handlers
  const handleSelectOption = (questionId: string, optionId: string, requiredCount: number) => {
    const current = answers.get(questionId);
    if (!current || current.isLocked) return;

    let selected = current.selectedOptionIds ? [...current.selectedOptionIds] : [];

    if (requiredCount === 1) {
      // Single choice MCQ: select and lock immediately
      selected = [optionId];
      const updated: StudentAnswer = {
        ...current,
        selectedOptionIds: selected,
        isLocked: true, // Immediately unclickable and locked!
      };
      setAnswers(new Map(answers.set(questionId, updated)));
    } else {
      // Multiple choice MCQ (e.g. 2 options):
      if (selected.includes(optionId)) {
        // Option already clicked
        return;
      }

      selected.push(optionId);
      const isNowComplete = selected.length >= requiredCount;

      const updated: StudentAnswer = {
        ...current,
        selectedOptionIds: selected,
        isLocked: isNowComplete, // Lock when target count (e.g. 2) is reached
      };
      setAnswers(new Map(answers.set(questionId, updated)));
    }
  };

  const handleSelectTrueFalse = (questionId: string, value: boolean) => {
    const current = answers.get(questionId);
    if (!current || current.isLocked) return;

    // Immediately locks as requested by user
    const updated: StudentAnswer = {
      ...current,
      selectedBoolean: value,
      isLocked: true,
    };
    setAnswers(new Map(answers.set(questionId, updated)));
  };

  const handleUpdateTheory = (questionId: string, text: string) => {
    const current = answers.get(questionId);
    if (!current) return;

    const updated: StudentAnswer = {
      ...current,
      theoryAnswer: text,
    };
    setAnswers(new Map(answers.set(questionId, updated)));
  };

  // Submit Test
  const handleSubmitTest = async (isTimeout = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const timeSpent = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;

    const answersList = Array.from(answers.values());

    try {
      const targetId = testData?.id || testId;
      const submission = await apiService.submitTest(targetId, {
        studentName: studentName.trim(),
        studentIdentifier: studentId.trim(),
        timeSpentSeconds: timeSpent,
        answers: answersList,
      });

      onSubmissionComplete(submission);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || 'Submission error. Please try again.');
      setIsSubmitting(false);
    }
  };

  const triggerAutoSubmit = () => {
    handleSubmitTest(true);
  };

  // Format seconds into MM:SS
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loadingTest) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 font-display">Loading Test Paper...</h3>
        <p className="text-slate-500 text-sm mt-1">Preparing question sheets and timer settings.</p>
      </div>
    );
  }

  if (loadError || !testData) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 font-display mb-2">Unable to Open Test</h3>
        <p className="text-slate-600 text-sm mb-6">{loadError || 'The requested test was not found.'}</p>
      </div>
    );
  }

  // SCREEN 1: Enter Student Details & Confirmation
  if (!hasStarted) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">
              <FileText className="w-3.5 h-3.5" />
              <span>{testData.subject || 'Academic Assessment'}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 font-display mt-1 mb-2">
              {testData.title}
            </h1>
            <p className="text-slate-600 text-sm max-w-lg mx-auto leading-relaxed">
              {testData.instructions || 'Answer all questions carefully within the allocated duration.'}
            </p>
          </div>

          {/* Test Parameters Badge Grid */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-8 text-center">
            <div>
              <span className="text-xs text-slate-500 font-medium block">Questions</span>
              <span className="text-base font-bold text-slate-900 font-display">{testData.questions.length}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Total Marks</span>
              <span className="text-base font-bold text-indigo-600 font-display">{testData.totalMarks} Pts</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Duration</span>
              <span className="text-base font-bold text-slate-900 font-display">
                {testData.timeLimitMinutes ? `${testData.timeLimitMinutes} Mins` : 'Untimed'}
              </span>
            </div>
          </div>

          {/* Alert if student already attempted */}
          {alreadyAttemptedError && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              <div className="flex items-center gap-2 font-bold mb-1">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                Single Attempt Policy Enforced
              </div>
              <p className="text-xs text-amber-800 mb-3">
                A submission under the name <strong>"{studentName}"</strong> already exists for this test. Every individual can only perform this test one time.
              </p>
              {onViewPriorResult && alreadyAttemptedError.submissionId && (
                <button
                  type="button"
                  onClick={() => onViewPriorResult(alreadyAttemptedError.submissionId)}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-colors shadow-xs"
                >
                  View Your Submitted Result Report
                </button>
              )}
            </div>
          )}

          {formError && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {formError}
            </div>
          )}

          {/* Student Entry Form */}
          <form onSubmit={handleStartTest} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Your Name *
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  id="input-student-name"
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none text-slate-900 font-medium text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Roll No (Optional)
              </label>
              <input
                id="input-student-id"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Enter your roll number (optional)"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none text-slate-900 font-medium text-sm transition-all"
              />
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-indigo-600" />
                Important Examination Rules:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-indigo-800">
                <li>When you click an option, it turns green and locks in as your submitted answer.</li>
                <li>Answers cannot be modified once chosen to preserve test integrity.</li>
                <li>For multi-correct MCQs (e.g. 2 correct), select all required options to lock.</li>
                <li>If timed, test will automatically submit when the countdown reaches zero.</li>
              </ul>
            </div>

            <button
              id="btn-start-test"
              type="submit"
              disabled={checkingStudent}
              className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.01] cursor-pointer"
            >
              {checkingStudent ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting test...
                </>
              ) : (
                <>
                  Start Test Now
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // SCREEN 2: Active Test Taking Screen
  const answersList = Array.from(answers.values()) as StudentAnswer[];
  const answeredCount = answersList.filter(
    (a: StudentAnswer) => 
      (a.selectedOptionIds && a.selectedOptionIds.length > 0) || 
      (a.selectedBoolean !== null && a.selectedBoolean !== undefined) || 
      (a.theoryAnswer && a.theoryAnswer.trim().length > 0)
  ).length;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Sticky Test Header Bar */}
      <div className="sticky top-4 z-30 bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-md mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
            Test in Progress
          </span>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 font-display truncate max-w-sm sm:max-w-md">
            {testData.title}
          </h2>
          <span className="text-xs text-slate-500">
            Candidate: <strong className="text-slate-800">{studentName}</strong>
            {studentId.trim() ? (
              <> (Roll No: <strong className="text-slate-800">{studentId}</strong>)</>
            ) : null}{' '}
            • Answered {answeredCount} of {testData.questions.length}
          </span>
        </div>

        {/* Live Countdown Timer */}
        {secondsRemaining !== null && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-base font-extrabold border transition-all ${
              secondsRemaining < 120
                ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                : 'bg-slate-900 border-slate-900 text-white'
            }`}
          >
            <Clock className={`w-4 h-4 ${secondsRemaining < 120 ? 'text-rose-600' : 'text-indigo-400'}`} />
            <span>{formatTimer(secondsRemaining)}</span>
          </div>
        )}
      </div>

      {submitError && (
        <div className="p-4 mb-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Questions Form */}
      <div className="space-y-8">
        {testData.questions.map((question: any, qIndex: number) => {
          const studentAns = answers.get(question.id) || {
            questionId: question.id,
            selectedOptionIds: [],
            selectedBoolean: null,
            theoryAnswer: '',
            isLocked: false,
          };

          const isMcq = question.type === 'mcq';
          const isTf = question.type === 'true_false';
          const isTheory = question.type === 'theory';

          const requiredCount = question.correctCount || 1;
          const isMultiple = isMcq && requiredCount > 1;

          return (
            <div
              key={question.id}
              id={`test-question-${qIndex + 1}`}
              className={`bg-white rounded-2xl p-6 sm:p-8 border transition-all ${
                studentAns.isLocked
                  ? 'border-emerald-200 shadow-sm bg-slate-50/40'
                  : 'border-slate-200 shadow-sm hover:border-slate-300'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-extrabold font-display">
                    {qIndex + 1}
                  </span>

                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                    {question.marks} Mark{question.marks === 1 ? '' : 's'}
                  </span>

                  {isMultiple && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                      ★ Select {requiredCount} correct options
                    </span>
                  )}
                </div>

                {/* Locked Indicator as requested */}
                {studentAns.isLocked && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
                    <Lock className="w-3.5 h-3.5" /> Answer Locked
                  </span>
                )}
              </div>

              {/* Question Statement */}
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-6 leading-relaxed">
                {question.questionText}
              </h3>

              {/* ---------------- MCQ Options ---------------- */}
              {isMcq && (
                <div className="space-y-3">
                  {(question.options || []).map((opt: any, optIndex: number) => {
                    const isSelected = (studentAns.selectedOptionIds || []).includes(opt.id);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        id={`btn-q${qIndex + 1}-opt${optIndex + 1}`}
                        disabled={studentAns.isLocked}
                        onClick={() => handleSelectOption(question.id, opt.id, requiredCount)}
                        className={`w-full text-left p-4 rounded-xl border flex items-center gap-3.5 transition-all text-sm font-medium ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md font-semibold'
                            : studentAns.isLocked
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-400 hover:bg-emerald-50/40 cursor-pointer'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                            isSelected
                              ? 'bg-white text-emerald-700'
                              : 'bg-slate-100 text-slate-600 border border-slate-300'
                          }`}
                        >
                          {isSelected ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            String.fromCharCode(65 + optIndex)
                          )}
                        </div>

                        <span className="flex-1">{opt.text}</span>

                        {isSelected && (
                          <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-700 text-white">
                            Selected
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {isMultiple && !studentAns.isLocked && (
                    <p className="text-xs text-amber-700 font-medium mt-1">
                      Pick {requiredCount - (studentAns.selectedOptionIds?.length || 0)} more option(s) to finalize and lock your answer.
                    </p>
                  )}
                </div>
              )}

              {/* ---------------- True / False Options ---------------- */}
              {isTf && (
                <div className="grid grid-cols-2 gap-4">
                  {[true, false].map((boolVal) => {
                    const isSelected = studentAns.selectedBoolean === boolVal;

                    return (
                      <button
                        key={String(boolVal)}
                        type="button"
                        id={`btn-q${qIndex + 1}-tf-${boolVal}`}
                        disabled={studentAns.isLocked}
                        onClick={() => handleSelectTrueFalse(question.id, boolVal)}
                        className={`p-4 rounded-xl border text-center font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : studentAns.isLocked
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-400 hover:bg-emerald-50/40 cursor-pointer'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                        <span>{boolVal ? 'True' : 'False'}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ---------------- Theory Question (Auto-Expanding) ---------------- */}
              {isTheory && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Your Conceptual Response
                    </label>
                    <span className="text-xs text-purple-700 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Evaluated conceptually by AI
                    </span>
                  </div>

                  <AutoExpandingTextarea
                    id={`input-theory-q${qIndex + 1}`}
                    value={studentAns.theoryAnswer || ''}
                    onChange={(val) => handleUpdateTheory(question.id, val)}
                    placeholder="Type your explanation here. The box will expand automatically as you write. Focus on explaining the concepts and principles in your own words..."
                    minRows={4}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Test Footer */}
      <div className="mt-10 mb-16 bg-white rounded-2xl p-6 border border-slate-200 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-slate-900 text-base">Ready to Submit?</h4>
          <p className="text-xs text-slate-500">
            {answeredCount < testData.questions.length ? (
              <span className="text-amber-600 font-semibold">
                You have {testData.questions.length - answeredCount} unanswered question(s).
              </span>
            ) : (
              <span className="text-emerald-600 font-semibold">
                All questions answered! Ready for automated evaluation.
              </span>
            )}
          </p>
        </div>

        <button
          id="btn-submit-test"
          type="button"
          disabled={isSubmitting}
          onClick={() => handleSubmitTest(false)}
          className={`flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-base transition-all shadow-md ${
            isSubmitting
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-[1.02] shadow-indigo-600/20'
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Grading with AI...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Test & Generate Report
            </>
          )}
        </button>
      </div>
    </div>
  );
};
