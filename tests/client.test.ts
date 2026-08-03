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

    await client.getSubscriberStatus('271004887');

    expect(events.some((event) => event.includes('sending request'))).toBe(
      true,
    );
    expect(events.some((event) => event.includes('received response'))).toBe(
      true,
    );
    expect(events.some((event) => event.includes('success'))).toBe(true);
    mock.restore();
  });
});
