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

export interface RefreshNumberOptions {
  deleteHlr?: EdaRequestOptions;
  deleteAuc?: EdaRequestOptions;
  createHlr?: EdaRequestOptions;
  createAuc?: EdaRequestOptions;
  getHlr?: EdaRequestOptions;
}

export interface SimSwapRequestOptions {
  deleteHlr?: EdaRequestOptions;
  deleteAuc?: EdaRequestOptions;
  createHlr?: EdaRequestOptions;
  createAuc?: EdaRequestOptions;
  getHlr?: EdaRequestOptions;
}

export interface SimSwapParams {
  oldImsi: string;
  targetImsi: string;
  targetKi: string;
  requests?: SimSwapRequestOptions;
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

export interface EdaWarning extends EdaErrorDetails {
  ignored: true;
  httpStatus?: number;
}

export interface EdaResponse<T = unknown> {
  operation: string;
  data: T;
  rawXml: string;
  warnings?: EdaWarning[];
}

export interface RefreshNumberResponse {
  deleteHlr: EdaResponse;
  deleteAuc: EdaResponse;
  createHlr: EdaResponse;
  createAuc: EdaResponse;
  getHlr: EdaResponse<SubscriberStatus>;
}

export interface SimSwapResponse {
  deleteHlr: EdaResponse;
  deleteAuc: EdaResponse;
  createHlr: EdaResponse;
  createAuc: EdaResponse;
  getHlr: EdaResponse<SubscriberStatus>;
}

export interface SubscriberStatus {
  obi?: string;
  obo?: string;
  nam?: { prov?: string; keep?: string };
  [key: string]: unknown;
}
