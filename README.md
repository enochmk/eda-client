# @enochmk/eda-client

Typed TypeScript client for AirtelTigo Ericsson Data Access (EDA) SOAP services.

The library wraps the Ericsson CAI3G SOAP API used to provision and inspect
AirtelTigo AUC and HLR subscriber records. It handles XML request creation,
session management, MSISDN normalization, XML parsing, structured EDA faults,
and transport errors.

## Installation

```bash
npm install @enochmk/eda-client
```

## Configuration

Create a client with the EDA base URL and credentials:

```ts
import { EdaClient } from '@enochmk/eda-client';

const eda = new EdaClient({
  baseUrl: 'https://your-eda-host',
  username: 'your-username',
  password: 'your-password',
});
```

Optional settings are:

- `timeout` — request timeout in milliseconds; defaults to `15000`.
- `rejectUnauthorized` — TLS certificate validation; defaults to `true`.
- `logger` — logger with optional `debug`, `verbose`, `info`, `warn`, and
  `error` methods.
- `aucPath` — AUC create provisioning path; defaults to `/Provisioning`.
  AUC deletion uses the core CAI3G endpoint
  `/CAI3G1.2/services/CAI3G1.2`.

## Usage

The client logs in automatically before the first operation and reuses the
session for subsequent operations. Call `logout()` when the client is done:

```ts
const eda = new EdaClient({
  baseUrl: process.env.EDA_BASE_URL!,
  username: process.env.EDA_USERNAME!,
  password: process.env.EDA_PASSWORD!,
});

let sessionEstablished = false;
try {
  await eda.getSessionId();
  sessionEstablished = true;

  await eda.createAuc('your-imsi', 'your-ki');
  await eda.createHlr('271004887', 'your-imsi');
  await eda.unbarInternet('271004887');

  const status = await eda.getSubscriberStatus('271004887');
  console.log(status.data);
} finally {
  if (sessionEstablished) await eda.logout();
}
```

MSISDNs may be supplied as 9, 10, or 12 digits. They are normalized to the
local 9-digit form and sent to EDA with Ghana's `233` country code.

## Operations

- `getSessionId(force?)` — establish or reuse an EDA session.
- `logout(options?)` — close the active EDA session. It throws a `400` error if
  no session has been established.
- `createAuc(imsi, ki, options?)` — create an
  authentication-center subscriber record.
- `deleteAuc(imsi, options?)` — delete an AUC subscriber record.
- `createHlr(msisdn, imsi, options?)` — create a
  home-location-register subscriber profile.
- `refreshNumber(msisdn, imsi, ki, options?)` — delete and recreate the HLR
  and AUC records, then return the final HLR status.
- `simSwap(msisdn, params)` — replace the number's old IMSI/AUC records with a
  target IMSI and Ki, then return the final HLR status.
- `deleteHlr(msisdn, options?)` — delete an HLR subscriber profile.
- `barVoice(msisdn, options?)` / `unbarVoice(msisdn, options?)` — update voice
  barring.
- `unbarInternet(msisdn, options?)` — remove the internet block.
- `getSubscriberStatus(msisdn, options?)` — retrieve the complete parsed HLR
  profile.
- `checkVoiceBarred(msisdn, options?)` — return whether voice is barred.
- `checkInternetBlocked(msisdn, options?)` — return whether internet is blocked.

The optional request options object is:

```ts
{
  sequenceId?: string;
  transactionId?: string;
}
```

For example:

```ts
await eda.createHlr(msisdn, imsi, { sequenceId, transactionId });
await eda.deleteAuc(imsi, { sequenceId, transactionId });
await eda.getSubscriberStatus(msisdn, { sequenceId, transactionId });
```

Each omitted ID is generated as a UUID, including when the entire options
object is omitted.

To refresh a subscriber's HLR and AUC records:

```ts
const result = await eda.refreshNumber(msisdn, imsi, ki);
console.log(result.getHlr.data);
```

The required values are the subscriber's `msisdn`, `imsi`, and `ki`. The
optional fourth argument allows request IDs to be supplied independently for
each step:

```ts
await eda.refreshNumber(msisdn, imsi, ki, {
  deleteHlr: { sequenceId, transactionId },
  deleteAuc: { sequenceId, transactionId },
  createHlr: { sequenceId, transactionId },
  createAuc: { sequenceId, transactionId },
  getHlr: { sequenceId, transactionId },
});
```

To perform a complete EDA-only SIM swap:

```ts
const result = await eda.simSwap(msisdn, {
  oldImsi,
  targetImsi,
  targetKi,
});

console.log(result.getHlr.data);
```

EDA does not use ICCIDs. The caller must resolve the old and target SIM values
before calling `simSwap`. Optional request IDs can be supplied per step:

```ts
await eda.simSwap(msisdn, {
  oldImsi,
  targetImsi,
  targetKi,
  requests: {
    deleteHlr: { sequenceId, transactionId },
    deleteAuc: { sequenceId, transactionId },
    createHlr: { sequenceId, transactionId },
    createAuc: { sequenceId, transactionId },
    getHlr: { sequenceId, transactionId },
  },
});
```

Provisioning and status operations return:

```ts
{
  operation: string;
  data: unknown;
  rawXml: string;
}
```

The two `check*` methods return booleans.

## Error handling

EDA errors are thrown as `http-errors` instances. If EDA responds with a SOAP
fault, the error includes the important values in `data` and the remaining
fault context in `metadata`:

```ts
try {
  await eda.getSubscriberStatus('271004887');
} catch (error) {
  const err = error as Error & {
    status?: number;
    data?: { code?: string; message?: string };
    metadata?: {
      operation?: string;
      httpStatus?: number;
      faultCode?: string;
      cai3gFaultCode?: string;
      faultRole?: string;
      pgErrorCode?: string;
      pgErrorDetails?: string;
      response?: unknown;
      rawXml?: string;
    };
  };

  console.error(err.status, err.data?.code, err.data?.message);
  console.error(err.metadata?.pgErrorDetails);
}
```

Connection failures throw a `503` error stating that EDA is unreachable. An
HTTP response from EDA preserves its HTTP status and response body. Existing
`edaError` and `edaResponse` properties are also retained for compatibility.

## Manual commands

Copy `.env.example` to `.env` and fill in the EDA credentials and test identifiers. The `.env` file is git-ignored.

```bash
npm install
npm run test:login
npm run test:logout
npm run test:create-auc
npm run test:delete-auc
npm run test:create-hlr
npm run test:delete-hlr
npm run test:bar-voice
npm run test:unbar-voice
npm run test:unbar-internet
npm run test:get-subscriber-status
npm run test:check-voice-barred
npm run test:check-internet-blocked
```

MSISDN, IMSI, and Ki can be supplied as positional arguments where applicable:

```bash
npm run test:create-hlr -- 271004887 233xxxxxxxxxxx
npm run test:create-auc -- 233xxxxxxxxxxx abcdef0123456789abcdef0123456789
npm run test:delete-auc -- 233xxxxxxxxxxx
```

These commands perform live EDA operations. `createAuc`, `deleteAuc`,
`createHlr`, `deleteHlr`, and barring commands change subscriber state. Run
read-only status checks before running them.

## Development

```bash
npm run typecheck
npm test
npm run prettier
npm run build
```
