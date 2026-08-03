# @enochmk/eda-client

Typed TypeScript client for AirtelTigo Ericsson Data Access (EDA) SOAP services.

## Installation

```bash
npm install @enochmk/eda-client
```

## Usage

```ts
import { EdaClient } from '@enochmk/eda-client';

const eda = new EdaClient({
  baseUrl: 'https://your-eda-host',
  username: 'your-username',
  password: 'your-password',
});

await eda.createAuc('your-imsi', 'your-ki');
await eda.createHlr('271004887', 'your-imsi');
await eda.unbarInternet('271004887');

const status = await eda.getSubscriberStatus('271004887');
console.log(status.data);
```

The client authenticates with EDA as needed and reuses the session for subsequent calls. A new session is created for a new client instance. MSISDNs may be supplied as 9, 10, or 12 digits and are normalized to the local 9-digit form before being sent to EDA.

## Actions

- `getSessionId(force?)`
- `createAuc(imsi, ki)`
- `createHlr(msisdn, imsi)`
- `deleteHlr(msisdn)`
- `barVoice(msisdn)`
- `unbarVoice(msisdn)`
- `unbarInternet(msisdn)`
- `getSubscriberStatus(msisdn)`
- `checkVoiceBarred(msisdn)`
- `checkInternetBlocked(msisdn)`

Provisioning methods return `{ operation, data, rawXml }`. The status checks return booleans.

## Manual commands

Copy `.env.example` to `.env` and fill in the EDA credentials and test identifiers. The `.env` file is git-ignored.

```bash
npm install
npm run test:login
npm run test:create-auc
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
```

These commands perform live EDA operations. Run read-only status checks before running create, delete, or barring commands.
