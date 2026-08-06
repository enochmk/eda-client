import axios from 'axios';
import https from 'node:https';
import createHttpError from 'http-errors';
import { XMLParser } from 'fast-xml-parser';
import type { EdaClientOptions, EdaErrorDetails } from './types';
import { extractEdaError } from './utils';

export type ResolvedEdaOptions = Required<EdaClientOptions>;

export class EdaTransport {
  readonly parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    trimValues: true,
  });

  constructor(private readonly options: ResolvedEdaOptions) {}

  url(path: string): string {
    return `${this.options.baseUrl.replace(/\/$/, '')}${path}`;
  }

  log(level: string, message: string, context?: Record<string, unknown>): void {
    const logger = this.options.logger;
    const method = logger[level as keyof typeof logger];
    if (typeof method === 'function') {
      method(message, context);
    } else if (level === 'info' && logger.log) {
      logger.log(message, context);
    }
  }

  async post(
    path: string,
    xml: string,
    operation: string,
    context?: Record<string, unknown>,
  ): Promise<string> {
    const startedAt = Date.now();
    this.log('verbose', `${operation} - sending request`, {
      ...context,
      path,
    });
    try {
      const response = await axios.post<string>(this.url(path), xml, {
        headers: {
          'Content-Type': 'text/xml',
          SOAPAction: this.soapAction(operation),
        },
        timeout: this.options.timeout,
        timeoutErrorMessage: 'EDA request timed out',
        httpsAgent: new https.Agent({
          rejectUnauthorized: this.options.rejectUnauthorized,
        }),
      });
      this.log('verbose', `${operation} - received response`, {
        ...context,
        path,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response.data;
    } catch (error: unknown) {
      const httpError = this.toHttpError(error, operation);
      this.log('error', `${operation} - request failed`, {
        ...context,
        path,
        durationMs: Date.now() - startedAt,
        error: httpError.message,
      });
      throw httpError;
    }
  }

  private soapAction(operation: string): string {
    const actions: Record<string, string> = {
      login: 'Login',
      logout: 'Logout',
      createAuc: 'Create',
      deleteAuc: 'Delete',
      createHlr: 'Create',
      deleteHlr: 'Delete',
      barVoice: 'Set',
      unbarVoice: 'Set',
      unbarInternet: 'Set',
      getSubscriberStatus: 'Get',
    };
    const action = actions[operation];
    return action ? `CAI3G#${action}` : '';
  }

  private toHttpError(error: unknown, operation: string): Error {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        const httpError = createHttpError(
          503,
          `EDA is unreachable during ${operation}: ${error.message}`,
        );
        httpError.expose = true;
        httpError.code = error.code;
        return httpError;
      }

      const responseBody = this.stringifyResponseBody(error.response.data);
      const edaError = this.parseEdaError(error.response.data);
      const message = edaError
        ? `EDA returned HTTP ${error.response.status} during ${operation} (${edaError.code}): ${edaError.message}${edaError.description && edaError.description !== edaError.message ? ` - ${edaError.description}` : ''}`
        : responseBody
          ? `EDA returned HTTP ${error.response.status} during ${operation}: ${responseBody}`
          : `EDA returned HTTP ${error.response.status} during ${operation}: ${error.message}`;
      const httpError = createHttpError(error.response.status, message);
      httpError.expose = true;
      httpError.edaStatus = error.response.status;
      httpError.edaResponse = error.response.data;
      httpError.edaCode = error.code;
      httpError.data = edaError
        ? {
            code: edaError.code,
            message: edaError.message,
          }
        : {
            message: responseBody || error.message,
          };
      httpError.metadata = {
        operation,
        httpStatus: error.response.status,
        faultCode: edaError?.faultCode,
        faultRole: edaError?.faultRole,
        cai3gFaultCode: edaError?.cai3gFaultCode,
        soapMessage: edaError?.soapMessage,
        pgErrorCode: edaError?.pgErrorCode,
        pgErrorMessage: edaError?.pgErrorMessage,
        pgErrorDetails: edaError?.pgErrorDetails,
        description: edaError?.description,
        response: error.response.data,
      };
      if (edaError) httpError.edaError = edaError;
      return httpError;
    }

    const message =
      error instanceof Error ? error.message : 'EDA request failed';
    const httpError = createHttpError(502, `EDA request failed: ${message}`);
    httpError.expose = true;
    httpError.cause = error;
    return httpError;
  }

  private stringifyResponseBody(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === undefined || value === null) return '';
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private parseEdaError(value: unknown): EdaErrorDetails | undefined {
    if (typeof value !== 'string') return extractEdaError(value);
    try {
      return extractEdaError(this.parser.parse(value));
    } catch {
      return undefined;
    }
  }
}
