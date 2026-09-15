import { describe, expect, it } from 'vitest';
import {
  createAuc,
  createHlr,
  deleteAuc,
  deleteHlr,
  getSubscriberStatus,
  logout,
  setVoice,
  setSms,
  unbarInternet,
} from '../src/templates';

describe('EDA SOAP templates', () => {
  it('uses caller-provided sequence and transaction IDs for every operation template', () => {
    const sequenceId = 'sequence-1';
    const transactionId = 'transaction-1';
    const options = { sequenceId, transactionId };
    const payloads = [
      logout('session-1', options),
      createAuc('session-1', 'imsi-1', 'ki-1', options),
      deleteAuc('session-1', 'imsi-1', options),
      createHlr('session-1', '271004887', 'imsi-1', {
        ...options,
        paidMode: 'PREPAID',
      }),
      deleteHlr('session-1', '271004887', options),
      setVoice('session-1', '271004887', true, options),
      setSms('session-1', '271004887', true, options),
      unbarInternet('session-1', '271004887', options),
      getSubscriberStatus('session-1', '271004887', options),
    ];

    for (const payload of payloads) {
      expect(payload).toMatch(
        new RegExp(`<[^:]+:SequenceId>${sequenceId}</[^:]+:SequenceId>`),
      );
      expect(payload).toMatch(
        new RegExp(
          `<[^:]+:TransactionId>${transactionId}</[^:]+:TransactionId>`,
        ),
      );
    }
  });

  it('generates omitted sequence and transaction IDs for every operation template', () => {
    const payloads = [
      logout('session-1'),
      createAuc('session-1', 'imsi-1', 'ki-1'),
      deleteAuc('session-1', 'imsi-1'),
      createHlr('session-1', '271004887', 'imsi-1', { paidMode: 'PREPAID' }),
      deleteHlr('session-1', '271004887'),
      setVoice('session-1', '271004887', true),
      setSms('session-1', '271004887', true),
      unbarInternet('session-1', '271004887'),
      getSubscriberStatus('session-1', '271004887'),
    ];
    const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

    for (const payload of payloads) {
      expect(payload).toMatch(
        new RegExp(`<[^:]+:SequenceId>${uuid}</[^:]+:SequenceId>`, 'i'),
      );
      expect(payload).toMatch(
        new RegExp(`<[^:]+:TransactionId>${uuid}</[^:]+:TransactionId>`, 'i'),
      );
    }
  });

  it('generates either ID independently when only one is supplied', () => {
    const sequenceOnly = deleteAuc('session-1', 'imsi-1', {
      sequenceId: 'sequence-1',
    });
    const transactionOnly = deleteAuc('session-1', 'imsi-1', {
      transactionId: 'transaction-1',
    });
    const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

    expect(sequenceOnly).toContain(
      '<cai3g:SequenceId>sequence-1</cai3g:SequenceId>',
    );
    expect(sequenceOnly).toMatch(
      new RegExp(`<cai3g:TransactionId>${uuid}</cai3g:TransactionId>`, 'i'),
    );
    expect(transactionOnly).toMatch(
      new RegExp(`<cai3g:SequenceId>${uuid}</cai3g:SequenceId>`, 'i'),
    );
    expect(transactionOnly).toContain(
      '<cai3g:TransactionId>transaction-1</cai3g:TransactionId>',
    );
  });

  it('sets both HLR SMS directions when barring and unblocking', () => {
    const barred = setSms('session-1', '271004887', true);
    const unbarred = setSms('session-1', '271004887', false);

    expect(barred).toContain('<gsm:ts21>0</gsm:ts21><gsm:ts22>0</gsm:ts22>');
    expect(unbarred).toContain('<gsm:ts21>1</gsm:ts21><gsm:ts22>1</gsm:ts22>');
  });

  it.each([
    ['PREPAID', 0, 3],
    ['POSTPAID', 2, 1],
    ['HYBRID', 4, 3],
  ] as const)(
    'maps %s paid mode to HLR stype and rsa',
    (paidMode, stype, rsa) => {
      const payload = createHlr('session-1', '271004887', 'imsi-1', {
        paidMode,
      });

      expect(payload).toContain('<gsm:csp>220</gsm:csp>');
      expect(payload).toContain(`<gsm:stype>${stype}</gsm:stype>`);
      expect(payload).toContain(`<gsm:rsa>${rsa}</gsm:rsa>`);
    },
  );
});
