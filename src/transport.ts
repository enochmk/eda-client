import axios from 'axios';
import https from 'node:https';
import createHttpError from 'http-errors';
import { XMLParser } from 'fast-xml-parser';
import type { EdaClientOptions } from './types';

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
          SoapAction: operation === 'login' ? 'CAI3G#Login' : '',
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
      const message =
        error instanceof Error ? error.message : 'EDA request failed';
      this.log('error', `${operation} - request failed`, {
        ...context,
        path,
        durationMs: Date.now() - startedAt,
        error: message,
      });
      throw createHttpError(502, message);
    }
  }
}
