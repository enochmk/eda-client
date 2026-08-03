import { client, print, value } from './_setup';

print(await client().createAuc(value('EDA_IMSI', 2), value('EDA_KI', 3)));
