/**
 * Practical heuristic to skip auto-downloads for crawlers / link previews.
 * Not perfect — intentional for a browser-compat experiment.
 */
export function isLikelyBotOrPreviewAgent(): boolean {
  if (typeof navigator === 'undefined') return true;

  // Headless / automation
  if (navigator.webdriver) return true;

  const ua = navigator.userAgent || '';
  if (!ua.trim()) return true;

  return /bot|crawler|crawl|spider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|pinterest|embedly|quora link preview|showyoubot|outbrain|vkshare|w3c_validator|preview|baiduspider|yandex|duckduckbot|bingpreview|applebot|google-inspectiontool|semrush|ahrefs|mj12bot/i.test(
    ua
  );
}
