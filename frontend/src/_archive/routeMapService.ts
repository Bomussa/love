import { readJSON } from '../../utils/fs-atomic.js';
import * as path from 'path';

const ROUTE_MAP_FILE = path.join(process.cwd(), 'config', 'routeMap.json');

export async function getRouteMap() {
  return await readJSON(ROUTE_MAP_FILE, {});
}

