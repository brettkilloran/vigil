/** WordPress mshots — public thumbnail service (no API key). */
export function webclipMshotUrl(pageUrl: string, width = 800): string {
  const u = pageUrl.trim();
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(u)}?w=${width}`;
}
