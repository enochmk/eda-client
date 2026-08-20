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
session for subsequent operations. Login requests are single-flight, so
concurrent operations share one login request. If EDA rejects an operation
with a recognized expired or invalid session fault (`1001`, `1005`, `1010`, or
`3014`), the client discards the affected cached session, authenticates again,
rebuilds the SOAP request with the new session ID, and retries that operation
once. Other EDA faults are returned unchanged. Call `logout()` when the client
is done:

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

Every operation except login accepts request IDs in its final optional options
object. Operations establish an EDA session automatically when needed.

| Function                                    | Required parameters                           | What it does                                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getSessionId(force?)`                      | None                                          | Logs in and returns the session ID. Reuses the cached session unless `force` is `true`.                                                                            |
| `logout(options?)`                          | None                                          | Logs out and clears the cached session. Throws status `400` if no session exists.                                                                                  |
| `createAuc(imsi, ki, options?)`             | `imsi`, `ki`                                  | Creates the authentication-center record. EDA code `301` is treated as an idempotent success and returned as a warning.                                            |
| `deleteAuc(imsi, options?)`                 | `imsi`                                        | Deletes the AUC record identified by IMSI.                                                                                                                         |
| `createHlr(msisdn, imsi, options?)`         | `msisdn`, `imsi`                              | Creates the HLR subscription using the library's provisioned voice, SMS, data, forwarding, and profile defaults. EDA codes `2` and `301` are returned as warnings. |
| `deleteHlr(msisdn, options?)`               | `msisdn`                                      | Deletes the HLR subscription identified by MSISDN.                                                                                                                 |
| `barVoice(msisdn, options?)`                | `msisdn`                                      | Sets both outgoing and incoming voice-barring values (`obo` and `obi`) to `1`.                                                                                     |
| `unbarVoice(msisdn, options?)`              | `msisdn`                                      | Sets both voice-barring values to `0`.                                                                                                                             |
| `unbarInternet(msisdn, options?)`           | `msisdn`                                      | Sets `pdpcp=1`, `nam.prov=0`, and `nam.keep=1` to remove the internet block.                                                                                       |
| `getSubscriberStatus(msisdn, options?)`     | `msisdn`                                      | Gets and parses the complete HLR subscriber profile.                                                                                                               |
| `checkVoiceBarred(msisdn, options?)`        | `msisdn`                                      | Returns `true` when either `obi` or `obo` equals `1`.                                                                                                              |
| `checkInternetBlocked(msisdn, options?)`    | `msisdn`                                      | Returns `true` when `nam.prov` equals `1`.                                                                                                                         |
| `refreshNumber(msisdn, imsi, ki, options?)` | `msisdn`, current `imsi`, current `ki`        | Rebuilds the same subscriber's HLR and AUC records and returns each step.                                                                                          |
| `simSwap(msisdn, params)`                   | `msisdn`, `oldImsi`, `targetImsi`, `targetKi` | Moves the MSISDN from the old IMSI to the target IMSI entirely within EDA and returns each step.                                                                   |

### Identifier rules

- `msisdn` may contain formatting characters, but its digits must total 9, 10,
  or 12. The client keeps the final 9 digits and sends them with country code
  `233`.
- `imsi` is passed to EDA unchanged. The library does not derive or validate it.
- `ki` is required only when creating an AUC record. Treat it as sensitive
  authentication material.
- EDA does not use an ICCID in these calls. For a SIM swap, the caller must
  resolve the target ICCID to its `targetImsi` and `targetKi` before invoking
  this library.

### Request IDs

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
object is omitted. `sequenceId` and `transactionId` are generated independently
for every SOAP operation. They are not the EDA session ID.

### Session recovery

EDA sessions can expire or be invalidated by the EDA platform while a client
instance is still running. Session faults are recognized from the structured
EDA fault code and are retried once after re-authentication. The original SOAP
request is rebuilt so the retry contains the new session ID. A second session
fault, a login failure, or any non-session EDA fault is raised to the caller.

The cached session is local to an `EdaClient` instance. Applications that use a
long-lived client should reuse that instance for related operations and should
not call `logout()` while other operations are in progress.

### Return values

Mutation and status operations return an `EdaResponse`:

```ts
interface EdaResponse<T = unknown> {
  operation: string;
  data: T; // parsed EDA XML
  rawXml: string; // original EDA response
  warnings?: Array<{
    code: string;
    message: string;
    ignored: true;
    httpStatus?: number;
    raw?: unknown;
  }>;
}
```

`getSubscriberStatus` returns `EdaResponse<SubscriberStatus>`. The two `check*`
functions return booleans. `refreshNumber` and `simSwap` return an object
containing the response from every completed step.

## Refreshing a number

Use `refreshNumber` when the MSISDN is acting up but must remain on the same SIM
identity. It deletes and recreates the subscriber using the supplied valid IMSI
and Ki.

The exact sequence is:

```text
Get/reuse session
  -> Delete HLR by MSISDN
  -> Delete AUC by IMSI
  -> Create HLR with MSISDN + IMSI
  -> Create AUC with IMSI + Ki
  -> Get final HLR status by MSISDN
