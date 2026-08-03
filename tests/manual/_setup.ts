import 'dotenv/config';
import { EdaClient } from '../../src';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith('your-'))
    throw new Error(`Set ${name} in .env before running this command`);
  return value;
}

export function client(): EdaClient {
  return new EdaClient({
    baseUrl: required('EDA_BASE_URL'),
    username: required('EDA_USERNAME'),
    password: required('EDA_PASSWORD'),
    timeout: Number(process.env.EDA_TIMEOUT ?? 15000),
    rejectUnauthorized: process.env.EDA_REJECT_UNAUTHORIZED !== 'false',
    logger: { info: (message, context) => console.log(message, context ?? '') },
  });
}

export function value(name: string, argumentIndex: number): string {
  const value = process.argv[argumentIndex] ?? process.env[name];
  if (!value || value.startsWith('your-'))
    throw new Error(`Provide ${name} in .env or as a command argument`);
  return value;
}

export function print(result: unknown): void {
  console.dir(result, { depth: null });
}
