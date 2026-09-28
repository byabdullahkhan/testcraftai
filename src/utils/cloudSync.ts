import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from '../firebase';
import { Test, Question, TestSubmission, QuestionEvaluation, TheoryFeedback } from '../types';
import { slugifyTitle } from './urlHelper';

const NTFY_BASE_URL = 'https://ntfy.sh';
const GLOBAL_SUBS_TOPIC = 'tc_v7_sub_global_stream';
const GLOBAL_TESTS_TOPIC = 'tc_v7_test_global_catalog';
const SYNCED_TESTS_STORAGE_KEY = 'testcraft_v7_cloud_synced_tests_map';
const BroadcastChannelName = 'testcraft_v7_realtime_submissions';

function cleanTopicKey(str: string): string {
  if (!str) return 'default';
  return (
    slugifyTitle(str)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 42) || 'default'
  );
}

export function toValidFirestoreId(raw: string, fallback = 'item'): string {
  if (!raw) return fallback;
  const cleaned = slugifyTitle(raw)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return cleaned || fallback;
}

export function getDeterministicAttemptId(
  testId: string,
  studentName: string,
  rollNo?: string
): string {
  const testPart = toValidFirestoreId(testId, 'test').slice(0, 45);
  const studentKey = rollNo && rollNo.trim() ? rollNo.trim() : studentName.trim();
  const studentPart = toValidFirestoreId(studentKey, 'student').slice(0, 55);
  return `att_${testPart}_${studentPart}`;
}

export function getTestCloudTopic(testIdOrSlug: string): string {
  return `tc_v7_sub_${cleanTopicKey(testIdOrSlug)}`;
}

