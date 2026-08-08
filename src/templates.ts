import { randomUUID } from 'node:crypto';
import { escapeXml } from './utils';
import type { EdaRequestOptions } from './types';

const SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const CAI = 'http://schemas.ericsson.com/cai3g1.2/';
const HLR = 'http://schemas.ericsson.com/ema/UserProvisioning/GsmHlr/';
const AUC = 'http://schemas.ericsson.com/ema/UserProvisioning/GsmAuc/';

export function login(username: string, password: string): string {
  return `<soapenv:Envelope xmlns:soapenv="${SOAP}" xmlns:cai3="${CAI}"><soapenv:Header/><soapenv:Body><cai3:Login><cai3:userId>${escapeXml(username)}</cai3:userId><cai3:pwd>${escapeXml(password)}</cai3:pwd></cai3:Login></soapenv:Body></soapenv:Envelope>`;
}

function resolveRequestIds(
  options: EdaRequestOptions = {},
): Required<EdaRequestOptions> {
  return {
    sequenceId: options.sequenceId ?? randomUUID(),
    transactionId: options.transactionId ?? randomUUID(),
  };
}

export function logout(sessionId: string, options?: EdaRequestOptions): string {
  const ids = resolveRequestIds(options);
  return `<SOAP-ENV:Envelope xmlns:SOAP-ENV="${SOAP}" xmlns:cai3g="${CAI}" xmlns:gsm="${HLR}"><SOAP-ENV:Header><cai3g:SequenceId>${escapeXml(ids.sequenceId)}</cai3g:SequenceId><cai3g:TransactionId>${escapeXml(ids.transactionId)}</cai3g:TransactionId><cai3g:SessionId>${escapeXml(sessionId)}</cai3g:SessionId></SOAP-ENV:Header><SOAP-ENV:Body><cai3g:Logout><cai3g:sessionId>${escapeXml(sessionId)}</cai3g:sessionId></cai3g:Logout></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
}

function header(sessionId: string, options?: EdaRequestOptions): string {
  const ids = resolveRequestIds(options);
  return `<SOAP-ENV:Header><cai3g:SequenceId>${escapeXml(ids.sequenceId)}</cai3g:SequenceId><cai3g:TransactionId>${escapeXml(ids.transactionId)}</cai3g:TransactionId><cai3g:SessionId>${escapeXml(sessionId)}</cai3g:SessionId></SOAP-ENV:Header>`;
}

function envelope(
  body: string,
  sessionId: string,
  options?: EdaRequestOptions,
): string {
  return `<SOAP-ENV:Envelope xmlns:SOAP-ENV="${SOAP}" xmlns:cai3g="${CAI}" xmlns:gsm="${HLR}">${header(sessionId, options)}<SOAP-ENV:Body>${body}</SOAP-ENV:Body></SOAP-ENV:Envelope>`;
}

function moId(msisdn: string, imsi?: string): string {
  return `<cai3g:MOId><gsm:msisdn>233${escapeXml(msisdn)}</gsm:msisdn>${imsi ? `<gsm:imsi>${escapeXml(imsi)}</gsm:imsi>` : ''}</cai3g:MOId>`;
}

export function createAuc(
  sessionId: string,
  imsi: string,
  ki: string,
  options?: EdaRequestOptions,
): string {
  const ids = resolveRequestIds(options);
  return `<SOAP-ENV:Envelope xmlns:SOAP-ENV="${SOAP}" xmlns:ns="${CAI}"><SOAP-ENV:Header><ns:SessionId>${escapeXml(sessionId)}</ns:SessionId><ns:TransactionId>${escapeXml(ids.transactionId)}</ns:TransactionId><ns:SequenceId>${escapeXml(ids.sequenceId)}</ns:SequenceId></SOAP-ENV:Header><SOAP-ENV:Body><ns:Create><ns:MOType>Subscription@${AUC}</ns:MOType><ns:MOId><auc:imsi xmlns:auc="${AUC}">${escapeXml(imsi)}</auc:imsi></ns:MOId><ns:MOAttributes><auc:createSubscription xmlns:auc="${AUC}"><auc:imsi>${escapeXml(imsi)}</auc:imsi><auc:ki>${escapeXml(ki)}</auc:ki><auc:fsetind>0</auc:fsetind><auc:a4ind>2</auc:a4ind><auc:adkey>2</auc:adkey></auc:createSubscription></ns:MOAttributes></ns:Create></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
}