```

Basic usage:

```ts
const result = await eda.refreshNumber(msisdn, imsi, ki);
console.log(result.getHlr.data);
```

The optional fourth argument supplies request IDs independently for each step:

```ts
await eda.refreshNumber(msisdn, imsi, ki, {
  deleteHlr: { sequenceId, transactionId },
  deleteAuc: { sequenceId, transactionId },
  createHlr: { sequenceId, transactionId },
  createAuc: { sequenceId, transactionId },
  getHlr: { sequenceId, transactionId },
});
```

The result has `deleteHlr`, `deleteAuc`, `createHlr`, `createAuc`, and `getHlr`
properties. Check the final status and inspect `warnings` on each response.

## Complete EDA SIM swap

Use `simSwap` to move an existing MSISDN from its old IMSI to a target SIM's
IMSI. This function operates only on EDA; it does not read an ICCID or update
another client or system.

Required input:

| Parameter    | Meaning                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `msisdn`     | Number currently linked to the old SIM and to be linked to the target SIM.                                               |
| `oldImsi`    | IMSI currently associated with the number. Its AUC record is deleted to completely unlink and free the old SIM identity. |
| `targetImsi` | IMSI belonging to the target SIM. It is used for the new HLR and AUC records.                                            |
| `targetKi`   | Ki belonging to `targetImsi`. It is used only when creating the target AUC record.                                       |

The exact sequence is:

```text
Get/reuse session
  -> Delete HLR by MSISDN
  -> Delete old AUC by oldImsi
  -> Create HLR with MSISDN + targetImsi
  -> Create/accept target AUC with targetImsi + targetKi
  -> Get final HLR status by MSISDN
```

Basic usage:

```ts
const result = await eda.simSwap(msisdn, {
  oldImsi,
  targetImsi,
  targetKi,
});

console.log(result.getHlr.data);
```

Optional request IDs can be supplied per step:

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

The result has the same five response properties as `refreshNumber`:
`deleteHlr`, `deleteAuc`, `createHlr`, `createAuc`, and `getHlr`.

### Existing target AUC and code 301

`simSwap` deliberately deletes the AUC for `oldImsi`; it does not delete the
AUC for `targetImsi`. Deleting the target AUC first is unnecessary when it
already contains the intended IMSI and Ki, and would create an avoidable gap.

The client still calls `createAuc(targetImsi, targetKi)`. If EDA responds with
code `301` because that target AUC already exists, the client:

- treats the step as successful so the SIM swap continues;
- preserves the EDA fault in `result.createAuc.warnings`;
- includes the parsed details, original response, and HTTP status when
  available; and
- logs the ignored response at `warn` level.

Code `301` proves that the AUC record exists, but it does not prove that its
stored Ki equals `targetKi`. The caller must ensure the ICCID-to-IMSI/Ki source
is authoritative before starting the swap.

### Composite-operation failure behavior

`refreshNumber` and `simSwap` run sequentially and stop on the first
non-ignored error. They do not roll back earlier EDA changes. For example, if
target AUC creation fails after HLR creation, the new HLR remains in EDA and the
caller must use the error details and operation logs to recover safely.

Successful idempotent responses are not hidden:

```ts
const result = await eda.simSwap(msisdn, params);

for (const [step, response] of Object.entries(result)) {
  if (response.warnings?.length) {
    console.warn(step, response.warnings);
  }
}
```

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

The configured logger records the operation name and subscriber context for
the request lifecycle. Ignored EDA faults are logged at `warn`; failures are
logged at `error` with the message, stack, status, code, structured EDA data,
metadata, raw XML/response, and cause when available. The Ki is not included in
the logging context.

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
