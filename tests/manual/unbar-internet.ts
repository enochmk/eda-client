import { client, print, value } from './_setup';

print(await client().unbarInternet(value('EDA_MSISDN', 2)));
