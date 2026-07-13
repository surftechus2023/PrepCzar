type LogLevel = 'info' | 'warn' | 'error';

const REDACTED_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'secret',
  'stripe_secret_key',
  'stripe_webhook_secret',
  'supabase_service_role_key',
  'card',
  'payment_method',
  'document',
  'file',
]);

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    const normalized = key.toLowerCase();
    acc[key] = Array.from(REDACTED_KEYS).some((redacted) => normalized.includes(redacted))
      ? '[REDACTED]'
      : sanitize(entry);
    return acc;
  }, {});
}

export function serverLog(level: LogLevel, event: string, metadata: Record<string, unknown> = {}) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitize(metadata) as Record<string, unknown>,
  };

  if (level === 'error') console.error(JSON.stringify(payload));
  else if (level === 'warn') console.warn(JSON.stringify(payload));
  else console.info(JSON.stringify(payload));
}