// Recursively strip undefined values so Firestore never rejects a document
function stripUndefined<T>(val: T): T {
  if (Array.isArray(val)) {
    return val.map(item => stripUndefined(item)) as unknown as T;
  }
  if (val !== null && typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return val;
}

function sanitizeTestForFirestore(test: Test, uid: string): Record<string, any> {
  const validSlug = toValidFirestoreId(test.slug || test.id || test.title, 'test');
  const cleanQuestions = (test.questions || []).slice(0, 200).map((q, idx) => {
    const base: Record<string, any> = {
      id: String(q.id || `q_${idx + 1}`).slice(0, 120),
      type: q.type === 'mcq' || q.type === 'true_false' || q.type === 'theory' ? q.type : 'mcq',
      questionText: String(q.questionText || `Question ${idx + 1}`).slice(0, 4000),
      marks: Math.max(0, Math.min(1000, Number(q.marks) || 1)),
    };
    if (q.type === 'mcq') {
      base.options = Array.isArray(q.options)
        ? q.options.map((o, oIdx) => ({
            id: String(o.id || `opt_${oIdx + 1}`),
            text: String(o.text || ''),
          }))
        : [];
      base.correctOptionIds = Array.isArray(q.correctOptionIds)
        ? q.correctOptionIds.map(String)
        : [];
      base.partialMarkingRule = q.partialMarkingRule === 'zero' ? 'zero' : 'half';
    } else if (q.type === 'true_false') {
      base.correctBoolean = q.correctBoolean !== false;
    } else {
      base.modelAnswer = String(q.modelAnswer || '').slice(0, 5000);
    }
    return base;
  });

  return stripUndefined({
    id: validSlug,
    slug: validSlug,
    title: String(test.title || 'Untitled Test').slice(0, 300),
    subject: String(test.subject || 'General').slice(0, 200),
    instructions: String(test.instructions || '').slice(0, 5000),
    timeLimitMinutes:
      test.timeLimitMinutes !== null && test.timeLimitMinutes !== undefined
        ? Math.max(0, Math.min(1440, Number(test.timeLimitMinutes) || 0))
        : null,
    totalMarks: Math.max(0, Math.min(10000, Number(test.totalMarks) || 0)),
    createdAt: String(test.createdAt || new Date().toISOString()).slice(0, 64),
    creatorUid: String(uid).slice(0, 128),
    creatorName: String(test.creatorName || auth.currentUser?.displayName || 'Instructor').slice(
      0,
      200
    ),
    creatorUsername: String(test.creatorUsername || '').slice(0, 128),
    creatorEmail: String(test.creatorEmail || auth.currentUser?.email || '').slice(0, 200),
    questions: cleanQuestions,
  });
}

function sanitizeSubmissionForFirestore(
  sub: TestSubmission,
  testDocId: string,
  subDocId: string
): Record<string, any> {
  const cleanEvaluations = (sub.evaluations || []).slice(0, 200).map((ev, idx) => {
    const item: Record<string, any> = {
      questionId: String(ev.questionId || `q_${idx + 1}`),
      questionType: ev.questionType || 'mcq',
      questionText: String(ev.questionText || ''),
      marksAwarded: Number(ev.marksAwarded) || 0,
      maxMarks: Number(ev.maxMarks) || 1,
      status: ev.status || 'wrong',
      studentAnswerDisplay: String(ev.studentAnswerDisplay || ''),
      correctAnswerDisplay: String(ev.correctAnswerDisplay || ''),
    };
    if (ev.theoryFeedback) {
      item.theoryFeedback = {
        conceptMatchPercentage: Number(ev.theoryFeedback.conceptMatchPercentage) || 0,
        accuracyScore: Number(ev.theoryFeedback.accuracyScore) || 0,
        conceptualVerdict: String(ev.theoryFeedback.conceptualVerdict || ''),
        strengths: String(ev.theoryFeedback.strengths || ''),
        missingPoints: String(ev.theoryFeedback.missingPoints || ''),
        rubricNotes: String(ev.theoryFeedback.rubricNotes || ''),
      };
    }
    return item;
  });

  return stripUndefined({
    id: subDocId,
    testId: testDocId,
    testTitle: String(sub.testTitle || '').slice(0, 300),
    subject: String(sub.subject || '').slice(0, 200),
    studentName: String(sub.studentName || 'Student').slice(0, 200),
    studentIdentifier: String(sub.studentIdentifier || '').slice(0, 128),
    submittedAt: String(sub.submittedAt || new Date().toISOString()).slice(0, 64),
    timeSpentSeconds: Math.max(0, Math.min(86400, Number(sub.timeSpentSeconds) || 0)),
    totalScore: Math.max(0, Math.min(10000, Number(sub.totalScore) || 0)),
    maxScore: Math.max(0, Math.min(10000, Number(sub.maxScore) || 0)),
    percentage: Math.max(0, Math.min(100, Number(sub.percentage) || 0)),
    grade: String(sub.grade || 'F').slice(0, 16),
    passed: Boolean(sub.passed),
    evaluations: cleanEvaluations,
  });
}

function encodeSubmissionCompact(sub: TestSubmission): string {
  const compact = {
    _tc: 1,
    s: [
      sub.id,
      sub.testId,
      sub.testTitle || '',
      sub.subject || '',
      sub.studentName,
      sub.studentIdentifier || '',
      sub.submittedAt,
      sub.timeSpentSeconds || 0,
      sub.totalScore,
      sub.maxScore,
      sub.percentage,
      sub.grade,
      sub.passed ? 1 : 0,
      (sub.evaluations || []).map(ev => [
        ev.questionId,
        ev.questionType === 'mcq' ? 0 : ev.questionType === 'true_false' ? 1 : 2,
        ev.questionText || '',
        ev.marksAwarded,
        ev.maxMarks,
        ev.status === 'correct' ? 2 : ev.status === 'partial' ? 1 : 0,
        ev.studentAnswerDisplay || '',
        ev.correctAnswerDisplay || '',
        ev.theoryFeedback
          ? [
              ev.theoryFeedback.conceptMatchPercentage,
              ev.theoryFeedback.accuracyScore,
              ev.theoryFeedback.conceptualVerdict || '',
              ev.theoryFeedback.strengths || '',
              ev.theoryFeedback.missingPoints || '',
              ev.theoryFeedback.rubricNotes || '',
            ]
          : null,
      ]),
    ],
  };
  return JSON.stringify(compact);
}

function decodeSubmissionCompact(rawObj: any): TestSubmission | null {
  try {
    if (!rawObj) return null;
    if (rawObj.id && rawObj.studentName && Array.isArray(rawObj.evaluations)) {
      return rawObj as TestSubmission;
    }
    if (rawObj._tc === 1 && Array.isArray(rawObj.s)) {
      const [
        id,
        testId,
        testTitle,
        subject,
        studentName,
        studentIdentifier,
        submittedAt,
        timeSpentSeconds,
        totalScore,
        maxScore,
        percentage,
        grade,
        passedBit,
        rawEvals,
      ] = rawObj.s;

      const evaluations: QuestionEvaluation[] = Array.isArray(rawEvals)
        ? rawEvals.map((re: any, idx: number) => {
            const qTypeNum = re[1];
            const statusNum = re[5];
            const tfRaw = re[8];
            let theoryFeedback: TheoryFeedback | undefined = undefined;
            if (Array.isArray(tfRaw)) {
              theoryFeedback = {
                conceptMatchPercentage: Number(tfRaw[0]) || 0,
                accuracyScore: Number(tfRaw[1]) || 0,
                conceptualVerdict: String(tfRaw[2] || ''),
                strengths: String(tfRaw[3] || ''),
                missingPoints: String(tfRaw[4] || ''),
                rubricNotes: String(tfRaw[5] || ''),
              };
            }
            return {
              questionId: String(re[0] || `q_${idx + 1}`),
              questionType: qTypeNum === 0 ? 'mcq' : qTypeNum === 1 ? 'true_false' : 'theory',
              questionText: String(re[2] || ''),
              marksAwarded: Number(re[3]) || 0,
              maxMarks: Number(re[4]) || 1,
              status: statusNum === 2 ? 'correct' : statusNum === 1 ? 'partial' : 'wrong',
              studentAnswerDisplay: String(re[6] || ''),
              correctAnswerDisplay: String(re[7] || ''),
              ...(theoryFeedback ? { theoryFeedback } : {}),
            };
          })
        : [];

      return {
        id: String(id),
        testId: String(testId),
        testTitle: String(testTitle || ''),
        subject: String(subject || ''),
        studentName: String(studentName || 'Student'),
        studentIdentifier: String(studentIdentifier || ''),
        submittedAt: String(submittedAt || new Date().toISOString()),
        timeSpentSeconds: Number(timeSpentSeconds) || 0,
        totalScore: Number(totalScore) || 0,
        maxScore: Number(maxScore) || 0,
        percentage: Number(percentage) || 0,
        grade: String(grade || 'F'),
        passed: Boolean(passedBit),
        evaluations,
      };
    }
  } catch (e) {
    console.warn('Failed to decode cloud submission:', e);
  }
  return null;
}

async function postToTopic(topic: string, serialized: string, chunkId: string): Promise<void> {
  const MAX_CHUNK = 3400;
  try {
    if (serialized.length <= MAX_CHUNK) {
      await fetch(`${NTFY_BASE_URL}/${topic}`, {
        method: 'POST',
        body: serialized,
      });
      return;
    }

    const total = Math.ceil(serialized.length / MAX_CHUNK);
    for (let i = 0; i < total; i++) {
      const part = serialized.slice(i * MAX_CHUNK, (i + 1) * MAX_CHUNK);
      const chunkPayload = JSON.stringify({
        _tcChunk: chunkId,
        idx: i,
        total,
        d: part,
      });
      await fetch(`${NTFY_BASE_URL}/${topic}`, {
        method: 'POST',
        body: chunkPayload,
      });
    }
  } catch (e) {
    console.warn(`Cloud sync post warning (${topic}):`, e);
  }
}

/**
 * Checks in Cloud Firestore if a student has already submitted this test.
 */
export async function checkStudentAttemptInFirestore(
  testId: string,
  studentName: string,
  rollNo: string
): Promise<TestSubmission | null> {
  const testDocId = toValidFirestoreId(testId, 'test');
  const attemptId = getDeterministicAttemptId(testDocId, studentName, rollNo);
  try {
    const snap = await getDoc(doc(db, 'tests', testDocId, 'submissions', attemptId));
    if (snap.exists()) {
      return snap.data() as TestSubmission;
    }
    if (rollNo && rollNo.trim()) {
      // Also check by student name alone
      const nameAttemptId = getDeterministicAttemptId(testDocId, studentName, '');
      const nameSnap = await getDoc(doc(db, 'tests', testDocId, 'submissions', nameAttemptId));
      if (nameSnap.exists()) {
        return nameSnap.data() as TestSubmission;
      }
    }
  } catch {}
  return null;
}

/**
 * Publishes a graded student submission to Cloud Firestore, ntfy cloud stream,
 * and local browser BroadcastChannel.
 */
export async function publishSubmissionToCloud(submission: TestSubmission): Promise<void> {
  if (!submission || !submission.id) return;

  // 1. Broadcast immediately to any open tabs on the same browser
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BroadcastChannelName);
      bc.postMessage({ type: 'NEW_SUBMISSION', submission });
      bc.close();
    }
  } catch {}

  // 2. Save permanently to Cloud Firestore under /tests/{testId}/submissions/{deterministicId}
  const testDocId = toValidFirestoreId(submission.testId || submission.testTitle || 'test', 'test');
  const deterministicId = getDeterministicAttemptId(
    testDocId,
    submission.studentName,
    submission.studentIdentifier
  );

  try {
    const cleanPayload = sanitizeSubmissionForFirestore(submission, testDocId, deterministicId);
    await setDoc(doc(db, 'tests', testDocId, 'submissions', deterministicId), cleanPayload);
  } catch (e) {
    console.warn('Firestore submission write warning (falling back to secondary stream):', e);
  }

  // 3. Publish to secondary cloud stream so reports sync even before Firestore rules or test doc sync
  const serialized = encodeSubmissionCompact(submission);
  const topics = new Set<string>();
  if (submission.testId) {
    topics.add(getTestCloudTopic(submission.testId));
  }
  if (submission.testTitle) {
    topics.add(getTestCloudTopic(submission.testTitle));
  }
  topics.add(GLOBAL_SUBS_TOPIC);

  await Promise.allSettled(
    Array.from(topics).map(topic => postToTopic(topic, serialized, submission.id))
  );
}

