import createHttpError from 'http-errors';

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function normalizeMsisdn(msisdn: string): string {
  const digits = msisdn.replace(/\D/g, '');
  if (![9, 10, 12].includes(digits.length)) {
    throw createHttpError(400, 'MSISDN must contain 9, 10, or 12 digits');
  }
  return digits.slice(-9);
}

export function findValue(value: unknown, names: string[]): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, names);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  for (const [key, child] of Object.entries(value)) {
    const localName = key.includes(':') ? key.split(':').pop()! : key;
    if (names.includes(localName)) {
      const candidate = Array.isArray(child) ? child[0] : child;
      if (typeof candidate === 'string' || typeof candidate === 'number')
        return String(candidate);
    }
    const found = findValue(child, names);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function findObject(
  value: unknown,
  names: string[],
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findObject(item, names);
      if (found) return found;
    }
    return undefined;
  }
  for (const [key, child] of Object.entries(value)) {
    const localName = key.includes(':') ? key.split(':').pop()! : key;
    const candidate = Array.isArray(child) ? child[0] : child;
    if (
      names.includes(localName) &&
      candidate &&
      typeof candidate === 'object'
    ) {
      return candidate as Record<string, unknown>;
    }
    const found = findObject(child, names);
    if (found) return found;
  }
  return undefined;
}
