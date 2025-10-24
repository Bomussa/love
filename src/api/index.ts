import { Hono } from 'hono';
// import { serveStatic } from 'hono/cloudflare-pages';
import { assignTicket, markDone, clinicCallSchedulerTick } from '../core/queueManager.js';
import { issueNextPin, verifyPinOrThrow } from '../core/pinService.js';
import { createRoute, assignFirstClinicTicket, getRoute, markClinicDone, getNextClinic } from '../core/routing/routeService.js';
import { getRouteMap } from '../core/routing/routeMapService.js';
import { appendAudit, log } from '../utils/logger.js';

const app = new Hono();

// Static files

// API Endpoints
app.post('/api/pin/issue', async (c) => {
  const { clinicId, dateKey } = await c.req.json();
  try {
    const result = await issueNextPin(clinicId, dateKey);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/api/pin/verify', async (c) => {
  const { clinicId, dateKey, pin } = await c.req.json();
  try {
    const result = await verifyPinOrThrow(clinicId, dateKey, pin);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/api/queue/assignTicket', async (c) => {
  const { clinicId, visitId, issuedAt } = await c.req.json();
  try {
    const result = await assignTicket(clinicId, visitId, issuedAt);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/api/queue/markDone', async (c) => {
  const { clinicId, visitId, ticket } = await c.req.json();
  try {
    const result = await markDone(clinicId, visitId, ticket);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/api/queue/tick', async (c) => {
  const { clinicId } = await c.req.json();
  try {
    await clinicCallSchedulerTick(clinicId);
    return c.json({ ok: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/api/route/create', async (c) => {
  const { visitId, examType, gender } = await c.req.json();
  try {
    const result = await createRoute(visitId, examType, gender);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/api/route/assignFirstClinicTicket', async (c) => {
  const { visitId } = await c.req.json();
  try {
    const result = await assignFirstClinicTicket(visitId, async (cid: string) => { const { pin, dateKey } = await issueNextPin(cid); return { ticket: parseInt(pin), dateKey }; });
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.get('/api/route/:visitId', async (c) => {
  const { visitId } = c.req.param();
  try {
    const result = await getRoute(visitId);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/api/route/markClinicDone', async (c) => {
  const { visitId, clinicId } = await c.req.json();
  try {
    const result = await markClinicDone(visitId, clinicId);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.get('/api/route/:visitId/nextClinic', async (c) => {
  const { visitId } = c.req.param();
  try {
    const result = await getNextClinic(visitId);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.get('/api/routeMap', async (c) => {
  try {
    const result = await getRouteMap();
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default app;

log("API initialized");
