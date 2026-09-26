import {
  Test,
  TestSubmission,
  QuestionEvaluation,
  UserProfile,
  cleanUsername,
} from '../types';
import { extractAndSyncTestFromUrl } from '../utils/urlHelper';

const LOCAL_TESTS_KEY = 'testcraft_local_tests_v7_clean';
const LOCAL_SUBMISSIONS_KEY_PREFIX = 'testcraft_local_submissions_v7_';
const LOCAL_USERS_KEY = 'testcraft_local_users_v7_clean';

const isStaticHost = (): boolean =>
  typeof window !== 'undefined' && window.location.hostname.includes('github.io');

function slugifyTitle(title: string): string {
  if (!title) return 'test';
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'test'
  );
}

function getStoredLocalTests(): Test[] {
  try {
    const raw = localStorage.getItem(LOCAL_TESTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading local tests:', e);
  }
  return [];
}

function saveLocalTest(test: Test) {
  try {
    const existing = getStoredLocalTests();
    const filtered = existing.filter(t => t.id !== test.id && t.slug !== test.slug);
    filtered.unshift(test);
    localStorage.setItem(LOCAL_TESTS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error saving local test:', e);
  }
}

function getStoredSubmissions(testId: string): TestSubmission[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_SUBMISSIONS_KEY_PREFIX}${testId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading local submissions:', e);
  }
  return [];
}

function saveLocalSubmission(testId: string, submission: TestSubmission) {
  try {
    const existing = getStoredSubmissions(testId);
    const filtered = existing.filter(s => s.id !== submission.id);
    filtered.push(submission);
    localStorage.setItem(`${LOCAL_SUBMISSIONS_KEY_PREFIX}${testId}`, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error saving local submission:', e);
  }
}

function formatTestForStudent(test: Test): any {
  const sanitizedQuestions = (test.questions || []).map((q: any) => {
    const base = {
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      marks: q.marks,
    };

    if (q.type === 'mcq') {
      const correctCount =
        Array.isArray(q.correctOptionIds) && q.correctOptionIds.length > 0
          ? q.correctOptionIds.length
          : Number(q.correctCount) > 0
          ? Number(q.correctCount)
          : 1;
      return {
        ...base,
        options: q.options || [],
        correctCount,
        isMultipleCorrect: correctCount > 1,
        partialMarkingRule: q.partialMarkingRule || 'half',
      };
    }

    return base;
  });

  return {
    id: test.id,
    slug: test.slug || slugifyTitle(test.title),
    title: test.title,
    subject: test.subject,
    instructions: test.instructions,
    timeLimitMinutes: test.timeLimitMinutes,
    totalMarks: test.totalMarks,
    questionCount: (test.questions || []).length,
    questions: sanitizedQuestions,
  };
}

export const apiService = {
  // Get all tests for the signed-in user (strictly isolated by username/uid)
  async getTests(userUid?: string, username?: string): Promise<any[]> {
    const normUname = username ? username.toLowerCase().trim().replace(/^@/, '') : '';
    if (!isStaticHost()) {
      try {
        const url = normUname
          ? `/api/tests?creatorUsername=${encodeURIComponent(normUname)}`
          : userUid
          ? `/api/tests?creatorUid=${encodeURIComponent(userUid)}`
          : '/api/tests';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.tests)) {
            data.tests.forEach((t: any) => {
              if (t && Array.isArray(t.questions) && t.questions.length > 0) {
                saveLocalTest(t as Test);
              }
            });
            if (normUname) {
              return data.tests.filter(
                (t: any) =>
                  t.creatorUsername &&
                  t.creatorUsername.toLowerCase().trim().replace(/^@/, '') === normUname
              );
            }
            if (userUid) {
              return data.tests.filter((t: any) => t.creatorUid === userUid);
            }
            return [];
          }
        }
      } catch {
        // Offline fallback
      }
    }

    let localTests = getStoredLocalTests();
    if (normUname) {
      localTests = localTests.filter(
        t =>
          t.creatorUsername &&
          t.creatorUsername.toLowerCase().trim().replace(/^@/, '') === normUname
      );
    } else if (userUid) {
      localTests = localTests.filter(t => t.creatorUid === userUid);
    } else {
      localTests = [];
    }

    return localTests.map(t => ({
      id: t.id,
      slug: t.slug || slugifyTitle(t.title),
      title: t.title,
      subject: t.subject,
      instructions: t.instructions,
      totalMarks: t.totalMarks,
      timeLimitMinutes: t.timeLimitMinutes,
      questionCount: t.questions.length,
      questions: t.questions,
      createdAt: t.createdAt,
      creatorName: t.creatorName,
      creatorUsername: t.creatorUsername,
      creatorUid: t.creatorUid,
      submissionCount: getStoredSubmissions(t.id).length,
    }));
  },

  // Get full test by ID or slug (for Teacher view / "See the Test")
  async getTestById(testIdOrSlug: string): Promise<Test | null> {
    const { testId: extractedId, decodedTest } = extractAndSyncTestFromUrl(testIdOrSlug);
    const cleanId = decodeURIComponent(extractedId || testIdOrSlug).trim();

    if (decodedTest) {
      saveLocalTest(decodedTest);
    }

    if (!isStaticHost()) {
      try {
        const res = await fetch(`/api/tests/${encodeURIComponent(cleanId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.test) {
            saveLocalTest(data.test);
            return data.test;
          }
        }
      } catch {
        // Offline fallback
      }
    }

    if (decodedTest) return decodedTest;

    const localTests = getStoredLocalTests();
    const targetSlug = slugifyTitle(cleanId);
    const found = localTests.find(
      t =>
        t.id.toLowerCase() === cleanId.toLowerCase() ||
        (t.slug && t.slug.toLowerCase() === cleanId.toLowerCase()) ||
        slugifyTitle(t.title) === targetSlug
    );
    return found || null;
  },

  // Get test for student taking the test (works across any device, browser, or email account)
  async getTestForTaking(testIdOrSlug: string): Promise<any> {
    const { testId: extractedId, decodedTest } = extractAndSyncTestFromUrl(testIdOrSlug);
    const cleanId = decodeURIComponent(extractedId || testIdOrSlug).trim();

    if (decodedTest) {
      saveLocalTest(decodedTest);
    }

    const localTests = getStoredLocalTests();
    const targetSlug = slugifyTitle(cleanId);
    const localMatch =
      decodedTest ||
      localTests.find(
        t =>
          t.id.toLowerCase() === cleanId.toLowerCase() ||
          (t.slug && t.slug.toLowerCase() === cleanId.toLowerCase()) ||
          slugifyTitle(t.title) === targetSlug
      );

    if (!isStaticHost()) {
      try {
        const res = await fetch(`/api/tests/${encodeURIComponent(cleanId)}/take`);
        if (res.ok) {
          const data = await res.json();
          if (data.test) return data.test;
        } else if (res.status === 404 && localMatch) {
          await fetch('/api/tests/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: localMatch }),
          }).catch(() => {});
          return formatTestForStudent(localMatch);
        }
      } catch {
        // Offline fallback
      }
    }

    if (localMatch) {
      return formatTestForStudent(localMatch);
    }

    throw new Error(`Test "${cleanId}" was not found. Please check the test link and try again.`);
  },

  // Create a new test (or upload an edited test as a new project with a new link)
  async createTest(payload: any): Promise<Test> {
    const baseSlug = slugifyTitle(payload.title || 'untitled-test');
    const localTests = getStoredLocalTests();
    let slug = baseSlug;
    let count = 1;
    while (localTests.some(t => t.slug === slug || t.id === slug)) {
      count++;
      slug = `${baseSlug}-${count}`;
    }

    const totalMarks = (payload.questions || []).reduce(
      (sum: number, q: any) => sum + (Number(q.marks) || 0),
      0
    );

    const newTest: Test = {
      id: slug,
      slug,
      ...payload,
      totalMarks,
      createdAt: new Date().toISOString(),
    };

    if (!isStaticHost()) {
      try {
        const res = await fetch('/api/tests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTest),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.test) {
            saveLocalTest(data.test);
            return data.test;
          }
        }
      } catch {
        // Offline fallback
      }
    }

    saveLocalTest(newTest);
    return newTest;
  },

  // Check if student already attempted the test
  async checkStudentAttempt(
    testId: string,
    name: string,
    rollNo: string
  ): Promise<{ hasAttempted: boolean; submissionId?: string; submittedAt?: string }> {
    if (!isStaticHost()) {
      try {
        const res = await fetch(
          `/api/tests/${encodeURIComponent(testId)}/check-student?name=${encodeURIComponent(
            name
          )}&rollNo=${encodeURIComponent(rollNo)}`
        );
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // Fallback to local
      }
    }

    const subs = getStoredSubmissions(testId);
    const normName = name.trim().toLowerCase();
    const normRoll = rollNo.trim().toLowerCase();
    const existing = subs.find(
      s =>
        (normName && s.studentName.trim().toLowerCase() === normName) ||
        (normRoll && s.studentIdentifier && s.studentIdentifier.trim().toLowerCase() === normRoll)
    );

    if (existing) {
      return {
        hasAttempted: true,
        submissionId: existing.id,
        submittedAt: existing.submittedAt,
      };
    }
    return { hasAttempted: false };
  },

  // Submit student test and grade
  async submitTest(testId: string, payload: any): Promise<TestSubmission> {
    const { decodedTest } = extractAndSyncTestFromUrl(testId);
    if (decodedTest) {
      saveLocalTest(decodedTest);
    }

    if (!isStaticHost()) {
      try {
        if (decodedTest) {
          await fetch('/api/tests/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: decodedTest }),
          }).catch(() => {});
        }

        const res = await fetch(`/api/tests/${encodeURIComponent(testId)}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.submission) {
            saveLocalSubmission(testId, data.submission);
            return data.submission;
          }
        } else if (res.status === 409) {
          const errData = await res.json();
          throw new Error(errData.error || 'You have already submitted this test.');
        }
      } catch (err: any) {
        if (err.message && err.message.includes('already submitted')) {
          throw err;
        }
      }
    }

    // Client-side grading (supports any device / email via localStorage or URL payload)
    const localTests = getStoredLocalTests();
    const cleanId = decodeURIComponent(testId).trim().toLowerCase();
    const targetSlug = slugifyTitle(cleanId);
    const test =
      decodedTest ||
      localTests.find(
        t =>
          t.id.toLowerCase() === cleanId ||
          (t.slug && t.slug.toLowerCase() === cleanId) ||
          slugifyTitle(t.title) === targetSlug
      );

    if (!test) {
      throw new Error('Test not found for evaluation.');
    }

    const priorSubmissions = getStoredSubmissions(test.id);
    const already = priorSubmissions.find(
      s =>
        s.studentName.toLowerCase() === payload.studentName.toLowerCase().trim() ||
        (payload.studentIdentifier &&
          s.studentIdentifier &&
          s.studentIdentifier.toLowerCase() === payload.studentIdentifier.toLowerCase().trim())
    );
    if (already) {
      throw new Error(
        'You have already submitted this test. Each individual can only perform this test once.'
      );
    }

    const answersMap = new Map<string, any>();
    if (Array.isArray(payload.answers)) {
      payload.answers.forEach((ans: any) => answersMap.set(ans.questionId, ans));
    } else if (payload.answers && typeof payload.answers === 'object') {
      Object.entries(payload.answers).forEach(([qId, val]: [string, any]) => {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          answersMap.set(qId, { questionId: qId, ...val });
        } else if (Array.isArray(val)) {
          answersMap.set(qId, { questionId: qId, selectedOptionIds: val });
        } else if (typeof val === 'boolean') {
          answersMap.set(qId, { questionId: qId, selectedBoolean: val });
        } else if (typeof val === 'string') {
          answersMap.set(qId, { questionId: qId, theoryAnswer: val });
        }
      });
    }

    let totalScore = 0;
    const evaluations: QuestionEvaluation[] = [];

    test.questions.forEach(q => {
      const ans = answersMap.get(q.id);
      const maxMarks = Number(q.marks) || 0;

      if (q.type === 'mcq') {
        const correctIds = new Set<string>(q.correctOptionIds || []);
        const rawSelected = ans?.selectedOptionIds || [];
        const selectedIds = new Set<string>(
          Array.isArray(rawSelected) ? rawSelected.map(String) : []
        );
        const optionsList = q.options || [];
        const optionsMap = new Map(
          optionsList.map((o, idx) => {
            const letter = String.fromCharCode(65 + idx);
            return [o.id, `Option ${letter} — ${o.text}`];
          })
        );
        const studentDisplayText =
          Array.from(selectedIds)
            .map(id => optionsMap.get(id) || String(id))
            .join(', ') || 'No option selected';
        const correctDisplayText = Array.from(correctIds)
          .map(id => optionsMap.get(id) || String(id))
          .join(', ');

        if (selectedIds.size === 0) {
          evaluations.push({
            questionId: q.id,
            questionType: 'mcq',
            questionText: q.questionText,
            marksAwarded: 0,
            maxMarks,
            status: 'wrong',
            studentAnswerDisplay: studentDisplayText,
            correctAnswerDisplay: correctDisplayText,
          });
          return;
        }

        const isExactMatch =
          correctIds.size === selectedIds.size &&
          Array.from(selectedIds).every(id => correctIds.has(id));

        if (isExactMatch) {
          totalScore += maxMarks;
          evaluations.push({
            questionId: q.id,
            questionType: 'mcq',
            questionText: q.questionText,
            marksAwarded: maxMarks,
            maxMarks,
            status: 'correct',
            studentAnswerDisplay: studentDisplayText,
            correctAnswerDisplay: correctDisplayText,
          });
        } else {
          const correctSelectedCount = Array.from(selectedIds).filter(id =>
            correctIds.has(id)
          ).length;
          const wrongSelectedCount = Array.from(selectedIds).filter(
            id => !correctIds.has(id)
          ).length;

          if (
            q.partialMarkingRule !== 'zero' &&
            correctSelectedCount > 0 &&
            (wrongSelectedCount === 0 || correctSelectedCount >= 1)
          ) {
            const fraction =
              wrongSelectedCount === 0 ? correctSelectedCount / correctIds.size : 0.5;
            const awarded = Math.round(fraction * maxMarks * 10) / 10;
            totalScore += awarded;
            evaluations.push({
              questionId: q.id,
              questionType: 'mcq',
              questionText: q.questionText,
              marksAwarded: awarded,
              maxMarks,
              status: 'partial',
              studentAnswerDisplay: studentDisplayText,
              correctAnswerDisplay: correctDisplayText,
            });
          } else {
            evaluations.push({
              questionId: q.id,
              questionType: 'mcq',
              questionText: q.questionText,
              marksAwarded: 0,
              maxMarks,
              status: 'wrong',
              studentAnswerDisplay: studentDisplayText,
              correctAnswerDisplay: correctDisplayText,
            });
          }
        }
      } else if (q.type === 'true_false') {
        const studentBool = ans?.selectedBoolean;
        const correctBool = q.correctBoolean;
        const studentDisplayText =
          studentBool === true ? 'True' : studentBool === false ? 'False' : 'Unanswered';
        const correctDisplayText = correctBool ? 'True' : 'False';

        if (studentBool === correctBool) {
          totalScore += maxMarks;
          evaluations.push({
            questionId: q.id,
            questionType: 'true_false',
            questionText: q.questionText,
            marksAwarded: maxMarks,
            maxMarks,
            status: 'correct',
            studentAnswerDisplay: studentDisplayText,
            correctAnswerDisplay: correctDisplayText,
          });
        } else {
          evaluations.push({
            questionId: q.id,
            questionType: 'true_false',
            questionText: q.questionText,
            marksAwarded: 0,
            maxMarks,
            status: 'wrong',
            studentAnswerDisplay: studentDisplayText,
            correctAnswerDisplay: correctDisplayText,
          });
        }
      } else if (q.type === 'theory') {
        const studentText = (ans?.theoryAnswer || '').trim();
        const modelText = (q.modelAnswer || '').trim();
        let marksAwarded = 0;
        let status: 'correct' | 'partial' | 'wrong' = 'wrong';
        let ratio = 0;

        if (studentText) {
          const modelTokens = new Set<string>(
            modelText
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, '')
              .split(/\s+/)
              .filter(w => w.length > 3)
          );
          const studentTokens = new Set<string>(
            studentText
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, '')
              .split(/\s+/)
              .filter(w => w.length > 3)
          );

          let matchCount = 0;
          studentTokens.forEach(token => {
            if (modelTokens.has(token)) matchCount++;
          });

          const overlapRatio =
            modelTokens.size > 0 ? Math.min(1, matchCount / Math.max(1, modelTokens.size * 0.55)) : 0.7;
          const lengthFactor = Math.min(1, studentText.length / Math.max(25, modelText.length * 0.4));
          ratio = Math.min(1, overlapRatio * 0.65 + lengthFactor * 0.35);

          if (ratio >= 0.75) {
            marksAwarded = Math.round(maxMarks * Math.max(0.85, ratio) * 10) / 10;
            status = 'correct';
          } else if (ratio >= 0.35) {
            marksAwarded = Math.round(maxMarks * ratio * 10) / 10;
            status = 'partial';
          } else {
            marksAwarded = Math.round(maxMarks * Math.max(0, ratio * 0.5) * 10) / 10;
            status = marksAwarded > 0 ? 'partial' : 'wrong';
          }
        }

        totalScore += marksAwarded;
        evaluations.push({
          questionId: q.id,
          questionType: 'theory',
          questionText: q.questionText,
          marksAwarded,
          maxMarks,
          status,
          studentAnswerDisplay: studentText || 'No answer submitted',
          correctAnswerDisplay: q.modelAnswer || 'Instructor model answer',
          theoryFeedback: {
            conceptMatchPercentage: Math.round(ratio * 100),
            accuracyScore: Math.round(ratio * 10 * 10) / 10,
            conceptualVerdict:
              status === 'correct'
                ? 'Demonstrates strong conceptual understanding'
                : status === 'partial'
                ? 'Partial conceptual coverage with key ideas'
                : 'Insufficient conceptual coverage',
            strengths:
              status === 'wrong'
                ? 'Attempt recorded.'
                : 'Covered core concepts aligned with the reference model.',
            missingPoints:
              status === 'correct'
                ? 'All primary concepts addressed.'
                : 'Review the reference answer for additional conceptual details.',
            rubricNotes: 'Evaluated via conceptual alignment and key terminology.',
          },
        });
      }
    });

    const maxScore = test.totalMarks || evaluations.reduce((a, e) => a + e.maxMarks, 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const passed = percentage >= 50;
    let grade = 'F';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B';
    else if (percentage >= 60) grade = 'C';
    else if (percentage >= 50) grade = 'D';

    const submission: TestSubmission = {
      id: `sub_${Date.now()}`,
      testId: test.id,
      testTitle: test.title,
      subject: test.subject,
      studentName: payload.studentName,
      studentIdentifier: payload.studentIdentifier,
      submittedAt: new Date().toISOString(),
      timeSpentSeconds: payload.timeSpentSeconds || 0,
      totalScore: Math.round(totalScore * 10) / 10,
      maxScore,
      percentage,
      grade,
      passed,
      evaluations,
    };

    saveLocalSubmission(test.id, submission);
    return submission;
  },

  // Get submissions for a test
  async getSubmissions(testId: string): Promise<TestSubmission[]> {
    if (!isStaticHost()) {
      try {
        const res = await fetch(`/api/tests/${encodeURIComponent(testId)}/submissions`);
        if (res.ok) {
          const data = await res.json();
          if (data.submissions) return data.submissions;
        }
      } catch {
        // Offline fallback
      }
    }
    return getStoredSubmissions(testId);
  },

  // Get prior submission by ID
  async getSubmissionById(submissionId: string): Promise<TestSubmission | null> {
    if (!isStaticHost()) {
      try {
        const res = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.submission) return data.submission;
        }
      } catch {
        // Offline fallback
      }
    }

    const localTests = getStoredLocalTests();
    for (const test of localTests) {
      const subs = getStoredSubmissions(test.id);
      const found = subs.find(s => s.id === submissionId);
      if (found) return found;
    }
    return null;
  },

  // Custom Auth: Register with Username & Password (Get Started)
  async registerUser(payload: {
    username: string;
    password: string;
    displayName?: string;
  }): Promise<UserProfile> {
    const uname = cleanUsername(payload.username || '');
    const pwd = (payload.password || '').trim();
    if (!uname || uname.length < 3) {
      throw new Error('Username must be at least 3 characters (letters, numbers, or underscores).');
    }
    if (!pwd || pwd.length < 3) {
      throw new Error('Password must be at least 3 characters.');
    }

    // Check local registry first
    let localUsers: Record<string, UserProfile & { password?: string }> = {};
    try {
      const raw = localStorage.getItem(LOCAL_USERS_KEY);
      if (raw) localUsers = JSON.parse(raw);
    } catch {}

    if (localUsers[uname]) {
      throw new Error(`Username "@${uname}" is already taken. Please choose a different username.`);
    }

    // Try backend server first if available
    if (!isStaticHost()) {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to register account.');
          }
          if (data.user) {
            localUsers[uname] = { ...data.user, password: pwd };
            try {
              localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers));
            } catch {}
            return data.user;
          }
        }
      } catch (err: any) {
        if (
          err.message &&
          (err.message.includes('already taken') || err.message.includes('must be'))
        ) {
          throw err;
        }
      }
    }

    // Fallback for static hosting (GitHub Pages)
    const now = new Date().toISOString();
    const newUser: UserProfile & { password?: string } = {
      uid: `usr_${uname}`,
      username: uname,
      password: pwd,
      displayName: (payload.displayName || '').trim() || uname,
      email: `${uname}@testcraft.local`,
      role: 'instructor',
      createdAt: now,
      lastLoginAt: now,
    };
    localUsers[uname] = newUser;
    try {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers));
    } catch {}

    const { password: _, ...safeUser } = newUser;
    return safeUser;
  },

  // Custom Auth: Sign In with Username & Password
  async signInUser(payload: { username: string; password: string }): Promise<UserProfile> {
    const uname = cleanUsername(payload.username || '');
    const pwd = (payload.password || '').trim();
    if (!uname || !pwd) {
      throw new Error('Please enter both username and password.');
    }

    let localUsers: Record<string, UserProfile & { password?: string }> = {};
    try {
      const raw = localStorage.getItem(LOCAL_USERS_KEY);
      if (raw) localUsers = JSON.parse(raw);
    } catch {}

    // Try backend server first if available
    if (!isStaticHost()) {
      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (res.ok && data.user) {
            localUsers[uname] = { ...data.user, password: pwd };
            try {
              localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers));
            } catch {}
            return data.user;
          }
          if (res.status === 401) {
            throw new Error(data.error || 'Incorrect password for this username. Please try again.');
          }
          if (!localUsers[uname]) {
            throw new Error(
              data.error ||
                `Username "@${uname}" was not found. If you are visiting for the first time, please click "Get Started" to create your account.`
            );
          }
        }
      } catch (err: any) {
        if (
          err.message &&
          (err.message.includes('Incorrect password') || err.message.includes('was not found'))
        ) {
          throw err;
        }
      }
    }

    // Fallback for static hosting (GitHub Pages)
    const existing = localUsers[uname];
    if (!existing) {
      throw new Error(
        `Username "@${uname}" was not found. If you are visiting for the first time, please click "Get Started" to create your account.`
      );
    }
    if (existing.password !== pwd) {
      throw new Error('Incorrect password for this username. Please try again.');
    }

    existing.lastLoginAt = new Date().toISOString();
    localUsers[uname] = existing;
    try {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers));
    } catch {}

    const { password: _, ...safeUser } = existing;
    return safeUser;
  },

  // Custom Auth: Check Username availability
  async checkUsername(username: string): Promise<{ available: boolean; message: string }> {
    const uname = cleanUsername(username || '');
    if (!uname || uname.length < 3) {
      return { available: false, message: 'Username must be at least 3 characters.' };
    }

    try {
      const raw = localStorage.getItem(LOCAL_USERS_KEY);
      if (raw) {
        const localUsers = JSON.parse(raw);
        if (localUsers && localUsers[uname]) {
          return {
            available: false,
            message: `Username "@${uname}" is already taken. Please choose a different username.`,
          };
        }
      }
    } catch {}

    if (!isStaticHost()) {
      try {
        const res = await fetch(
          `/api/auth/check-username?username=${encodeURIComponent(uname)}`
        );
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch {}
    }
    return { available: true, message: `Username "@${uname}" is available!` };
  },

  // Delete test
  async deleteTest(testId: string): Promise<boolean> {
    const local = getStoredLocalTests().filter(t => t.id !== testId && t.slug !== testId);
    localStorage.setItem(LOCAL_TESTS_KEY, JSON.stringify(local));
    localStorage.removeItem(`${LOCAL_SUBMISSIONS_KEY_PREFIX}${testId}`);

    if (!isStaticHost()) {
      try {
        const res = await fetch(`/api/tests/${encodeURIComponent(testId)}`, {
          method: 'DELETE',
        });
        return res.ok;
      } catch {
        return true;
      }
    }
    return true;
  },
};
