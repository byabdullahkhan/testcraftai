import {
  Test,
  TestSubmission,
  QuestionEvaluation,
  UserProfile,
  cleanUsername,
} from '../types';
import { extractAndSyncTestFromUrl } from '../utils/urlHelper';
import {
  publishSubmissionToCloud,
  fetchSubmissionsFromCloud,
  doesSubmissionMatchTest,
} from '../utils/cloudSync';

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
    const prev = existing.find(
      t =>
        t.id === test.id ||
        (t.slug && test.slug && t.slug === test.slug) ||
        slugifyTitle(t.title) === slugifyTitle(test.title)
    );
    const merged: Test = prev
      ? {
          ...prev,
          ...test,
          id: prev.id || test.id,
          slug: prev.slug || test.slug,
          creatorUsername: test.creatorUsername || prev.creatorUsername,
          creatorUid: test.creatorUid || prev.creatorUid,
          creatorEmail: test.creatorEmail || prev.creatorEmail,
          creatorName: test.creatorName || prev.creatorName,
          questions:
            Array.isArray(prev.questions) && prev.questions.length > 0
              ? prev.questions
              : test.questions,
        }
      : test;

    const filtered = existing.filter(
      t => t.id !== merged.id && (!merged.slug || t.slug !== merged.slug)
    );
    filtered.unshift(merged);
    localStorage.setItem(LOCAL_TESTS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error saving local test:', e);
  }
}

function deduplicateSubmissions(list: TestSubmission[]): TestSubmission[] {
  const map = new Map<string, TestSubmission>();
  for (const sub of list) {
    if (!sub || !sub.id) continue;
    const normStudentKey = `${slugifyTitle(sub.testId || sub.testTitle || '')}__${(
      sub.studentName || ''
    )
      .trim()
      .toLowerCase()}`;
    if (!map.has(sub.id) && !map.has(normStudentKey)) {
      map.set(sub.id, sub);
      map.set(normStudentKey, sub);
    }
  }
  const unique = Array.from(new Set(map.values()));
  unique.sort(
    (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
  );
  return unique;
}

function getStoredSubmissions(testId: string, testTitle?: string): TestSubmission[] {
  const collected: TestSubmission[] = [];
  try {
    const keysToTry = new Set<string>([
      `${LOCAL_SUBMISSIONS_KEY_PREFIX}${testId}`,
      `${LOCAL_SUBMISSIONS_KEY_PREFIX}${slugifyTitle(testId)}`,
    ]);
    if (testTitle) {
      keysToTry.add(`${LOCAL_SUBMISSIONS_KEY_PREFIX}${slugifyTitle(testTitle)}`);
    }

    for (const key of keysToTry) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          collected.push(...parsed);
        }
      }
    }

    // Also scan any other submission keys in localStorage that match this testId or title
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LOCAL_SUBMISSIONS_KEY_PREFIX) && !keysToTry.has(k)) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((s: TestSubmission) => {
                if (doesSubmissionMatchTest(s, testId, testTitle)) {
                  collected.push(s);
                }
              });
            }
          }
        } catch {}
      }
    }
  } catch (e) {
    console.error('Error reading local submissions:', e);
  }
  return deduplicateSubmissions(collected);
}

