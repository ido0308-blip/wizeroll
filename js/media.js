// Pure helpers for the product page media: the brand video and the 360 view.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

// Returns the 11-character video id from a YouTube link, or null.
export function youTubeId(link) {
  let url;
  try {
    url = new URL(String(link ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  let id = null;
  if (url.hostname === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0];
  } else if (YOUTUBE_HOSTS.has(url.hostname)) {
    const [first, second] = url.pathname.split('/').filter(Boolean);
    if (first === 'watch') id = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live'].includes(first)) id = second;
  }
  return YOUTUBE_ID.test(id ?? '') ? id : null;
}

// The privacy-enhanced embed address, or null when the link is not a YouTube video.
export function videoEmbedUrl(link) {
  const id = youTubeId(link);
  if (!id) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
}

// The 360 view config, or null when it is incomplete.
export function spinConfig(view) {
  const amount = Number(view?.amount);
  const folder = String(view?.folder ?? '');
  const filename = String(view?.filename ?? '');
  if (!Number.isInteger(amount) || amount < 2) return null;
  if (!folder || !filename.includes('{index}')) return null;
  return {
    folder: folder.endsWith('/') ? folder : `${folder}/`,
    filenameX: filename,
    amountX: amount,
  };
}
