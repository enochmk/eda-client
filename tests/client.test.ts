import { describe, expect, it } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { EdaClient } from '../src';

describe('EdaClient', () => {
  it('rejects invalid MSISDNs before making a request', async () => {
    const client = new EdaClient({
      baseUrl: 'https://eda.example',
      username: 'user',
      password: 'pass',
    });

    await expect(client.getSubscriberStatus('123')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('forwards request lifecycle events to a Nest-style logger', async () => {
    const events: string[] = [];
    const mock = new MockAdapter(axios);
    mock
      .onPost('https://eda.example/CAI3G1.2/services/CAI3G1.2')
      .replyOnce(
        200,
        '<S:Envelope><S:Body><LoginResponse><sessionId>session-1</sessionId></LoginResponse></S:Body></S:Envelope>',
      )
      .onPost('https://eda.example/CAI3G1.2/services/CAI3G1.2')
      .replyOnce(
        200,
        '<S:Envelope><S:Body><GetResponse><MOAttributes><getResponseSubscription><obi>0</obi><obo>0</obo><nam><prov>0</prov></nam></getResponseSubscription></MOAttributes></GetResponse></S:Body></S:Envelope>',
      );

    const client = new EdaClient({
      baseUrl: 'https://eda.example',
      username: 'user',
      password: 'pass',
      logger: {
        log: (message) => events.push(`log:${message}`),
        verbose: (message) => events.push(`verbose:${message}`),
        info: (message) => events.push(`info:${message}`),
      },
    });

    await client.getSubscriberStatus('271004887', {
      sequenceId: 'sequence-status-1',
      transactionId: 'transaction-status-1',
    });

    expect(events.some((event) => event.includes('sending request'))).toBe(
      true,
    );
    expect(events.some((event) => event.includes('received response'))).toBe(
      true,
    );
    expect(events.some((event) => event.includes('success'))).toBe(true);
    mock.restore();
  });

  it('builds subscriber status requests with the EDA Get SOAP contract', async () => {
    const mock = new MockAdapter(axios);
    const endpoint = 'https://eda.example/CAI3G1.2/services/CAI3G1.2';
    mock
      .onPost(endpoint)
      .replyOnce(
        200,
        '<S:Envelope><S:Body><LoginResponse><sessionId>session-1</sessionId></LoginResponse></S:Body></S:Envelope>',
      )
      .onPost(endpoint)
      .replyOnce(
        200,
        '<S:Envelope><S:Body><GetResponse><MOAttributes><getResponseSubscription><obi>0</obi><obo>0</obo><nam><prov>0</prov></nam></getResponseSubscription></MOAttributes></GetResponse></S:Body></S:Envelope>',
      );

    const client = new EdaClient({
      baseUrl: 'https://eda.example',
      username: 'user',
      password: 'pass',
    });

    await client.getSubscriberStatus('271004887', {
      sequenceId: 'sequence-status-1',
      transactionId: 'transaction-status-1',
    });

    const request = mock.history.post[1];
    expect(request.headers?.SOAPAction).toBe('CAI3G#Get');
    expect(request.data).toContain('<soapenv:Header>');
    expect(request.data).toContain(
      '<cai3:SessionId>session-1</cai3:SessionId>',
    );
    expect(request.data).toContain('<cai3:Context></cai3:Context>');
    expect(request.data).toContain(
      '<cai3:SequenceId>sequence-status-1</cai3:SequenceId>',
    );
    expect(request.data).toContain(
      '<cai3:TransactionId>transaction-status-1</cai3:TransactionId>',
    );
    expect(request.data).toContain('<cai3:MOAttributes></cai3:MOAttributes>');
    expect(request.data).toContain('<cai3:extension></cai3:extension>');
    expect(request.data).toContain('<gsm:msisdn>233271004887</gsm:msisdn>');
    expect(request.data).not.toContain('SOAP-ENV');
    mock.restore();
  });

  it('logs out the active EDA session and clears it locally', async () => {
    const mock = new MockAdapter(axios);
    const endpoint = 'https://eda.example/CAI3G1.2/services/CAI3G1.2';
    mock
      .onPost(endpoint)
      .replyOnce(
        200,
        '<S:Envelope><S:Body><LoginResponse><sessionId>session-1</sessionId></LoginResponse></S:Body></S:Envelope>',
      )
      .onPost(endpoint)
      .replyOnce(
        200,
        '<S:Envelope><S:Body><LogoutResponse /></S:Body></S:Envelope>',
      )
      .onPost(endpoint)
      .replyOnce(
        200,
        '<S:Envelope><S:Body><LoginResponse><sessionId>session-2</sessionId></LoginResponse></S:Body></S:Envelope>',
      );

    const client = new EdaClient({
      baseUrl: 'https://eda.example',
      username: 'user',
      password: 'pass',
    });

    await client.getSessionId();
    const response = await client.logout({
      sequenceId: 'sequence-logout-1',
      transactionId: 'transaction-logout-1',
    });
    await client.getSessionId();

    expect(response.operation).toBe('logout');
    expect(mock.history.post[1].headers?.SOAPAction).toBe('CAI3G#Logout');
    expect(mock.history.post[1].data).toContain(
      '<cai3g:SessionId>session-1</cai3g:SessionId>',
    );
    expect(mock.history.post[1].data).toContain(
      '<cai3g:SequenceId>sequence-logout-1</cai3g:SequenceId>',
    );
    expect(mock.history.post[1].data).toContain(
      '<cai3g:TransactionId>transaction-logout-1</cai3g:TransactionId>',
    );
    expect(mock.history.post[1].data).toContain(
      '<cai3g:sessionId>session-1</cai3g:sessionId>',
    );
    expect(mock.history.post[1].data).toContain('<SOAP-ENV:Header>');
    expect(mock.history.post[2].data).toContain(
      '<cai3:userId>user</cai3:userId>',
    );
    mock.restore();
  });

  it('builds AUC delete requests with the AUC SOAP contract', async () => {
    const mock = new MockAdapter(axios);
    const endpoint = 'https://eda.example/CAI3G1.2/services/CAI3G1.2';
    mock
      .onPost(endpoint)
      .replyOnce(
        200,
        '<S:Envelope><S:Body><LoginResponse><sessionId>session-1</sessionId></LoginResponse></S:Body></S:Envelope>',
      )
      .onPost(endpoint)
      .replyOnce(
        200,
        '<S:Envelope><S:Body><DeleteResponse /></S:Body></S:Envelope>',
      );

    const client = new EdaClient({
      baseUrl: 'https://eda.example',
      username: 'user',
      password: 'pass',
    });

    const response = await client.deleteAuc('620031078646558', {
      sequenceId: 'sequence-delete-auc-1',
      transactionId: 'transaction-delete-auc-1',
    });
    const request = mock.history.post[1];

    expect(response.operation).toBe('deleteAuc');
    expect(request.headers?.SOAPAction).toBe('CAI3G#Delete');
    expect(request.data).toContain(
      '<cai3g:SequenceId>sequence-delete-auc-1</cai3g:SequenceId>',
    );
    expect(request.data).toContain(
      '<cai3g:TransactionId>transaction-delete-auc-1</cai3g:TransactionId>',
    );
    expect(request.data).toContain(
      'xmlns:gsm="http://schemas.ericsson.com/ema/UserProvisioning/GsmAuc/"',
    );
    expect(request.data).toContain(
      '<cai3g:MOType>Subscription@http://schemas.ericsson.com/ema/UserProvisioning/GsmAuc/</cai3g:MOType>',
    );
    expect(request.data).toContain('<gsm:imsi>620031078646558</gsm:imsi>');
    expect(request.data).toContain(
      '<cai3g:SessionId>session-1</cai3g:SessionId>',
    );
    expect(request.data).not.toContain('<gsm:msisdn>');
    mock.restore();
  });

  it('preserves EDA HTTP errors and response bodies', async () => {
    const mock = new MockAdapter(axios);
    const responseBody =
      '<S:Envelope><S:Body><S:Fault><faultcode>EDA-500</faultcode><faultstring>Subscriber lookup failed</faultstring></S:Fault></S:Body></S:Envelope>';
    mock
      .onPost('https://eda.example/CAI3G1.2/services/CAI3G1.2')
      .replyOnce(
        200,
        '<S:Envelope><S:Body><LoginResponse><sessionId>session-1</sessionId></LoginResponse></S:Body></S:Envelope>',
      )
      .onPost('https://eda.example/CAI3G1.2/services/CAI3G1.2')
      .replyOnce(500, responseBody);

    const client = new EdaClient({
      baseUrl: 'https://eda.example',
      username: 'user',
      password: 'pass',
    });

    await expect(client.getSubscriberStatus('271004887')).rejects.toMatchObject(
      {
        status: 500,
        expose: true,
        edaStatus: 500,
        edaResponse: responseBody,
        edaError: {
          code: 'EDA-500',
          message: 'Subscriber lookup failed',
        },
        data: {
          code: 'EDA-500',
          message: 'Subscriber lookup failed',
        },
        metadata: {
          operation: 'getSubscriberStatus',
          httpStatus: 500,
          response: responseBody,
        },
        message: expect.stringContaining('Subscriber lookup failed'),
      },
    );
    mock.restore();
  });

  it('extracts nested EDA SOAP fault details from HTTP errors', async () => {
    const mock = new MockAdapter(axios);
    const responseBody = `<?xml version='1.0' encoding='UTF-8'?>
      <S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cai3g="http://schemas.ericsson.com/cai3g1.2/">
        <S:Header><cai3g:SessionId>session-1</cai3g:SessionId></S:Header>
        <S:Body>
          <ns2:Fault xmlns:ns2="http://schemas.xmlsoap.org/soap/envelope/">
            <faultcode>ns2:Client</faultcode>
            <faultstring>This is a client fault</faultstring>
            <detail>
              <Cai3gFault:Cai3gFault xmlns:Cai3gFault="http://schemas.ericsson.com/cai3g1.2/">
                <faultcode>1001</faultcode>
                <faultreason><reasonText>Invalid sessionId.</reasonText></faultreason>
                <faultrole>MF</faultrole>
                <details>
                  <PGFault:PGFault xmlns:PGFault="http://schemas.ericsson.com/pg/1.0">
                    <errorcode>1010</errorcode>
                    <errormessage>Invalid sessionId.</errormessage>
                    <errordetails>Invalid session id. - [Processed by PG Node: TM-PL-3]</errordetails>
                  </PGFault:PGFault>
                </details>
              </Cai3gFault:Cai3gFault>
            </detail>
          </ns2:Fault>
        </S:Body>
      </S:Envelope>`;
    mock
      .onPost('https://eda.example/CAI3G1.2/services/CAI3G1.2')
      .replyOnce(
        200,
        '<S:Envelope><S:Body><LoginResponse><sessionId>session-1</sessionId></LoginResponse></S:Body></S:Envelope>',
      )
      .onPost('https://eda.example/CAI3G1.2/services/CAI3G1.2')
      .replyOnce(500, responseBody);

    const client = new EdaClient({
      baseUrl: 'https://eda.example',
      username: 'user',
      password: 'pass',
    });

    await expect(client.getSubscriberStatus('271004887')).rejects.toMatchObject(
      {
        status: 500,
        edaError: {
          code: '1010',
          message: 'Invalid sessionId.',
          faultCode: 'ns2:Client',
          faultRole: 'MF',
          cai3gFaultCode: '1001',
          pgErrorCode: '1010',
          pgErrorMessage: 'Invalid sessionId.',
          pgErrorDetails:
            'Invalid session id. - [Processed by PG Node: TM-PL-3]',
          soapMessage: 'This is a client fault',
        },
        data: {
          code: '1010',
          message: 'Invalid sessionId.',
        },
        metadata: {
          operation: 'getSubscriberStatus',
          httpStatus: 500,
          pgErrorDetails:
            'Invalid session id. - [Processed by PG Node: TM-PL-3]',
        },
        message: expect.stringContaining(
          'EDA returned HTTP 500 during getSubscriberStatus (1010): Invalid sessionId.',
        ),
      },
    );
    mock.restore();
  });

  it('throws an explicit unreachable error when EDA cannot be reached', async () => {
    const mock = new MockAdapter(axios);
    mock
      .onPost('https://eda.example/CAI3G1.2/services/CAI3G1.2')
      .networkError();

    const client = new EdaClient({
      baseUrl: 'https://eda.example',
      username: 'user',
      password: 'pass',
    });

    await expect(client.getSessionId()).rejects.toMatchObject({
      status: 503,
      expose: true,
      message: expect.stringContaining('EDA is unreachable'),
    });
    mock.restore();
  });
});
