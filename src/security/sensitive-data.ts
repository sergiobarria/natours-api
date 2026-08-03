const sensitiveAssignment =
  /\b(password|secret|token|authorization|cookie|credential|verification|recovery)(\s*[:=]\s*)([^\s,;]+)/gi;
const bearerToken = /\bBearer\s+[^\s,;]+/gi;
const urlCredentials = /(\w+:\/\/[^:\s/@]+:)[^@\s/]+@/gi;
const sensitiveFieldName =
  /password|confirmation|authorization|cookie|session|token|verification|recovery|secret|credential|connection|databaseurl|redisurl/i;

export function isSensitiveFieldName(name: string): boolean {
  return sensitiveFieldName.test(name.replaceAll('_', ''));
}

export function sanitizeOperationalText(value: string): string {
  return value
    .replace(bearerToken, 'Bearer [Redacted]')
    .replace(urlCredentials, '$1[Redacted]@')
    .replace(sensitiveAssignment, '$1$2[Redacted]');
}

export function sanitizeOperationalError(value: unknown): Error {
  const source = value instanceof Error ? value : new Error(String(value));
  const error = new Error(sanitizeOperationalText(source.message));
  error.name = source.name;
  if (source.stack) {
    error.stack = sanitizeOperationalText(source.stack);
  }
  return error;
}
