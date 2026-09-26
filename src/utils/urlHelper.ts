/**
 * URL Helper for generating clean, human-readable test links.
 */

export function getPublicBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

/**
 * Converts a test title into a clean, URL-safe slug.
 * E.g. "Biology - Chapter 1: Cell Structure & Functions!" -> "biology-chapter-1-cell-structure-functions"
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

export function getTestSlug(testId: string, testInfo?: string | { title?: string; slug?: string }): string {
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

/**
 * Generates the single direct, clean link for any student or device to take the test.
 * E.g. https://<your-domain>/test/fundamentals-of-science-renewable-energy
 */
export function getStudentShareUrl(
  testId: string,
  testInfo?: string | { title?: string; slug?: string }
): string {
  const baseUrl = getPublicBaseUrl();
  const slug = getTestSlug(testId, testInfo);
  return `${baseUrl}/test/${slug}`;
}
