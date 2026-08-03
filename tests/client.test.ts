import { describe, expect, it } from 'vitest';
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
});
