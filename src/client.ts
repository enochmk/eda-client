import createHttpError from 'http-errors';
import { randomUUID } from 'node:crypto';
import {
  createAuc,
  createHlr,
  deleteHlr,
  getSubscriberStatus,
  login,
  setVoice,
  unbarInternet,
} from './templates';
import { EdaTransport, type ResolvedEdaOptions } from './transport';
import type {
  EdaClientOptions,
  EdaErrorDetails,
  EdaResponse,
  Logger,
  SubscriberStatus,
} from './types';
import { findObject, findValue, normalizeMsisdn } from './utils';

export class EdaClient {
  private readonly options: ResolvedEdaOptions;
  private readonly transport: EdaTransport;
  private sessionId?: string;

  constructor(options: EdaClientOptions) {
    this.options = {
      timeout: 15_000,
      rejectUnauthorized: true,
      logger: {},
      aucPath: '/Provisioning',
      ...options,
    };
    this.transport = new EdaTransport(this.options);
  }

  async getSessionId(force = false): Promise<string> {
    if (this.sessionId && !force) return this.sessionId;
    const rawXml = await this.transport.post(
      '/CAI3G1.2/services/CAI3G1.2',
      login(this.options.username, this.options.password),
      'login',
    );
    const parsed = this.parse(rawXml, 'login');
    const sessionId = findValue(parsed, ['sessionId', 'SessionId']);
    if (!sessionId) {
      throw createHttpError(502, 'EDA login succeeded without a session ID');
    }
    this.sessionId = sessionId;
    this.log('info', 'EDA session established');
    return sessionId;
  }

  async createAuc(imsi: string, ki: string): Promise<EdaResponse> {
    const sessionId = await this.getSessionId();
    return this.execute(
      this.options.aucPath,
      createAuc(sessionId, randomUUID(), imsi, ki),
      'createAuc',
      { imsi },
      ['301'],
    );
  }

  async createHlr(msisdn: string, imsi: string): Promise<EdaResponse> {
    const normalized = normalizeMsisdn(msisdn);
    const sessionId = await this.getSessionId();
    return this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      createHlr(sessionId, normalized, imsi),
      'createHlr',
      {
        msisdn: normalized,
        imsi,
      },
      ['2', '301'],
    );
  }

  async deleteHlr(msisdn: string): Promise<EdaResponse> {
    const normalized = normalizeMsisdn(msisdn);
    const sessionId = await this.getSessionId();
    return this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      deleteHlr(sessionId, normalized),
      'deleteHlr',
      {
        msisdn: normalized,
      },
    );
  }

  async barVoice(msisdn: string): Promise<EdaResponse> {
    return this.setVoice(msisdn, true);
  }

  async unbarVoice(msisdn: string): Promise<EdaResponse> {
    return this.setVoice(msisdn, false);
  }

  async unbarInternet(msisdn: string): Promise<EdaResponse> {
    const normalized = normalizeMsisdn(msisdn);
    const sessionId = await this.getSessionId();
    return this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      unbarInternet(sessionId, normalized),
      'unbarInternet',
      {
        msisdn: normalized,
      },
    );
  }

  async getSubscriberStatus(
    msisdn: string,
  ): Promise<EdaResponse<SubscriberStatus>> {
    const normalized = normalizeMsisdn(msisdn);
    const sessionId = await this.getSessionId();
    const response = await this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      getSubscriberStatus(sessionId, normalized),
      'getSubscriberStatus',
      {
        msisdn: normalized,
      },
    );
    return {
      ...response,
      data: (findObject(response.data, ['getResponseSubscription']) ??
        response.data) as SubscriberStatus,
    };
  }

  async checkVoiceBarred(msisdn: string): Promise<boolean> {
    const status = await this.getSubscriberStatus(msisdn);
    return status.data.obi === '1' || status.data.obo === '1';
  }

  async checkInternetBlocked(msisdn: string): Promise<boolean> {
    const status = await this.getSubscriberStatus(msisdn);
    const nam = status.data.nam;
    return typeof nam === 'object' && nam !== null && nam.prov === '1';
  }

  private async setVoice(
    msisdn: string,
    barred: boolean,
  ): Promise<EdaResponse> {
    const normalized = normalizeMsisdn(msisdn);
    const sessionId = await this.getSessionId();
    const operation = barred ? 'barVoice' : 'unbarVoice';
    return this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      setVoice(sessionId, normalized, barred),
      operation,
      {
        msisdn: normalized,
      },
    );
  }

  private async execute(
    path: string,
    xml: string,
    operation: string,
    context: Record<string, unknown>,
    ignoredCodes: string[] = [],
  ): Promise<EdaResponse> {
    const rawXml = await this.transport.post(path, xml, operation, context);
    const data = this.parse(rawXml, operation);
    const error = this.extractError(data);
    if (error && !ignoredCodes.includes(error.code)) {
      this.log('warn', `${operation} - EDA error`, { ...context, error });
      throw this.toHttpError(error, operation);
    }
    if (error)
      this.log('warn', `${operation} - ignored EDA response`, {
        ...context,
        error,
      });
    this.log('info', `${operation} - success`, context);
    return { operation, data, rawXml };
  }

  private parse(xml: string, operation: string): unknown {
    try {
      const parsed = this.transport.parser.parse(xml);
      if (!parsed) throw new Error('Empty XML response');
      return parsed;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Invalid XML response';
      throw createHttpError(
        502,
        `${operation} returned invalid XML: ${message}`,
      );
    }
  }

  private extractError(data: unknown): EdaErrorDetails | undefined {
    const faultCode = findValue(data, ['faultcode', 'faultCode']);
    const code =
      findValue(data, ['respCode', 'errorcode', 'errorCode']) ?? faultCode;
    const description = findValue(data, [
      'respDescription',
      'errormessage',
      'errorMessage',
    ]);
    const message =
      findValue(data, ['faultstring', 'faultreason', 'reasonText']) ??
      description;
    if (!code && !message) return undefined;
    return {
      code: code ?? '500',
      message: message ?? 'EDA SOAP fault',
      faultCode,
      description,
      raw: data,
      type: findValue(data, ['PGFault']) ? 'SESSION' : 'UNKNOWN',
    };
  }

  private toHttpError(error: EdaErrorDetails, operation: string): Error {
    const status =
      error.type === 'SESSION' && ['1005', '3014'].includes(error.code)
        ? 401
        : 502;
    return createHttpError(
      status,
      `${operation} failed (${error.code}): ${error.description ?? error.message}`,
    );
  }

  private log(
    level: keyof Logger,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    this.options.logger[level]?.(message, context);
  }
}
