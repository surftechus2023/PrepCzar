const PRODUCTION_SITE_URL = 'https://prep-czar.vercel.app';

function normalizeUrl(url: string) {
  return url.replace(/\/$/, '');
}

function isLocalUrl(url: string) {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredUrl && (process.env.NODE_ENV !== 'production' || !isLocalUrl(configuredUrl))) {
    return normalizeUrl(configuredUrl);
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) {
    return normalizeUrl(vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`);
  }

  return process.env.NODE_ENV === 'production' ? PRODUCTION_SITE_URL : 'http://localhost:3000';
}
