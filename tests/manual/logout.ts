import { client, print } from './_setup';

const eda = client();
await eda.getSessionId();
print(await eda.logout());
