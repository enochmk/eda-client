import { client, print } from './_setup';

print(await client().getSessionId());
