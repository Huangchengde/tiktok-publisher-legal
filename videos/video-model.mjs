export function countText(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('en-US') : '—';
}
export function dateText(value) {
  if (!Number.isSafeInteger(value) || value < 0) return 'Date unavailable';
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'});
}
export function safeURL(value, tiktokOnly=false) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (tiktokOnly && url.hostname !== 'tiktok.com' && !url.hostname.endsWith('.tiktok.com')) return null;
    return url.href;
  } catch { return null; }
}
export function mergeVideos(previous, incoming) {
  const merged = new Map(previous.map(video => [video.id, video]));
  for (const video of incoming) {
    if (!video || typeof video.id !== 'string' || !/^[0-9]{1,30}$/.test(video.id)) throw new Error('TikTok returned incomplete video data. Please refresh.');
    merged.set(video.id, video);
  }
  return [...merged.values()];
}
export function sameConnection(expected, received) {
  return typeof expected === 'string' && expected.length > 0 && expected === received;
}
