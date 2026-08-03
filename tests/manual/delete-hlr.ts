import { client, print, value } from './_setup';

print(await client().deleteHlr(value('EDA_MSISDN', 2)));
