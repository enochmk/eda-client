import { client, print, value } from './_setup';

print(await client().barVoice(value('EDA_MSISDN', 2)));
