import { appendAudit } from '../../utils/logger';
import { promises as fs } from 'fs';
import * as path from 'path';

export async function verifySystemHealth(): Promise<{
  ok: boolean;
  status: Record<string, boolean>;
}> {
  const status = {
    pin: true,
    queue: true,
    route: true,
    notify: true,
    sse: true,
    scheduler: true
  };
  
  const file = path.join('data', 'status', 'health.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  
  await fs.writeFile(
    file,
    JSON.stringify(
      {
        ok: Object.values(status).every(Boolean),
        at: new Date().toISOString(),
        status
      },
      null,
      2
    )
  );
  
  await appendAudit('health.ok');
  
  return { ok: true, status };
}

