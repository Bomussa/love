import * as path from 'path';
import { writeAtomicJSON, readJSON } from '../utils/fs-atomic.js';
import { localDateKeyAsiaQatar } from '../utils/time.js';
import { appendAudit } from '../utils/logger.js';

import CONST from "../../config/constants.json" assert { type: "json" };

type PinStore = {
  meta: { tz: string; version: number; };
  pins: Record<string, string[]>; // key = clinicId:dateKey
};

const storePath = (dateKey: string) => path.join('data','pins', `${dateKey}.json`);

export async function issueNextPin(clinicId: string, dateKey?: string) {
  const day = dateKey || localDateKeyAsiaQatar();
  const file = storePath(day);
  const store = await readJSON<PinStore>(file, { meta:{tz:CONST.TIMEZONE,version:1}, pins:{} });
  const key = `${clinicId}:${day}`;
  const seq = store.pins[key] || [];
  const [minStr, maxStr] = CONST.PIN_RANGE_PER_CLINIC as [string,string];
  const min = parseInt(minStr,10);
  const max = parseInt(maxStr,10);
  let next = seq.length ? parseInt(seq[seq.length-1],10)+1 : min;
  if (next > max) throw new Error('PIN_RANGE_EXHAUSTED');
  const pin = String(next).padStart(CONST.PIN_DIGITS, '0');
  store.pins[key] = [...seq, pin];
  await writeAtomicJSON(file, store);
  await appendAudit(`pin.issued clinic=${clinicId} dateKey=${day} pin=${pin}`);
  return { pin, dateKey: day };
}

export async function verifyPinOrThrow(clinicId: string, dateKey: string, pin: string) {
  const file = storePath(dateKey);
  const store = await readJSON<PinStore>(file, { meta:{tz:CONST.TIMEZONE,version:1}, pins:{} });
  const key = `${clinicId}:${dateKey}`;
  const ok = (store.pins[key]||[]).includes(pin);
  if (!ok) throw new Error('INVALID_PIN');
  return true;
}
