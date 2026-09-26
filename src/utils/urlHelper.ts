/**
 * URL Helper for generating clean, human-readable test links.
 */

export function getPublicBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  const pathname = window.location.pathname || '';

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

/**
 * Generates the single direct, clean link for any student or device to take the test.
 */
export function getStudentShareUrl(
  testId: string,
  testInfo?: string | { title?: string; slug?: string }
): string {
  const baseUrl = getPublicBaseUrl();
  const slug = getTestSlug(testId, testInfo);
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    return `${baseUrl}/?test=${encodeURIComponent(slug)}`;
  }
  return `${baseUrl}/test/${slug}`;
}