function parseNtfyLinesToSubmissions(ndjsonText: string): TestSubmission[] {
  if (!ndjsonText || !ndjsonText.trim()) return [];
  const lines = ndjsonText.split('\n').filter(Boolean);
  const directSubmissions: TestSubmission[] = [];
  const chunkGroups = new Map<string, { total: number; parts: Map<number, string> }>();

  for (const line of lines) {
    try {
      const eventObj = JSON.parse(line);
      if (eventObj.event !== 'message' || typeof eventObj.message !== 'string') continue;
      const inner = JSON.parse(eventObj.message);
      if (!inner) continue;

      if (inner._tcChunk && typeof inner.idx === 'number' && typeof inner.total === 'number') {
        const group = chunkGroups.get(inner._tcChunk) || {
          total: inner.total,
          parts: new Map<number, string>(),
        };
        group.parts.set(inner.idx, String(inner.d || ''));
        chunkGroups.set(inner._tcChunk, group);
      } else {
        const decoded = decodeSubmissionCompact(inner);
        if (decoded) {
          directSubmissions.push(decoded);
        }
      }
    } catch {}
  }

  for (const [, group] of chunkGroups.entries()) {
    if (group.parts.size === group.total) {
      let fullStr = '';
      let complete = true;
      for (let i = 0; i < group.total; i++) {
        if (!group.parts.has(i)) {
          complete = false;
          break;
        }
        fullStr += group.parts.get(i);
      }
      if (complete) {
        try {
          const parsed = JSON.parse(fullStr);
          const decoded = decodeSubmissionCompact(parsed);
          if (decoded) {
            directSubmissions.push(decoded);
          }
        } catch {}
      }
    }
  }

  return directSubmissions;
}

