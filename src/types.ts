export interface EdaClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  timeout?: number;
  rejectUnauthorized?: boolean;
  logger?: Logger;
  aucPath?: string;
}

export interface EdaRequestOptions {
  sequenceId?: string;
  transactionId?: string;
}

export interface Logger {
  log?: (message: string, context?: Record<string, unknown>) => void;
  info?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
  debug?: (message: string, context?: Record<string, unknown>) => void;
  verbose?: (message: string, context?: Record<string, unknown>) => void;
}

export interface EdaErrorDetails {
  code: string;
  message: string;
  faultCode?: string;
  faultRole?: string;
  cai3gFaultCode?: string;
  soapMessage?: string;
  pgErrorCode?: string;
  pgErrorMessage?: string;
  pgErrorDetails?: string;
  description?: string;
  type?: 'AUC' | 'HLR' | 'SESSION' | 'UNKNOWN';
  raw?: unknown;
}

export interface EdaResponse<T = unknown> {
  operation: string;
  data: T;
  rawXml: string;
}

export interface SubscriberStatus {
  obi?: string;
  obo?: string;
  nam?: { prov?: string; keep?: string };
  [key: string]: unknown;
}
