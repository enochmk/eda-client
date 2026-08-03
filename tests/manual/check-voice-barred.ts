import { client, print, value } from './_setup';

print(await client().checkVoiceBarred(value('EDA_MSISDN', 2)));