export function doesSubmissionMatchTest(
  sub: TestSubmission,
  testId: string,
  testTitle?: string
): boolean {
  if (!sub) return false;
  const targetIdRaw = (testId || '').trim().toLowerCase();
  const targetIdSlug = slugifyTitle(testId || '');
  const targetTitleSlug = testTitle ? slugifyTitle(testTitle) : '';

  const subIdRaw = (sub.testId || '').trim().toLowerCase();
  const subIdSlug = slugifyTitle(sub.testId || '');
  const subTitleSlug = slugifyTitle(sub.testTitle || '');

  if (targetIdRaw && subIdRaw === targetIdRaw) return true;
  if (targetIdSlug && (subIdSlug === targetIdSlug || subTitleSlug === targetIdSlug)) return true;
  if (targetTitleSlug && (subIdSlug === targetTitleSlug || subTitleSlug === targetTitleSlug)) {
    return true;
  }
  return false;
}

/**
 * Fetches all student submissions for a test from Cloud Firestore + secondary stream.
 */
export async function fetchSubmissionsFromCloud(
  testId: string,
  testTitle?: string
): Promise<TestSubmission[]> {
  const mapByKey = new Map<string, TestSubmission>();
  const addUnique = (sub: TestSubmission) => {
    if (!sub) return;
    const dedupeKey = `${(sub.studentName || '').trim().toLowerCase()}_${(
      sub.studentIdentifier || ''
    )
      .trim()
      .toLowerCase()}`;
    mapByKey.set(dedupeKey || sub.id, sub);
  };

  // 1. Fetch from Cloud Firestore if teacher is authenticated
  if (auth.currentUser && testId) {
    const testDocId = toValidFirestoreId(testId, 'test');
    try {
      const snap = await getDocs(collection(db, 'tests', testDocId, 'submissions'));
      snap.forEach(docSnap => {
        const data = docSnap.data() as TestSubmission;
        if (data && data.studentName) {
          addUnique(data);
        }
      });
    } catch {}
  }

  // 2. Also merge from secondary real-time stream
  const topics = new Set<string>();
  if (testId) topics.add(getTestCloudTopic(testId));
  if (testTitle) topics.add(getTestCloudTopic(testTitle));
  topics.add(GLOBAL_SUBS_TOPIC);

  const results = await Promise.allSettled(
    Array.from(topics).map(async topic => {
      const res = await fetch(`${NTFY_BASE_URL}/${topic}/json?poll=1&since=all`, {
        cache: 'no-store',
      });
      if (!res.ok) return [];
      const text = await res.text();
      return parseNtfyLinesToSubmissions(text);
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const sub of r.value) {
        if (doesSubmissionMatchTest(sub, testId, testTitle)) {
          addUnique(sub);
        }
      }
    }
  }

  return Array.from(mapByKey.values());
}

