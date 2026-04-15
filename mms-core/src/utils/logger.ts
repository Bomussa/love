import { promises as fs } from 'fs';
import * as path from 'path';

export async function appendAudit(line: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join('data', 'audit', `${date}.log`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${new Date().toISOString()} ${line}\n`, 'utf8');
}

export const log = (...args: any[]) => console.log('[MMS]', ...args);

