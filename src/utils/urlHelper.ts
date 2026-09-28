import { Test, Question } from '../types';
import { ensureTestPublishedToCloud } from './cloudSync';

const LOCAL_TESTS_KEY = 'testcraft_local_tests_v7_clean';
const DEFAULT_INSTRUCTIONS =
  'Read each question attentively. Note questions with multiple correct choices. Submit before the timer expires.';

export function getPublicBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  let origin = window.location.origin;
  const pathname = window.location.pathname || '';

  // Convert AI Studio private dev URL (ais-dev-) to public shared URL (ais-pre-)
  // so links work across different Google accounts and devices
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }

  // Support GitHub Pages subpaths (e.g., https://user.github.io/repo-name/)
  if (window.location.hostname.includes('github.io')) {
    const cleanPath = pathname
      .replace(/\/test\/.*$/, '')
      .replace(/\/index\.html$/, '')
      .replace(/\/+$/, '');
    return `${origin}${cleanPath}`;
  }

  return origin;
}

/**
 * Converts a test title into a clean, URL-safe slug.
 */
export function slugifyTitle(title: string): string {
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

export function getTestSlug(
  testId: string,
  testInfo?: string | { title?: string; slug?: string }
): string {
  let slug = '';
  if (typeof testInfo === 'string' && testInfo.trim()) {
    slug = slugifyTitle(testInfo);
  } else if (testInfo && typeof testInfo === 'object') {
    if (testInfo.slug) {
      slug = testInfo.slug;
    } else if (testInfo.title) {
      slug = slugifyTitle(testInfo.title);
    }
  }

  if (!slug) {
    slug = slugifyTitle(testId);
  }
  return slug;
}

function toBase64Url(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

function fromBase64Url(b64url: string): string {
  try {
    let b64 = b64url.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

/**
 * Encodes a Test object into a compact URL-safe token so the link works on any device/browser/email.
 */
export function encodeTestToUrlParam(test: Test): string {
  if (!test || !Array.isArray(test.questions) || test.questions.length === 0) return '';
  try {
    const compactQuestions = test.questions.map(q => {
      if (q.type === 'mcq') {
        const opts = q.options || [];
        const optTexts = opts.map(o => o.text);
        const correctIndices = (q.correctOptionIds || [])
          .map(cid => opts.findIndex(o => o.id === cid))
          .filter(idx => idx >= 0);
        return [
          0,
          q.questionText,
          q.marks,
          optTexts,
          correctIndices.length > 0 ? correctIndices : [0],
          q.partialMarkingRule === 'zero' ? 0 : 1,
        ];
      }
      if (q.type === 'true_false') {
        return [1, q.questionText, q.marks, q.correctBoolean ? 1 : 0];
      }
      return [2, q.questionText, q.marks, q.modelAnswer || ''];
    });

    const compactPayload = [
      test.id || slugifyTitle(test.title),
      test.title || 'Test',
      test.subject || 'General',
      test.instructions === DEFAULT_INSTRUCTIONS ? 0 : test.instructions || '',
      test.timeLimitMinutes ?? null,
      test.creatorName || 'Instructor',
      test.creatorUsername || '',
      compactQuestions,
      test.creatorUid || '',
    ];

    return toBase64Url(JSON.stringify(compactPayload));
  } catch (e) {
    console.warn('Failed to encode test for URL:', e);
    return '';
  }
}

/**
 * Decodes a compact URL token back into a complete Test object on any device.
 */
export function decodeTestFromUrlParam(encoded: string): Test | null {
  if (!encoded || !encoded.trim()) return null;
  try {
    let cleaned = encoded.trim();
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch {}
    const jsonStr = fromBase64Url(cleaned);
    if (!jsonStr) return null;
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data) || data.length < 8) return null;

    const [
      rawId,
      title,
      subject,
      rawInstructions,
      timeLimitMinutes,
      creatorName,
      creatorUsername,
      rawQuestions,
      creatorUid,
    ] = data;

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) return null;

    let totalMarks = 0;
    const questions: Question[] = rawQuestions.map((rq: any, idx: number) => {
      const qTypeNum = rq[0];
      const questionText = String(rq[1] || `Question ${idx + 1}`);
      const marks = Number(rq[2]) || 1;
      totalMarks += marks;
      const qId = `q_${idx + 1}`;

      if (qTypeNum === 0) {
        const optTexts: string[] = Array.isArray(rq[3]) ? rq[3] : ['Option 1', 'Option 2'];
        const correctIndices: number[] = Array.isArray(rq[4]) ? rq[4] : [0];
        const partialBit = rq[5];
        const options = optTexts.map((text, oIdx) => ({
          id: `opt_${idx + 1}_${oIdx + 1}`,
          text: String(text),
        }));
        const correctOptionIds = correctIndices
          .map(cIdx => options[cIdx]?.id)
          .filter(Boolean) as string[];

        return {
          id: qId,
          type: 'mcq',
          questionText,
          marks,
          options,
          correctOptionIds: correctOptionIds.length > 0 ? correctOptionIds : [options[0].id],
          partialMarkingRule: partialBit === 0 ? 'zero' : 'half',
        };
      }

      if (qTypeNum === 1) {
        return {
          id: qId,
          type: 'true_false',
          questionText,
          marks,
          correctBoolean: Boolean(rq[3]),
        };
      }

      return {
        id: qId,
        type: 'theory',
        questionText,
        marks,
        modelAnswer: String(rq[3] || ''),
      };
    });

    const slug = slugifyTitle(String(rawId || title || 'test'));
    return {
      id: slug,
      slug,
      title: String(title || 'Test'),
      subject: String(subject || 'General'),
      instructions: rawInstructions === 0 ? DEFAULT_INSTRUCTIONS : String(rawInstructions || ''),
      timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
      questions,
      totalMarks,
      createdAt: new Date().toISOString(),
      creatorName: String(creatorName || 'Instructor'),
      creatorUsername: creatorUsername ? String(creatorUsername) : undefined,
      creatorUid: creatorUid ? String(creatorUid) : undefined,
    };
  } catch (e) {
    console.warn('Failed to decode test from URL param:', e);
    return null;
  }
}

export function saveDecodedTestToLocalStorage(test: Test): void {
  if (!test || typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_TESTS_KEY);
    const existing: Test[] = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(existing) ? existing : [];
    const match = list.find(
      t =>
        t.id === test.id ||
        t.slug === test.slug ||
        slugifyTitle(t.title) === slugifyTitle(test.title)
    );
    if (match && Array.isArray(match.questions) && match.questions.length > 0) {
      // Preserve creator metadata and question IDs of existing test on this device
      return;
    }
    const filtered = list.filter(t => t.id !== test.id && t.slug !== test.slug);
    filtered.unshift(test);
    localStorage.setItem(LOCAL_TESTS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to save decoded test locally:', e);
  }
}

/**
 * Extracts test slug/id and any embedded `d=` payload from the current browser URL or a pasted link string.
 * Automatically persists the decoded test into localStorage so any device/email can open it immediately.
 */
export function extractAndSyncTestFromUrl(rawInput?: string): {
  testId: string | null;
  decodedTest: Test | null;
} {
  let testId: string | null = null;
  let dParam: string | null = null;

  const parseQueryAndPath = (urlStr: string) => {
    try {
      const hasProtocol = /^https?:\/\//i.test(urlStr);
      const parsed = new URL(
        hasProtocol
          ? urlStr
          : urlStr.startsWith('/') || urlStr.startsWith('?')
          ? `https://example.com${urlStr.startsWith('/') ? '' : '/'}${urlStr}`
          : `https://example.com/${urlStr}`
      );

      if (!dParam) {
        dParam = parsed.searchParams.get('d');
      }
      if (!testId) {
        testId = parsed.searchParams.get('test') || parsed.searchParams.get('testId');
      }
      if (!testId && parsed.pathname.includes('/test/')) {
        const parts = parsed.pathname.split('/test/');
        if (parts[1]) {
          const slug = parts[1].split('/')[0].split('?')[0].trim();
          if (slug) testId = decodeURIComponent(slug);
        }
      }
      if (parsed.hash) {
        const hashContent = parsed.hash.replace(/^#/, '');
        if (!dParam && hashContent.includes('d=')) {
          const matchD = hashContent.match(/[?&]d=([^&]+)/);
          if (matchD && matchD[1]) dParam = matchD[1];
        }
        if (!testId && hashContent.includes('/test/')) {
          const parts = hashContent.split('/test/');
          if (parts[1]) {
            const slug = parts[1].split('/')[0].split('?')[0].trim();
            if (slug) testId = decodeURIComponent(slug);
          }
        } else if (!testId && hashContent.includes('test=')) {
          const matchT = hashContent.match(/[?&]?test=([^&]+)/);
          if (matchT && matchT[1]) testId = decodeURIComponent(matchT[1]);
        }
      }
    } catch {}
  };

  if (rawInput && rawInput.trim()) {
    const trimmed = rawInput.trim();
    if (
      trimmed.includes('?') ||
      trimmed.includes('/test/') ||
      trimmed.includes('http://') ||
      trimmed.includes('https://') ||
      trimmed.includes('d=')
    ) {
      parseQueryAndPath(trimmed);
    } else {
      testId = trimmed;
    }
  }

  if (typeof window !== 'undefined') {
    parseQueryAndPath(window.location.href);
  }

  let decodedTest: Test | null = null;
  if (dParam) {
    decodedTest = decodeTestFromUrlParam(dParam);
    if (decodedTest) {
      saveDecodedTestToLocalStorage(decodedTest);
      if (!testId) {
        testId = decodedTest.id || decodedTest.slug || null;
      }
    }
  }

  return { testId, decodedTest };
}

function findLocalFullTest(testId: string, testInfo?: any): Test | null {
  if (
    testInfo &&
    typeof testInfo === 'object' &&
    Array.isArray(testInfo.questions) &&
    testInfo.questions.length > 0
  ) {
    return testInfo as Test;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_TESTS_KEY);
    if (!raw) return null;
    const list: Test[] = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    const slug = getTestSlug(testId, testInfo);
    return (
      list.find(
        t =>
          t.id === testId ||
          t.slug === testId ||
          t.id === slug ||
          t.slug === slug ||
          slugifyTitle(t.title) === slug
      ) || null
    );
  } catch {
    return null;
  }
}

/**
 * Generates a short, clean share link containing only the test title slug
 * that opens on ANY device, browser profile, or email account worldwide.
 */
export function getStudentShareUrl(
  testId: string,
  testInfo?: string | { title?: string; slug?: string; questions?: Question[] }
): string {
  const baseUrl = getPublicBaseUrl();
  const slug = getTestSlug(testId, testInfo);
  const fullTest = findLocalFullTest(testId, testInfo);
  if (fullTest) {
    ensureTestPublishedToCloud(fullTest);
  }

  if (
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('github.io') ||
      window.location.hostname.includes('testcraftai.online'))
  ) {
    return `${baseUrl}/?test=${encodeURIComponent(slug)}`;
  }
  return `${baseUrl}/test/${encodeURIComponent(slug)}`;
}