/**
 * Subscribes to live submission events for a test via Cloud Firestore onSnapshot,
 * BroadcastChannel, and SSE.
 */
export function subscribeToLiveSubmissions(
  testId: string,
  testTitle: string | undefined,
  onReceive: (sub: TestSubmission) => void
): () => void {
  const cleanups: Array<() => void> = [];

  // 1. Cloud Firestore Real-Time onSnapshot Listener (when teacher is signed in)
  try {
    if (auth.currentUser && testId) {
      const testDocId = toValidFirestoreId(testId, 'test');
      const unsubFirestore = onSnapshot(
        collection(db, 'tests', testDocId, 'submissions'),
        snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added' || change.type === 'modified') {
              const data = change.doc.data() as TestSubmission;
              if (data && data.studentName) {
                onReceive(data);
              }
            }
          });
        },
        () => {
          // Ignore snapshot permission error if user does not own this test in Firestore yet
        }
      );
      cleanups.push(unsubFirestore);
    }
  } catch {}

  // 2. Same-browser BroadcastChannel listener
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BroadcastChannelName);
      bc.onmessage = ev => {
        const sub = ev.data?.submission as TestSubmission | undefined;
        if (sub && doesSubmissionMatchTest(sub, testId, testTitle)) {
          onReceive(sub);
        }
      };
      cleanups.push(() => bc.close());
    }
  } catch {}

  // 3. Real-time Server-Sent Events (SSE) fallback
  try {
    if (typeof EventSource !== 'undefined' && testId) {
      const topic = getTestCloudTopic(testId);
      const es = new EventSource(`${NTFY_BASE_URL}/${topic}/sse`);
      es.onmessage = ev => {
        try {
          const parsed = JSON.parse(ev.data);
          const sub = decodeSubmissionCompact(parsed);
          if (sub && doesSubmissionMatchTest(sub, testId, testTitle)) {
            onReceive(sub);
          }
        } catch {}
      };
      cleanups.push(() => es.close());
    }
  } catch {}

  return () => {
    cleanups.forEach(fn => {
      try {
        fn();
      } catch {}
    });
  };
}

