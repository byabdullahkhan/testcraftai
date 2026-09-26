import React from 'react';
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowLeft, 
  Sparkles, 
  User,
  Download,
} from 'lucide-react';
import { TestSubmission } from '../types';
import { downloadSubmissionAsImage } from '../utils/downloadReportImage';

interface TestResultReportProps {
  submission: TestSubmission;
  onRetakeOrReturn?: () => void;
}

export const TestResultReport: React.FC<TestResultReportProps> = ({
  submission,
  onRetakeOrReturn,
}) => {
  const wrongQuestions = submission.evaluations.filter(e => e.status === 'wrong');
  const partialQuestions = submission.evaluations.filter(e => e.status === 'partial');
  const correctQuestions = submission.evaluations.filter(e => e.status === 'correct');

  const handleDownloadResult = () => {
    downloadSubmissionAsImage(submission);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
              <Award className="w-3.5 h-3.5" />
              <span>Official Assessment Report</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display mt-1">
              {submission.testTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Subject: <strong className="text-slate-800">{submission.subject}</strong> <span aria-hidden="true">·</span> Completed on {new Date(submission.submittedAt).toLocaleDateString()} at {new Date(submission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Student Info Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-5 py-3 text-right">
            <span className="text-xs text-slate-500 block">Candidate Name</span>
            <span className="text-base font-bold text-slate-900 flex items-center gap-1.5 justify-end">
              <User className="w-4 h-4 text-indigo-600" />
              {submission.studentName}
            </span>
            {submission.studentIdentifier && (
              <span className="text-xs text-slate-500 block font-mono">Roll / ID: {submission.studentIdentifier}</span>
            )}
          </div>
        </div>

        {/* Big Score Performance Banner */}
        <div
          className={`rounded-2xl p-6 sm:p-8 border flex flex-col md:flex-row items-center justify-between gap-6 mb-6 text-center md:text-left ${
            submission.passed
              ? 'bg-gradient-to-br from-emerald-50/70 via-white to-white border-emerald-200/90'
              : 'bg-gradient-to-br from-rose-50/70 via-white to-white border-rose-200/90'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div
              className={`w-22 h-22 rounded-2xl flex items-center justify-center text-4xl font-extrabold font-display shadow-xs ${
                submission.passed
                  ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                  : 'bg-rose-600 text-white shadow-rose-600/20'
              }`}
            >
              {submission.grade}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider">
                <span className={submission.passed ? 'text-emerald-700' : 'text-rose-700'}>
                  {submission.passed ? 'Assessment Passed' : 'Needs Review & Practice'}
                </span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="text-slate-500 font-normal">Passing mark: 50%</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-display">
                {submission.totalScore}{' '}
                <span className="text-xl sm:text-2xl text-slate-400 font-medium">
                  / {submission.maxScore} Marks
                </span>
              </h2>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                Score Percentage: <strong className="text-slate-900">{submission.percentage}%</strong> <span aria-hidden="true">·</span> Time Taken: {Math.floor(submission.timeSpentSeconds / 60)}m {submission.timeSpentSeconds % 60}s
              </p>
            </div>
          </div>

          {/* Quick Stat Counters */}
          <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
            <div className="bg-white border border-emerald-200 rounded-xl p-3 text-center shadow-2xs">
              <span className="text-xs text-emerald-700 font-bold block">Correct</span>
              <span className="text-xl font-extrabold text-emerald-800 font-display">
                {correctQuestions.length}
              </span>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl p-3 text-center shadow-2xs">
              <span className="text-xs text-amber-700 font-bold block">Partial</span>
              <span className="text-xl font-extrabold text-amber-800 font-display">
                {partialQuestions.length}
              </span>
            </div>
            <div className="bg-white border border-rose-200 rounded-xl p-3 text-center shadow-2xs">
              <span className="text-xs text-rose-700 font-bold block">Incorrect</span>
              <span className="text-xl font-extrabold text-rose-800 font-display">
                {wrongQuestions.length}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Download Result + Return */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            id="btn-download-student-result-top"
            onClick={handleDownloadResult}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-extrabold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Full Result</span>
          </button>

          {onRetakeOrReturn && (
            <button
              type="button"
              onClick={onRetakeOrReturn}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Home</span>
            </button>
          )}
        </div>
      </div>

      {/* Question-by-Question Detailed Breakdown */}
      <div className="mb-8">
        <h3 className="text-xl font-extrabold text-slate-900 font-display mb-4">
          Your Correct & Incorrect Answers Breakdown
        </h3>

        <div className="space-y-6">
          {submission.evaluations.map((evalItem, qIndex) => {
            const isCorrect = evalItem.status === 'correct';
            const isPartial = evalItem.status === 'partial';
            const isWrong = evalItem.status === 'wrong';

            return (
              <div
                key={evalItem.questionId}
                id={`report-item-${qIndex + 1}`}
                className={`rounded-2xl p-6 sm:p-7 transition-all ${
                  isCorrect
                    ? 'bg-white border-2 border-emerald-300 shadow-sm'
                    : isPartial
                    ? 'bg-white border-2 border-amber-300 shadow-sm'
                    : 'bg-rose-50/40 border-2 border-rose-400 shadow-md shadow-rose-500/10 ring-2 ring-rose-500/15'
                }`}
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-lg text-white flex items-center justify-center text-xs font-extrabold font-display ${
                        isWrong ? 'bg-rose-600' : isCorrect ? 'bg-emerald-600' : 'bg-slate-900'
                      }`}
                    >
                      Q{qIndex + 1}
                    </span>

                    <span
                      className={`text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-lg flex items-center gap-1.5 ${
                        isCorrect
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : isPartial
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-600 text-white shadow-xs'
                      }`}
                    >
                      {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      {isPartial && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                      {isWrong && <XCircle className="w-3.5 h-3.5 text-white" />}
                      {isCorrect ? 'Correct' : isPartial ? 'Partial Credit' : 'Incorrect'}
                    </span>

                    <span className="text-xs font-bold uppercase text-slate-400">
                      • {evalItem.questionType.toUpperCase()}
                    </span>
                  </div>

                  <span className="font-bold text-sm font-display text-slate-900">
                    Marks: <strong className={isCorrect ? 'text-emerald-600' : isPartial ? 'text-amber-600' : 'text-rose-600'}>{evalItem.marksAwarded}</strong> / {evalItem.maxMarks}
                  </span>
                </div>

                {/* Question Statement */}
                <h4 className="text-base font-bold text-slate-900 mb-4">
                  {evalItem.questionText}
                </h4>

                {/* Student's Answer Box (with Red Effect if Wrong, Green Effect if Correct) */}
                <div
                  className={`p-4 rounded-xl border-2 mb-3 ${
                    isCorrect
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                      : isPartial
                      ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                      : 'bg-rose-100/80 border-rose-400 text-rose-950 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-extrabold uppercase tracking-wider ${
                        isCorrect
                          ? 'text-emerald-700'
                          : isPartial
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {isCorrect
                        ? '✓ Your Answer (Correct):'
                        : isPartial
                        ? '◐ Your Answer (Partial):'
                        : '✗ Your Answer (Incorrect):'}
                    </span>
                  </div>
                  <p className="font-bold text-sm sm:text-base leading-relaxed">
                    {evalItem.studentAnswerDisplay || '(No answer selected / blank)'}
                  </p>
                </div>

                {/* Beneath the Question/MCQ: Always show the Correct Answer clearly (especially highlighted when wrong) */}
                {(!isCorrect || evalItem.questionType === 'theory') && (
                  <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 block mb-1">
                      {evalItem.questionType === 'mcq'
                        ? '✓ Correct Option / Answer:'
                        : evalItem.questionType === 'true_false'
                        ? '✓ Correct Answer:'
                        : "✓ Teacher's Reference Answer:"}
                    </span>
                    <p className="font-extrabold text-sm sm:text-base text-emerald-900 leading-relaxed">
                      The correct answer is: {evalItem.correctAnswerDisplay}
                    </p>
                  </div>
                )}

                {/* AI Theory Conceptual Evaluation Box */}
                {evalItem.theoryFeedback && (
                  <div className="mt-4 p-4 sm:p-5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs sm:text-sm">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-200/60">
                      <div className="flex items-center gap-1.5 font-bold text-purple-900 text-sm">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        Conceptual Grading Assessment
                      </div>
                      <span className="font-bold px-2.5 py-0.5 rounded-full bg-purple-200/70 text-purple-800 text-xs">
                        {evalItem.theoryFeedback.conceptMatchPercentage}% Concept Match
                      </span>
                    </div>

                    <div className="space-y-2 text-purple-950">
                      <div>
                        <strong className="text-purple-900">Verdict: </strong>
                        <span>{evalItem.theoryFeedback.conceptualVerdict}</span>
                      </div>
                      <div>
                        <strong className="text-emerald-800">Strengths: </strong>
                        <span>{evalItem.theoryFeedback.strengths}</span>
                      </div>
                      {evalItem.theoryFeedback.missingPoints && evalItem.theoryFeedback.missingPoints !== 'None' && (
                        <div>
                          <strong className="text-amber-800">Missing Concepts: </strong>
                          <span>{evalItem.theoryFeedback.missingPoints}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Download & Return Section (Behind Result) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-4">
        <h4 className="text-lg font-extrabold text-slate-900 font-display">
          Save Your Full Test Result
        </h4>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Click the download button below to save your complete test result and answer sheet to your device.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            id="btn-download-student-result-bottom"
            onClick={handleDownloadResult}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-extrabold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Download className="w-5 h-5" />
            <span>Download Full Result</span>
          </button>

          {onRetakeOrReturn && (
            <button
              type="button"
              id="btn-return-home"
              onClick={onRetakeOrReturn}
              className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