export function deleteAuc(
  sessionId: string,
  imsi: string,
  options?: EdaRequestOptions,
): string {
  const ids = resolveRequestIds(options);
  return `<SOAP-ENV:Envelope xmlns:SOAP-ENV="${SOAP}" xmlns:cai3g="${CAI}" xmlns:gsm="${AUC}"><SOAP-ENV:Header><cai3g:SequenceId>${escapeXml(ids.sequenceId)}</cai3g:SequenceId><cai3g:TransactionId>${escapeXml(ids.transactionId)}</cai3g:TransactionId><cai3g:SessionId>${escapeXml(sessionId)}</cai3g:SessionId></SOAP-ENV:Header><SOAP-ENV:Body><cai3g:Delete><cai3g:MOType>Subscription@${AUC}</cai3g:MOType><cai3g:MOId><gsm:imsi>${escapeXml(imsi)}</gsm:imsi></cai3g:MOId></cai3g:Delete></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
}

export function createHlr(
  sessionId: string,
  msisdn: string,
  imsi: string,
  options?: EdaRequestOptions,
): string {
  const attrs = `<gsm:createSubscription imsi="${escapeXml(imsi)}" msisdn="233${escapeXml(msisdn)}"><gsm:msisdn>233${escapeXml(msisdn)}</gsm:msisdn><gsm:imsi>${escapeXml(imsi)}</gsm:imsi><gsm:profileId>46</gsm:profileId><gsm:pdpcp>430</gsm:pdpcp><gsm:csp>3</gsm:csp><gsm:nam><gsm:prov>0</gsm:prov><gsm:keep>1</gsm:keep></gsm:nam><gsm:cfb><gsm:provisionState>1</gsm:provisionState><gsm:activationState>1</gsm:activationState><gsm:fnum>212</gsm:fnum></gsm:cfb><gsm:cfnrc><gsm:provisionState>1</gsm:provisionState><gsm:activationState>1</gsm:activationState><gsm:fnum>212</gsm:fnum></gsm:cfnrc><gsm:cfnry><gsm:provisionState>1</gsm:provisionState><gsm:activationState>1</gsm:activationState><gsm:fnum>212</gsm:fnum></gsm:cfnry><gsm:caw><gsm:provisionState>1</gsm:provisionState><gsm:ts10><gsm:activationState>1</gsm:activationState></gsm:ts10><gsm:bs30><gsm:activationState>1</gsm:activationState></gsm:bs30></gsm:caw><gsm:clir>0</gsm:clir><gsm:obi>0</gsm:obi><gsm:obo>0</gsm:obo><gsm:obr>0</gsm:obr><gsm:oick>60</gsm:oick><gsm:soclir>0</gsm:soclir><gsm:stype>0</gsm:stype><gsm:ts11>1</gsm:ts11><gsm:ts21>1</gsm:ts21><gsm:ts22>1</gsm:ts22><gsm:rsa>3</gsm:rsa><gsm:prbt>0</gsm:prbt></gsm:createSubscription>`;
  return envelope(
    `<cai3g:Create><cai3g:MOType>Subscription@${HLR}</cai3g:MOType>${moId(msisdn, imsi)}<cai3g:MOAttributes>${attrs}</cai3g:MOAttributes></cai3g:Create>`,
    sessionId,
    options,
  );
}

export function deleteHlr(
  sessionId: string,
  msisdn: string,
  options?: EdaRequestOptions,
): string {
  return envelope(
    `<cai3g:Delete><cai3g:MOType>Subscription@${HLR}</cai3g:MOType>${moId(msisdn)} </cai3g:Delete>`,
    sessionId,
    options,
  );
}

export function setVoice(
  sessionId: string,
  msisdn: string,
  barred: boolean,
  options?: EdaRequestOptions,
): string {
  const value = barred ? '1' : '0';
  return envelope(
    `<cai3g:Set><cai3g:MOType>Subscription@${HLR}</cai3g:MOType>${moId(msisdn)}<cai3g:MOAttributes><gsm:setSubscription msisdn="233${escapeXml(msisdn)}"><gsm:obi>${value}</gsm:obi><gsm:obo>${value}</gsm:obo><gsm:obssm>0</gsm:obssm><gsm:ts21>1</gsm:ts21><gsm:ts22>1</gsm:ts22></gsm:setSubscription></cai3g:MOAttributes></cai3g:Set>`,
    sessionId,
    options,
  );
}

export function unbarInternet(
  sessionId: string,
  msisdn: string,
  options?: EdaRequestOptions,
): string {
  return envelope(
    `<cai3g:Set><cai3g:MOType>Subscription@${HLR}</cai3g:MOType>${moId(msisdn)}<cai3g:MOAttributes><gsm:setSubscription msisdn="233${escapeXml(msisdn)}"><gsm:pdpcp>1</gsm:pdpcp><gsm:nam><gsm:prov>0</gsm:prov><gsm:keep>1</gsm:keep></gsm:nam></gsm:setSubscription></cai3g:MOAttributes></cai3g:Set>`,
    sessionId,
    options,
  );
}

export function getSubscriberStatus(
  sessionId: string,
  msisdn: string,
  options?: EdaRequestOptions,
): string {
  const ids = resolveRequestIds(options);
  return `<soapenv:Envelope xmlns:soapenv="${SOAP}" xmlns:cai3="${CAI}" xmlns:gsm="${HLR}"><soapenv:Header><cai3:SessionId>${escapeXml(sessionId)}</cai3:SessionId><cai3:Context></cai3:Context><cai3:SequenceId>${escapeXml(ids.sequenceId)}</cai3:SequenceId><cai3:TransactionId>${escapeXml(ids.transactionId)}</cai3:TransactionId></soapenv:Header><soapenv:Body><cai3:Get><cai3:MOType>Subscription@${HLR}</cai3:MOType><cai3:MOId><gsm:msisdn>233${escapeXml(msisdn)}</gsm:msisdn></cai3:MOId><cai3:MOAttributes></cai3:MOAttributes><cai3:extension></cai3:extension></cai3:Get></soapenv:Body></soapenv:Envelope>`;
}