// ============================================================================
// CLOUD TEST DEFINITION SYNC (Cloud Firestore + Short Link Mirror)
// ============================================================================

export function getTestDefinitionCloudTopic(testIdOrSlug: string): string {
  return `tc_v7_test_${cleanTopicKey(testIdOrSlug)}`;
}

function encodeTestCompact(test: Test): string {
  const slug = test.slug || slugifyTitle(test.title || test.id || 'test');
  const id = test.id || slug;
  const compact = {
    _tcTest: 1,
    t: [
      id,
      slug,
      test.title || 'Test',
      test.subject || 'General',
      test.instructions || '',
      test.timeLimitMinutes ?? null,
      test.totalMarks || 0,
      test.createdAt || new Date().toISOString(),
      test.creatorName || 'Instructor',
      test.creatorUsername || '',
      test.creatorUid || '',
      test.creatorEmail || '',
      (test.questions || []).map(q => [
        q.id,
        q.type === 'mcq' ? 0 : q.type === 'true_false' ? 1 : 2,
        q.questionText || '',
        Number(q.marks) || 1,
        q.options || [],
        q.correctOptionIds || [],
        q.partialMarkingRule === 'zero' ? 0 : 1,
        q.correctBoolean === false ? 0 : 1,
        q.modelAnswer || '',
      ]),
    ],
  };
  return JSON.stringify(compact);
}

function decodeTestCompact(rawObj: any): Test | null {
  try {
    if (!rawObj) return null;
    if (rawObj.id && rawObj.title && Array.isArray(rawObj.questions)) {
      return rawObj as Test;
    }
    if (rawObj._tcTest === 1 && Array.isArray(rawObj.t)) {
      const [
        id,
        slug,
        title,
        subject,
        instructions,
        timeLimitMinutes,
        totalMarks,
        createdAt,
        creatorName,
        creatorUsername,
        creatorUid,
        creatorEmail,
        rawQuestions,
      ] = rawObj.t;

      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) return null;

      let calcMarks = 0;
      const questions: Question[] = rawQuestions.map((rq: any, idx: number) => {
        const qId = String(rq[0] || `q_${idx + 1}`);
        const qTypeNum = rq[1];
        const questionText = String(rq[2] || `Question ${idx + 1}`);
        const marks = Number(rq[3]) || 1;
        calcMarks += marks;

        if (qTypeNum === 0) {
          return {
            id: qId,
            type: 'mcq',
            questionText,
            marks,
            options: Array.isArray(rq[4]) ? rq[4] : [],
            correctOptionIds: Array.isArray(rq[5]) ? rq[5] : [],
            partialMarkingRule: rq[6] === 0 ? 'zero' : 'half',
          };
        }
        if (qTypeNum === 1) {
          return {
            id: qId,
            type: 'true_false',
            questionText,
            marks,
            correctBoolean: rq[7] !== 0,
          };
        }
        return {
          id: qId,
          type: 'theory',
          questionText,
          marks,
          modelAnswer: String(rq[8] || ''),
        };
      });

      const resolvedSlug = String(slug || slugifyTitle(String(title || id || 'test')));
      return {
        id: String(id || resolvedSlug),
        slug: resolvedSlug,
        title: String(title || 'Test'),
        subject: String(subject || 'General'),
        instructions: String(instructions || ''),
        timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
        totalMarks: Number(totalMarks) || calcMarks,
        createdAt: String(createdAt || new Date().toISOString()),
        creatorName: String(creatorName || 'Instructor'),
        creatorUsername: creatorUsername ? String(creatorUsername) : undefined,
        creatorUid: creatorUid ? String(creatorUid) : undefined,
        creatorEmail: creatorEmail ? String(creatorEmail) : undefined,
        questions,
      };
    }
  } catch (e) {
    console.warn('Failed to decode cloud test:', e);
  }
  return null;
}

const inFlightTestPublishes = new Set<string>();

