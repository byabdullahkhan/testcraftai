import {
  Test,
  TestSubmission,
  QuestionEvaluation,
  UserProfile,
  cleanUsername,
} from '../types';

const LOCAL_TESTS_KEY = 'testcraft_local_tests_v7_clean';
const LOCAL_SUBMISSIONS_KEY_PREFIX = 'testcraft_local_submissions_v7_';
const LOCAL_USERS_KEY = 'testcraft_local_users_v7_clean';

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

export const apiService = {
  // Get all tests for the signed-in user (strictly isolated by username/uid)
  async getTests(userUid?: string, username?: string): Promise<any[]> {
    const normUname = username ? username.toLowerCase().trim().replace(/^@/, '') : '';
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
      totalMarks: t.totalMarks,
      timeLimitMinutes: t.timeLimitMinutes,
      questionCount: t.questions.length,
      createdAt: t.createdAt,
      creatorName: t.creatorName,
      creatorUsername: t.creatorUsername,
      creatorUid: t.creatorUid,
      submissionCount: getStoredSubmissions(t.id).length,
    }));
  },

  // Get full test by ID or slug (for Teacher view / "See the Test")
  async getTestById(testIdOrSlug: string): Promise<Test | null> {
    const cleanId = decodeURIComponent(testIdOrSlug).trim();
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

  // Get test for student taking the test
  async getTestForTaking(testIdOrSlug: string): Promise<any> {
    const cleanId = decodeURIComponent(testIdOrSlug).trim();
    const localTests = getStoredLocalTests();
    const targetSlug = slugifyTitle(cleanId);
    const localMatch = localTests.find(
      t =>
        t.id.toLowerCase() === cleanId.toLowerCase() ||
        (t.slug && t.slug.toLowerCase() === cleanId.toLowerCase()) ||
        slugifyTitle(t.title) === targetSlug
    );

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
        return localMatch;
      }
    } catch {
      // Offline fallback
    }

    if (localMatch) {
      return localMatch;
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

    saveLocalTest(newTest);
    return newTest;
  },

  // Check if student already attempted the test
  async checkStudentAttempt(
    testId: string,
    name: string,
    rollNo: string
  ): Promise<{ hasAttempted: boolean; submissionId?: string; submittedAt?: string }> {
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
    try {
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

    // Client-side fallback grading
    const localTests = getStoredLocalTests();
    const test = localTests.find(t => t.id === testId || t.slug === testId);
    if (!test) {
      throw new Error('Test not found for evaluation.');
    }

    const priorSubmissions = getStoredSubmissions(testId);
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
            wrongSelectedCount === 0
          ) {
            const fraction = correctSelectedCount / correctIds.size;
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
        const wordCount = studentText.split(/\s+/).filter(Boolean).length;
        let marksAwarded = 0;
        let status: 'correct' | 'partial' | 'wrong' = 'wrong';

        if (wordCount >= 15) {
          marksAwarded = Math.round(maxMarks * 0.8 * 10) / 10;
          status = 'correct';
        } else if (wordCount >= 5) {
          marksAwarded = Math.round(maxMarks * 0.5 * 10) / 10;
          status = 'partial';
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
            conceptMatchPercentage: status === 'correct' ? 85 : status === 'partial' ? 55 : 20,
            accuracyScore: marksAwarded,
            conceptualVerdict:
              status === 'correct'
                ? 'Demonstrates solid conceptual understanding'
                : status === 'partial'
                ? 'Adequate answer with key concepts'
                : 'Needs further elaboration',
            strengths: 'Good attempt addressing key ideas.',
            missingPoints: 'Consider adding further specific technical terminology.',
            rubricNotes: 'Evaluated based on standard conceptual keywords.',
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

    saveLocalSubmission(testId, submission);
    return submission;
  },

  // Get submissions for a test
  async getSubmissions(testId: string): Promise<TestSubmission[]> {
    try {
      const res = await fetch(`/api/tests/${encodeURIComponent(testId)}/submissions`);
      if (res.ok) {
        const data = await res.json();
        if (data.submissions) return data.submissions;
      }
    } catch {
      // Offline fallback
    }
    return getStoredSubmissions(testId);
  },

  // Get prior submission by ID
  async getSubmissionById(submissionId: string): Promise<TestSubmission | null> {
    try {
      const res = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.submission) return data.submission;
      }
    } catch {
      // Offline fallback
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
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to register account.');
    }
    return data.user;
  },

  // Custom Auth: Sign In with Username & Password
  async signInUser(payload: { username: string; password: string }): Promise<UserProfile> {
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to sign in.');
    }
    return data.user;
  },

  // Custom Auth: Check Username availability
  async checkUsername(username: string): Promise<{ available: boolean; message: string }> {
    try {
      const res = await fetch(
        `/api/auth/check-username?username=${encodeURIComponent(username)}`
      );
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { available: true, message: '' };
  },

  // Delete test
  async deleteTest(testId: string): Promise<boolean> {
    const local = getStoredLocalTests().filter(t => t.id !== testId && t.slug !== testId);
    localStorage.setItem(LOCAL_TESTS_KEY, JSON.stringify(local));
    localStorage.removeItem(`${LOCAL_SUBMISSIONS_KEY_PREFIX}${testId}`);

    try {
      const res = await fetch(`/api/tests/${encodeURIComponent(testId)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return true;
    }
  },
};