function saveLocalSubmission(testId: string, submission: TestSubmission) {
  try {
    const targetSlug = slugifyTitle(testId || submission.testId || submission.testTitle || 'test');
    const existing = getStoredSubmissions(testId, submission.testTitle);
    const updated = deduplicateSubmissions([submission, ...existing]);

    localStorage.setItem(`${LOCAL_SUBMISSIONS_KEY_PREFIX}${targetSlug}`, JSON.stringify(updated));
    if (testId && testId !== targetSlug) {
      localStorage.setItem(`${LOCAL_SUBMISSIONS_KEY_PREFIX}${testId}`, JSON.stringify(updated));
    }
    if (submission.testId && submission.testId !== targetSlug && submission.testId !== testId) {
      localStorage.setItem(
        `${LOCAL_SUBMISSIONS_KEY_PREFIX}${submission.testId}`,
        JSON.stringify(updated)
      );
    }
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
    let serverTests: any[] = [];

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
            serverTests = data.tests;
            serverTests.forEach((t: any) => {
              if (t && Array.isArray(t.questions) && t.questions.length > 0) {
                saveLocalTest(t as Test);
              }
            });
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
          (t.creatorUsername &&
            t.creatorUsername.toLowerCase().trim().replace(/^@/, '') === normUname) ||
          (userUid && t.creatorUid === userUid)
      );
    } else if (userUid) {
      localTests = localTests.filter(t => t.creatorUid === userUid);
    } else {
      localTests = [];
    }

    // Ensure any locally stored tests created by this user are also synced to the backend server
    if (!isStaticHost() && localTests.length > 0) {
      const serverIds = new Set(serverTests.map(st => st.id));
      localTests.forEach(lt => {
        if (!serverIds.has(lt.id) && Array.isArray(lt.questions) && lt.questions.length > 0) {
          fetch('/api/tests/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: lt }),
          }).catch(() => {});
        }
      });
    }

    const combinedMap = new Map<string, any>();
    [...serverTests, ...localTests].forEach(t => {
      if (!t || !t.id) return;
      const matchesUser = normUname
        ? (t.creatorUsername &&
            t.creatorUsername.toLowerCase().trim().replace(/^@/, '') === normUname) ||
          (userUid && t.creatorUid === userUid)
        : userUid
        ? t.creatorUid === userUid
        : false;
      if (!matchesUser) return;

      const localSubCount = getStoredSubmissions(t.id, t.title).length;
      const existing = combinedMap.get(t.id);
      combinedMap.set(t.id, {
        id: t.id,
        slug: t.slug || slugifyTitle(t.title),
        title: t.title,
        subject: t.subject,
        instructions: t.instructions,
        totalMarks: t.totalMarks,
        timeLimitMinutes: t.timeLimitMinutes,
        questionCount: Array.isArray(t.questions)
          ? t.questions.length
          : t.questionCount || existing?.questionCount || 0,
        questions:
          Array.isArray(t.questions) && t.questions.length > 0
            ? t.questions
            : existing?.questions || [],
        createdAt: t.createdAt || existing?.createdAt || new Date().toISOString(),
        creatorName: t.creatorName || existing?.creatorName,
        creatorUsername: t.creatorUsername || existing?.creatorUsername,
        creatorUid: t.creatorUid || existing?.creatorUid,
        submissionCount: Math.max(
          Number(t.submissionCount) || 0,
          Number(existing?.submissionCount) || 0,
          localSubCount
        ),
      });
    });

    return Array.from(combinedMap.values());
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
      localTests.find(
        t =>
          t.id.toLowerCase() === cleanId.toLowerCase() ||
          (t.slug && t.slug.toLowerCase() === cleanId.toLowerCase()) ||
          slugifyTitle(t.title) === targetSlug
      ) || decodedTest;

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
    const normName = name.trim().toLowerCase();
    const normRoll = rollNo.trim().toLowerCase();

    if (!isStaticHost()) {
      try {
        const res = await fetch(
          `/api/tests/${encodeURIComponent(testId)}/check-student?name=${encodeURIComponent(
            name
          )}&rollNo=${encodeURIComponent(rollNo)}`
        );
        if (res.ok) {
          const serverCheck = await res.json();
          if (serverCheck && serverCheck.hasAttempted) {
            return serverCheck;
          }
        }
      } catch {
        // Fallback to cloud & local
      }
    }

    const cloudSubs = await fetchSubmissionsFromCloud(testId).catch(() => []);
    cloudSubs.forEach(cs => saveLocalSubmission(testId, cs));

    const subs = getStoredSubmissions(testId);
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

    const localTests = getStoredLocalTests();
    const cleanId = decodeURIComponent(testId).trim().toLowerCase();
    const targetSlug = slugifyTitle(cleanId);
    const localOrDecodedTest =
      localTests.find(
        t =>
          t.id.toLowerCase() === cleanId ||
          (t.slug && t.slug.toLowerCase() === cleanId) ||
          slugifyTitle(t.title) === targetSlug
      ) || decodedTest;

    if (!isStaticHost()) {
      try {
        if (localOrDecodedTest) {
          await fetch('/api/tests/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: localOrDecodedTest }),
          }).catch(() => {});
        }

        const res = await fetch(`/api/tests/${encodeURIComponent(testId)}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            test: localOrDecodedTest || undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.submission) {
            saveLocalSubmission(testId, data.submission);
            await publishSubmissionToCloud(data.submission);
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
    const test = localOrDecodedTest;

    if (!test) {
      throw new Error('Test not found for evaluation.');
    }

    const priorSubmissions = getStoredSubmissions(test.id, test.title);
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
    const answersList: any[] = [];
    if (Array.isArray(payload.answers)) {
      payload.answers.forEach((ans: any, idx: number) => {
        answersMap.set(ans.questionId, ans);
        answersList[idx] = ans;
      });
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

    test.questions.forEach((q, qIndex) => {
      const ans = answersMap.get(q.id) || answersMap.get(`q_${qIndex + 1}`) || answersList[qIndex];
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
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
    await publishSubmissionToCloud(submission);

    if (!isStaticHost()) {
      fetch('/api/submissions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: test.id, submission, test }),
      }).catch(() => {});
    }

    return submission;
  },

  // Get submissions for a test (merges Server + Cloud Sync + LocalStorage across all devices/emails)
  async getSubmissions(testId: string, testTitle?: string): Promise<TestSubmission[]> {
    const localTests = getStoredLocalTests();
    const cleanId = decodeURIComponent(testId).trim().toLowerCase();
    const targetSlug = slugifyTitle(cleanId);
    const matchedTest = localTests.find(
      t =>
        t.id.toLowerCase() === cleanId ||
        (t.slug && t.slug.toLowerCase() === cleanId) ||
        slugifyTitle(t.title) === targetSlug
    );
    const resolvedTitle = testTitle || matchedTest?.title;

    const serverPromise = !isStaticHost()
      ? fetch(`/api/tests/${encodeURIComponent(testId)}/submissions`)
          .then(async res => {
            if (res.ok) {
              const data = await res.json();
              if (data && Array.isArray(data.submissions)) {
                return data.submissions as TestSubmission[];
              }
            }
            return [] as TestSubmission[];
          })
          .catch(() => [] as TestSubmission[])
      : Promise.resolve([] as TestSubmission[]);

    const cloudPromise = fetchSubmissionsFromCloud(testId, resolvedTitle).catch(
      () => [] as TestSubmission[]
    );

    const [serverSubs, cloudSubs] = await Promise.all([serverPromise, cloudPromise]);
    const localSubs = getStoredSubmissions(testId, resolvedTitle);

    const merged = deduplicateSubmissions([...serverSubs, ...cloudSubs, ...localSubs]);

    // Persist any newly discovered cloud or server submissions into localStorage and server
    if (merged.length > 0) {
      merged.forEach(sub => {
        saveLocalSubmission(testId, sub);
        if (!isStaticHost() && !serverSubs.some(s => s.id === sub.id)) {
          fetch('/api/submissions/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ testId, submission: sub, test: matchedTest }),
          }).catch(() => {});
        }
      });
    }

    return merged;
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
