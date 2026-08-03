import { client, print, value } from './_setup';

print(await client().unbarVoice(value('EDA_MSISDN', 2)));
