import createHttpError from 'http-errors';
import {
  createAuc,
  createHlr,
  deleteAuc,
  deleteHlr,
  getSubscriberStatus,
  login,
  logout as logoutTemplate,
  setVoice,
  unbarInternet,
} from './templates';
import { EdaTransport, type ResolvedEdaOptions } from './transport';
import type {
  EdaClientOptions,
  EdaErrorDetails,
  EdaRequestOptions,
  EdaResponse,
  Logger,
  SubscriberStatus,
} from './types';
import {
  extractEdaError,
  findObject,
  findValue,
  normalizeMsisdn,
} from './utils';

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
    if (this.sessionId && !force) {
      this.log('debug', 'login - reusing EDA session');
      return this.sessionId;
    }
    try {
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
      this.log('info', 'login - EDA session established');
      return sessionId;
    } catch (error: unknown) {
      this.log('error', 'login - failed', { error: this.errorMessage(error) });
      throw error;
    }
  }

  async logout(options?: EdaRequestOptions): Promise<EdaResponse> {
    if (!this.sessionId) {
      throw createHttpError(400, 'EDA session is not established');
    }

    const response = await this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      logoutTemplate(this.sessionId, options),
      'logout',
      {},
    );
    this.sessionId = undefined;
    return response;
  }

  async createAuc(
    imsi: string,
    ki: string,
    options?: EdaRequestOptions,
  ): Promise<EdaResponse> {
    const sessionId = await this.getSessionId();
    return this.execute(
      this.options.aucPath,
      createAuc(sessionId, imsi, ki, options),
      'createAuc',
      { imsi },
      ['301'],
    );
  }

  async deleteAuc(
    imsi: string,
    options?: EdaRequestOptions,
  ): Promise<EdaResponse> {
    const sessionId = await this.getSessionId();
    return this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      deleteAuc(sessionId, imsi, options),
      'deleteAuc',
      { imsi },
    );
  }

  async createHlr(
    msisdn: string,
    imsi: string,
    options?: EdaRequestOptions,
  ): Promise<EdaResponse> {
    const normalized = normalizeMsisdn(msisdn);
    const sessionId = await this.getSessionId();
    return this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      createHlr(sessionId, normalized, imsi, options),
      'createHlr',
      {
        msisdn: normalized,
        imsi,
      },
      ['2', '301'],
    );
  }

  async deleteHlr(
    msisdn: string,
    options?: EdaRequestOptions,
  ): Promise<EdaResponse> {
    const normalized = normalizeMsisdn(msisdn);
    const sessionId = await this.getSessionId();
    return this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      deleteHlr(sessionId, normalized, options),
      'deleteHlr',
      {
        msisdn: normalized,
      },
    );
  }

  async barVoice(
    msisdn: string,
    options?: EdaRequestOptions,
  ): Promise<EdaResponse> {
    return this.setVoice(msisdn, true, options);
  }

  async unbarVoice(
    msisdn: string,
    options?: EdaRequestOptions,
  ): Promise<EdaResponse> {
    return this.setVoice(msisdn, false, options);
  }

  async unbarInternet(
    msisdn: string,
    options?: EdaRequestOptions,
  ): Promise<EdaResponse> {
    const normalized = normalizeMsisdn(msisdn);
    const sessionId = await this.getSessionId();
    return this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      unbarInternet(sessionId, normalized, options),
      'unbarInternet',
      {
        msisdn: normalized,
      },
    );
  }

  async getSubscriberStatus(
    msisdn: string,
    options?: EdaRequestOptions,
  ): Promise<EdaResponse<SubscriberStatus>> {
    const normalized = normalizeMsisdn(msisdn);
    const sessionId = await this.getSessionId();
    const response = await this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      getSubscriberStatus(sessionId, normalized, options),
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

  async checkVoiceBarred(
    msisdn: string,
    options?: EdaRequestOptions,
  ): Promise<boolean> {
    const status = await this.getSubscriberStatus(msisdn, options);
    return status.data.obi === '1' || status.data.obo === '1';
  }

  async checkInternetBlocked(
    msisdn: string,
    options?: EdaRequestOptions,
  ): Promise<boolean> {
    const status = await this.getSubscriberStatus(msisdn, options);
    const nam = status.data.nam;
    return typeof nam === 'object' && nam !== null && nam.prov === '1';
  }

  private async setVoice(
    msisdn: string,
    barred: boolean,
    options?: EdaRequestOptions,
  ): Promise<EdaResponse> {
    const normalized = normalizeMsisdn(msisdn);
    const sessionId = await this.getSessionId();
    const operation = barred ? 'barVoice' : 'unbarVoice';
    return this.execute(
      '/CAI3G1.2/services/CAI3G1.2',
      setVoice(sessionId, normalized, barred, options),
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
    try {
      const rawXml = await this.transport.post(path, xml, operation, context);
      const data = this.parse(rawXml, operation);
      const error = extractEdaError(data);
      if (error && !ignoredCodes.includes(error.code)) {
        this.log('warn', `${operation} - EDA error`, { ...context, error });
        throw this.toHttpError(error, operation, rawXml);
      }
      if (error)
        this.log('warn', `${operation} - ignored EDA response`, {
          ...context,
          error,
        });
      this.log('info', `${operation} - success`, context);
      return { operation, data, rawXml };
    } catch (error: unknown) {
      this.log('error', `${operation} - failed`, {
        ...context,
        error: this.errorMessage(error),
      });
      throw error;
    }
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

  private toHttpError(
    error: EdaErrorDetails,
    operation: string,
    rawXml: string,
  ): Error {
    const sessionCodes = ['1001', '1005', '1010', '3014'];
    const status =
      error.type === 'SESSION' &&
      [error.code, error.cai3gFaultCode, error.pgErrorCode].some((code) =>
        code ? sessionCodes.includes(code) : false,
      )
        ? 401
        : 502;
    const detail =
      error.description && error.description !== error.message
        ? ` - ${error.description}`
        : '';
    const httpError = createHttpError(
      status,
      `${operation} failed (${error.code}): ${error.message}${detail}`,
    );
    httpError.expose = true;
    httpError.data = {
      code: error.code,
      message: error.message,
    };
    httpError.metadata = {
      operation,
      httpStatus: status,
      faultCode: error.faultCode,
      faultRole: error.faultRole,
      cai3gFaultCode: error.cai3gFaultCode,
      soapMessage: error.soapMessage,
      pgErrorCode: error.pgErrorCode,
      pgErrorMessage: error.pgErrorMessage,
      pgErrorDetails: error.pgErrorDetails,
      description: error.description,
      response: error.raw,
      rawXml,
    };
    httpError.edaError = error;
    httpError.rawXml = rawXml;
    return httpError;
  }

  private log(
    level: keyof Logger,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const logger = this.options.logger;
    const method = logger[level];
    if (typeof method === 'function') {
      method(message, context);
    } else if (level === 'info' && logger.log) {
      logger.log(message, context);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
