export type QuestionType = 'mcq' | 'true_false' | 'theory';

export type PartialMarkingRule = 'half' | 'zero';

export interface McqOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  questionText: string;
  marks: number;
  // MCQ specific
  options?: McqOption[];
  correctOptionIds?: string[];
  partialMarkingRule?: PartialMarkingRule; // 'half' (50% for 1 correct + 1 wrong in 2-choice) or 'zero'
  // True / False specific
  correctBoolean?: boolean;
  // Theory specific
  modelAnswer?: string; // Reference conceptual answer provided by teacher
}

export interface Test {
  id: string;
  slug?: string;
  title: string;
  subject: string;
  instructions: string;
  timeLimitMinutes: number | null; // null means no time limit
  questions: Question[];
  totalMarks: number;
  createdAt: string;
  creatorName: string;
  creatorUsername?: string;
  creatorUid?: string;
  creatorEmail?: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  role: 'admin' | 'instructor';
  createdAt: string;
  lastLoginAt: string;
}

export interface EmailNotification {
  id: string;
  recipientEmail: string;
  recipientUid: string;
  subject: string;
  type: 'welcome' | 'test_published' | 'submission_received' | 'weekly_summary';
  bodyText: string;
  sentAt: string;
  status: 'delivered' | 'sent';
  meta?: {
    testId?: string;
    testTitle?: string;
    submissionId?: string;
    studentName?: string;
    score?: number;
    maxScore?: number;
  };
}

export interface StudentAnswer {
  questionId: string;
  selectedOptionIds?: string[];
  selectedBoolean?: boolean | null;
  theoryAnswer?: string;
  isLocked?: boolean;
}

export interface TheoryFeedback {
  conceptMatchPercentage: number; // 0 to 100
  accuracyScore: number; // 0 to 10
  conceptualVerdict: string;
  strengths: string;
  missingPoints: string;
  rubricNotes: string;
}

export interface QuestionEvaluation {
  questionId: string;
  questionType: QuestionType;
  questionText: string;
  marksAwarded: number;
  maxMarks: number;
  status: 'correct' | 'partial' | 'wrong';
  studentAnswerDisplay: string;
  correctAnswerDisplay: string;
  theoryFeedback?: TheoryFeedback;
}

export interface TestSubmission {
  id: string;
  testId: string;
  testTitle: string;
  subject: string;
  studentName: string;
  studentIdentifier?: string;
  submittedAt: string;
  timeSpentSeconds: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: string;
  passed: boolean;
  evaluations: QuestionEvaluation[];
}

export const SUPER_ADMIN_USERNAME = 'byabdullahkhan';
export const SUPER_ADMIN_PASSWORD = 'gemini';
export const SUPER_ADMIN_EMAIL = 'byabdullahkhan@gmail.com';

export const isSuperAdmin = (identifier?: string | null): boolean => {
  if (!identifier) return false;
  const clean = identifier.trim().toLowerCase().replace(/^@/, '');
  return clean === SUPER_ADMIN_USERNAME.toLowerCase() || clean === SUPER_ADMIN_EMAIL.toLowerCase();
};

export interface AdminUserSummary {
  uid: string;
  username: string;
  displayName: string;
  email?: string;
  role?: string;
  photoURL?: string;
  createdAt: string;
  lastLoginAt: string;
  testsCount?: number;
  submissionsCount?: number;
}

export type ActivityType = 
  | 'user_login' 
  | 'user_register' 
  | 'test_created' 
  | 'test_updated' 
  | 'test_deleted' 
  | 'submission_received' 
  | 'email_sent';

export interface SiteActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  userEmail?: string;
  userName?: string;
  username?: string;
  userPhoto?: string;
  testId?: string;
  testTitle?: string;
  score?: number;
  maxScore?: number;
  grade?: string;
  metadata?: Record<string, any>;
}

export function cleanUsername(input: string): string {
  if (!input) return 'user_' + Math.random().toString(36).substring(2, 7);
  let cleaned = input.toLowerCase().trim()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_');
  if (cleaned.length < 3) {
    cleaned = (cleaned + '_' + Math.random().toString(36).substring(2, 6)).slice(0, 20);
  }
  return cleaned.slice(0, 24);
}

export function formatUsername(username?: string): string {
  if (!username) return '@user';
  const clean = username.replace(/^@+/, '').trim();
  return clean ? `@${clean}` : '@user';
}

