import * as path from 'path';
import { readJSON } from '../../utils/fs-atomic.js';

const FRONTEND_CONFIG_DIR = path.join(process.cwd(), 'frontend', 'config');
const LEGACY_CONFIG_DIR = path.join(process.cwd(), 'config');

function resolveConfigPath(filename: 'routeMap.json' | 'clinics.json') {
  return {
    canonical: path.join(FRONTEND_CONFIG_DIR, filename),
    legacy: path.join(LEGACY_CONFIG_DIR, filename),
  };
}

async function loadConfigFile<T>(filename: 'routeMap.json' | 'clinics.json'): Promise<T> {
  const { canonical, legacy } = resolveConfigPath(filename);
  const fromCanonical = await readJSON<T | null>(canonical, null);
  if (fromCanonical) return fromCanonical;
  return await readJSON<T>(legacy, {} as T);
}

export async function loadRouteMap() {
  return loadConfigFile<Record<string, any>>('routeMap.json');
}

export async function loadClinics() {
  return loadConfigFile<Record<string, any>>('clinics.json');
}