function markTestSyncedLocally(testId: string, signature: string) {
  try {
    const raw = localStorage.getItem(SYNCED_TESTS_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[testId] = signature;
    localStorage.setItem(SYNCED_TESTS_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

function isTestSyncedLocally(testId: string, signature: string): boolean {
  try {
    const raw = localStorage.getItem(SYNCED_TESTS_STORAGE_KEY);
    if (!raw) return false;
    const map: Record<string, string> = JSON.parse(raw);
    return map[testId] === signature;
  } catch {
    return false;
  }
}

/**
 * Fetches all tests created by the signed-in Google user from Cloud Firestore.
 */
export async function fetchUserTestsFromFirestore(creatorUid: string): Promise<Test[]> {
  if (!creatorUid || !auth.currentUser || auth.currentUser.uid !== creatorUid) {
    return [];
  }
  try {
    const q = query(collection(db, 'tests'), where('creatorUid', '==', creatorUid));
    const snap = await getDocs(q);
    const list: Test[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data() as Test;
      if (data && data.id && data.title) {
        list.push(data);
      }
    });
    return list;
  } catch (e) {
    console.warn('Firestore user tests fetch warning:', e);
    return [];
  }
}

/**
 * Deletes a test from Cloud Firestore if owned by the current user.
 */
export async function deleteTestFromFirestore(testIdOrSlug: string): Promise<void> {
  if (!auth.currentUser || !testIdOrSlug) return;
  const testDocId = toValidFirestoreId(testIdOrSlug, 'test');
  try {
    await deleteDoc(doc(db, 'tests', testDocId));
  } catch (e) {
    console.warn('Firestore test delete warning:', e);
  }
}

/**
 * Deletes a submission from Cloud Firestore if owned by the current test creator.
 */
export async function deleteSubmissionFromFirestore(
  testId: string,
  submission: TestSubmission
): Promise<void> {
  if (!auth.currentUser || !testId || !submission) return;
  const testDocId = toValidFirestoreId(testId, 'test');
  const deterministicId = getDeterministicAttemptId(
    testDocId,
    submission.studentName,
    submission.studentIdentifier
  );
  try {
    await deleteDoc(doc(db, 'tests', testDocId, 'submissions', deterministicId));
    if (submission.id && submission.id !== deterministicId) {
      await deleteDoc(doc(db, 'tests', testDocId, 'submissions', toValidFirestoreId(submission.id)));
    }
  } catch {}
}

/**
 * Publishes a Test definition to Cloud Firestore + secondary stream so short links (?test=title)
 * work permanently on any device worldwide.
 */
export async function publishTestToCloud(test: Test): Promise<void> {
  if (!test || !Array.isArray(test.questions) || test.questions.length === 0) return;

  const testDocId = toValidFirestoreId(test.slug || test.id || test.title, 'test');

  // 1. Save permanently in Cloud Firestore if user is authenticated with Google
  if (auth.currentUser) {
    try {
      const cleanDoc = sanitizeTestForFirestore(test, auth.currentUser.uid);
      await setDoc(doc(db, 'tests', testDocId), cleanDoc);
    } catch (e) {
      console.warn('Firestore test publish warning:', e);
    }
  }

  // 2. Also publish to secondary cloud stream so even unauthenticated/offline sessions sync
  const serialized = encodeTestCompact(test);
  const testKey = test.id || test.slug || slugifyTitle(test.title);
  const topics = new Set<string>();

  if (test.id) topics.add(getTestDefinitionCloudTopic(test.id));
  if (test.slug) topics.add(getTestDefinitionCloudTopic(test.slug));
  if (test.title) topics.add(getTestDefinitionCloudTopic(test.title));
  topics.add(GLOBAL_TESTS_TOPIC);

  const chunkId = `test_${testKey}_${Date.now().toString(36)}`;
  await Promise.allSettled(
    Array.from(topics).map(topic => postToTopic(topic, serialized, chunkId))
  );

  const authMarker = auth.currentUser ? auth.currentUser.uid : 'anon';
  markTestSyncedLocally(
    testKey,
    `${authMarker}_${test.title}_${test.questions.length}_${test.totalMarks}`
  );
}

/**
 * Ensures an existing local test is synced to Cloud Firestore + secondary stream in the background.
 */
export function ensureTestPublishedToCloud(test: Test): void {
  if (!test || !Array.isArray(test.questions) || test.questions.length === 0) return;
  const testKey = test.id || test.slug || slugifyTitle(test.title);
  const authMarker = auth.currentUser ? auth.currentUser.uid : 'anon';
  const signature = `${authMarker}_${test.title}_${test.questions.length}_${test.totalMarks}`;

  if (isTestSyncedLocally(testKey, signature) || inFlightTestPublishes.has(testKey)) {
    return;
  }

  inFlightTestPublishes.add(testKey);
  publishTestToCloud(test)
    .catch(() => {})
    .finally(() => {
      inFlightTestPublishes.delete(testKey);
    });
}

function parseNtfyLinesToTests(ndjsonText: string): Test[] {
  if (!ndjsonText || !ndjsonText.trim()) return [];
  const lines = ndjsonText.split('\n').filter(Boolean);
  const directTests: Test[] = [];
  const chunkGroups = new Map<string, { total: number; parts: Map<number, string> }>();

  for (const line of lines) {
    try {
      const eventObj = JSON.parse(line);
      if (eventObj.event !== 'message' || typeof eventObj.message !== 'string') continue;
      const inner = JSON.parse(eventObj.message);
      if (!inner) continue;

      if (inner._tcChunk && typeof inner.idx === 'number' && typeof inner.total === 'number') {
        const group = chunkGroups.get(inner._tcChunk) || {
          total: inner.total,
          parts: new Map<number, string>(),
        };
        group.parts.set(inner.idx, String(inner.d || ''));
        chunkGroups.set(inner._tcChunk, group);
      } else {
        const decoded = decodeTestCompact(inner);
        if (decoded) {
          directTests.push(decoded);
        }
      }
    } catch {}
  }

  for (const [, group] of chunkGroups.entries()) {
    if (group.parts.size === group.total) {
      let fullStr = '';
      let complete = true;
      for (let i = 0; i < group.total; i++) {
        if (!group.parts.has(i)) {
          complete = false;
          break;
        }
        fullStr += group.parts.get(i);
      }
      if (complete) {
        try {
          const parsed = JSON.parse(fullStr);
          const decoded = decodeTestCompact(parsed);
          if (decoded) {
            directTests.push(decoded);
          }
        } catch {}
      }
    }
  }

  return directTests;
}

/**
 * Fetches a Test definition from Cloud Firestore first, then falls back to secondary cloud stream.
 */
export async function fetchTestFromCloud(testIdOrSlug: string): Promise<Test | null> {
  if (!testIdOrSlug || !testIdOrSlug.trim()) return null;
  const cleanId = decodeURIComponent(testIdOrSlug).trim();
  const targetSlug = slugifyTitle(cleanId);
  const firestoreDocId = toValidFirestoreId(cleanId, 'test');

  // 1. Primary lookup in Cloud Firestore (works for any student without signing in!)
  try {
    const snap = await getDoc(doc(db, 'tests', firestoreDocId));
    if (snap.exists()) {
      const data = snap.data() as Test;
      if (data && Array.isArray(data.questions) && data.questions.length > 0) {
        return data;
      }
    }
  } catch {}

  // 2. Fallback lookup in secondary stream
  const topics = [getTestDefinitionCloudTopic(cleanId), GLOBAL_TESTS_TOPIC];
  const results = await Promise.allSettled(
    topics.map(async topic => {
      const res = await fetch(`${NTFY_BASE_URL}/${topic}/json?poll=1&since=all`, {
        cache: 'no-store',
      });
      if (!res.ok) return [];
      const text = await res.text();
      return parseNtfyLinesToTests(text);
    })
  );

  const candidates: Test[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const t of r.value) {
        const tIdSlug = slugifyTitle(t.id || '');
        const tSlug = slugifyTitle(t.slug || '');
        const tTitleSlug = slugifyTitle(t.title || '');
        if (
          t.id.toLowerCase() === cleanId.toLowerCase() ||
          tIdSlug === targetSlug ||
          tSlug === targetSlug ||
          tTitleSlug === targetSlug
        ) {
          candidates.push(t);
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1];
}
