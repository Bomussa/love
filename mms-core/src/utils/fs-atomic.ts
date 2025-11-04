import { promises as fs } from 'fs';
import * as path from 'path';

export async function writeAtomicJSON(file: string, data: any): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

export async function readJSON<T = any>(file: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(file, 'utf8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

