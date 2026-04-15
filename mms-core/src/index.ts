import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { pinRouter } from './api/routes/pin';
import { queueRouter } from './api/routes/queue';
import { routeRouter } from './api/routes/route';
import { eventsRouter } from './api/routes/events';
import { verifySystemHealth } from './core/monitor/health-check';
import { clinicCallSchedulerTick } from './core/queueManager';
import { log } from './utils/logger';

const CONST = require('../config/constants.json');
const CLINICS = require('../config/clinics.json');

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.use('/api/pin', pinRouter);
app.use('/api/queue', queueRouter);
app.use('/api/route', routeRouter);
app.use('/api/events', eventsRouter);

app.get('/api/health', async (_req, res) => {
  const h = await verifySystemHealth();
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    health: h,
    settingsSummary: {
      QUEUE_INTERVAL_SECONDS: CONST.QUEUE_INTERVAL_SECONDS,
      PIN_LATE_MINUTES: CONST.PIN_LATE_MINUTES,
      MOBILE_QR_ONLY: CONST.MOBILE_QR_ONLY,
      DESKTOP_BASIC_AUTH: CONST.DESKTOP_BASIC_AUTH
    }
  });
});

app.get('/api/clinics', (_req, res) => {
  res.json({ ok: true, clinics: CLINICS });
});

app.get('/api/constants', (_req, res) => {
  res.json({ ok: true, constants: CONST });
});

const clinicIds = Object.keys(CLINICS);
log(`Starting clinic call scheduler for ${clinicIds.length} clinics...`);

setInterval(() => {
  clinicIds.forEach(cid => {
    clinicCallSchedulerTick(cid).catch(err => {
      console.error(`Scheduler error for ${cid}:`, err.message);
    });
  });
}, (CONST.QUEUE_INTERVAL_SECONDS || 120) * 1000);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  log(`✅ MMS Core Server listening on port ${PORT}`);
  log(`📊 Queue interval: ${CONST.QUEUE_INTERVAL_SECONDS}s`);
  log(`🏥 Clinics: ${clinicIds.length}`);
  log(`🌍 Timezone: ${CONST.TIMEZONE}`);
  log(`⏰ Service day pivot: ${CONST.SERVICE_DAY_PIVOT}`);
});

