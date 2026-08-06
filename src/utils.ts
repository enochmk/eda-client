import createHttpError from 'http-errors';
import type { EdaErrorDetails } from './types';

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

export function extractEdaError(data: unknown): EdaErrorDetails | undefined {
  const soapFault = findObject(data, ['Fault']);
  const cai3gFault = findObject(data, ['Cai3gFault']);
  const pgFault = findObject(data, ['PGFault']);

  const faultCode = findValue(soapFault ?? data, ['faultcode', 'faultCode']);
  const cai3gFaultCode = findValue(cai3gFault, ['faultcode', 'faultCode']);
  const pgErrorCode = findValue(pgFault, ['errorcode', 'errorCode']);
  const responseCode = findValue(data, ['respCode']);
  const code = pgErrorCode ?? responseCode ?? cai3gFaultCode ?? faultCode;

  const soapMessage = findValue(soapFault ?? data, [
    'faultstring',
    'faultString',
  ]);
  const reasonText = findValue(cai3gFault ?? data, ['reasonText']);
  const pgErrorMessage = findValue(pgFault, ['errormessage', 'errorMessage']);
  const pgErrorDetails = findValue(pgFault, ['errordetails', 'errorDetails']);
  const responseDescription = findValue(data, [
    'respDescription',
    'description',
  ]);
  const message =
    pgErrorMessage ?? reasonText ?? responseDescription ?? soapMessage;
  const description =
    pgErrorDetails ?? responseDescription ?? pgErrorMessage ?? reasonText;
  const faultRole = findValue(cai3gFault, ['faultrole', 'faultRole']);

  if (!code && !message) return undefined;
  return {
    code: code ?? '500',
    message: message ?? 'EDA SOAP fault',
    faultCode,
    faultRole,
    cai3gFaultCode,
    soapMessage,
    pgErrorCode,
    pgErrorMessage,
    pgErrorDetails,
    description,
    raw: data,
    type: pgFault ? 'SESSION' : 'UNKNOWN',
  };
}
