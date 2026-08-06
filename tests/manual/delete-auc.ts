import { client, print, value } from './_setup';

print(await client().deleteAuc(value('EDA_IMSI', 2)));
