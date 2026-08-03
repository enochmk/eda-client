import { client, print, value } from './_setup';

print(await client().getSubscriberStatus(value('EDA_MSISDN', 2)));
