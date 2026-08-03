import { client, print, value } from './_setup';

print(await client().createHlr(value('EDA_MSISDN', 2), value('EDA_IMSI', 3)));
