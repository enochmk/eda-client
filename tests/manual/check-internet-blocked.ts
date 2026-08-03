import { client, print, value } from './_setup';

print(await client().checkInternetBlocked(value('EDA_MSISDN', 2)));
