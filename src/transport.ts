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
    this.options.logger[level as keyof typeof this.options.logger]?.(
      message,
      context,
    );
  }

  async post(
    path: string,
    xml: string,
    operation: string,
    context?: Record<string, unknown>,
  ): Promise<string> {
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
      return response.data;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'EDA request failed';
      this.log('error', `${operation} - request failed`, {
        ...context,
        error: message,
      });
      throw createHttpError(502, message);
    }
  }
}
