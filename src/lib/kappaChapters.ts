/** Deep-link into kappachapters.com search for a chapter name. */
export function kappaChaptersSearchUrl(chapterName: string): string | null {
  const q = chapterName.trim();
  if (!q) return null;
  return `https://kappachapters.com/?q=${encodeURIComponent(q)}`;
}
