import { TestSubmission, QuestionEvaluation, TheoryFeedback } from '../types';
import { slugifyTitle } from './urlHelper';

const NTFY_BASE_URL = 'https://ntfy.sh';
const GLOBAL_SUBS_TOPIC = 'tc_v7_sub_global_stream';
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

export function getTestCloudTopic(testIdOrSlug: string): string {
  return `tc_v7_sub_${cleanTopicKey(testIdOrSlug)}`;
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
 * Publishes a graded student submission to the real-time cross-device cloud store
 * and broadcasts it across local browser tabs.
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

  // 2. Publish to cloud topics so test maker sees report across any device/email/browser
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
 * Fetches all student submissions for a test from the cross-device cloud store.
 */
export async function fetchSubmissionsFromCloud(
  testId: string,
  testTitle?: string
): Promise<TestSubmission[]> {
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

  const mapById = new Map<string, TestSubmission>();
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const sub of r.value) {
        if (doesSubmissionMatchTest(sub, testId, testTitle)) {
          mapById.set(sub.id, sub);
        }
      }
    }
  }

  return Array.from(mapById.values());
}

/**
 * Subscribes to live submission events for a test (via BroadcastChannel + SSE).
 */
export function subscribeToLiveSubmissions(
  testId: string,
  testTitle: string | undefined,
  onReceive: (sub: TestSubmission) => void
): () => void {
  const cleanups: Array<() => void> = [];

  // 1. Same-browser BroadcastChannel listener
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

  // 2. Real-time Server-Sent Events (SSE) from ntfy.sh
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
