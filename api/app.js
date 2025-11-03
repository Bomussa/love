const express = require('express');
const cors = require('cors');

/**
 * Simple queue management server for the Medical Committee application.
 *
 * This Express application implements a lightweight in‑memory queue with
 * endpoints that mirror the requirements outlined in the specification.  The
 * endpoints allow clients to start a session, check in, finish an exam,
 * query the current status, retrieve aggregated statistics, and fetch a
 * summary report.  While this implementation stores all state in RAM, it is
 * structured so that the storage layer can be swapped out for a database
 * (e.g. Supabase) without changing the API surface.  The goal is to
 * provide a functional prototype that demonstrates queue logic and can be
 * expanded or replaced with cloud functions in a production setting.
 */

const app = express();
app.use(cors());
app.use(express.json());

// In‑memory storage for queues.  Each clinic (or visit type) gets its own
// queue.  A queue is an array of visitor records ordered by arrival.
const queues = {};

// Record of finished sessions for reporting and statistics.
const history = [];

/**
 * Assign the next available number in a queue.  If the queue does not exist,
 * it will be created automatically.
 *
 * @param {string} clinicId – Unique identifier for the clinic or visit type.
 * @returns {number} The next queue number.
 */
function assignQueueNumber(clinicId) {
  if (!queues[clinicId]) {
    queues[clinicId] = [];
  }
  const queue = queues[clinicId];
  // The next number is one greater than the highest existing number, or 1 if empty.
  return queue.length ? queue[queue.length - 1].number + 1 : 1;
}

/**
 * Find a visitor in a given clinic queue by their unique ID.
 *
 * @param {string} clinicId – Clinic identifier.
 * @param {string} visitorId – Visitor ID.
 * @returns {object|null} The visitor object or null if not found.
 */
function findVisitor(clinicId, visitorId) {
  const queue = queues[clinicId] || [];
  return queue.find(v => v.id === visitorId) || null;
}

/**
 * Remove a visitor from a clinic queue.  Mutates the queue in place.
 *
 * @param {string} clinicId – Clinic identifier.
 * @param {string} visitorId – Visitor ID to remove.
 */
function removeVisitor(clinicId, visitorId) {
  if (!queues[clinicId]) return;
  queues[clinicId] = queues[clinicId].filter(v => v.id !== visitorId);
}

// POST /start-session
// Starts a new queue session by scanning a barcode.  Returns the visitor
// record, which includes their assigned number and initial status.  The
// client should provide a clinicId (or visit type) to determine which
// queue to join.
app.post('/start-session', (req, res) => {
  const { clinicId } = req.body;
  if (!clinicId) {
    return res.status(400).json({ error: 'clinicId is required' });
  }
  const number = assignQueueNumber(clinicId);
  const visitor = {
    id: `${clinicId}-${Date.now()}`,
    number,
    clinicId,
    status: 'waiting',
    assignedAt: Date.now(),
    checkInTime: null,
    finishedAt: null,
  };
  queues[clinicId].push(visitor);
  res.json(visitor);
});

// POST /queue/check-in
// Marks a visitor as checked in.  Expects clinicId and visitorId.  Once
// checked in, the two‑minute countdown for the clinic begins (handled on
// the client side).  The visitor remains at the front of the queue until
// they finish or time out.
app.post('/queue/check-in', (req, res) => {
  const { clinicId, visitorId } = req.body;
  const visitor = findVisitor(clinicId, visitorId);
  if (!visitor) {
    return res.status(404).json({ error: 'Visitor not found' });
  }
  visitor.status = 'checked_in';
  visitor.checkInTime = Date.now();
  res.json(visitor);
});

// POST /queue/finish
// Finishes an exam for a visitor, removes them from the queue and records
// the session in history.  Expects clinicId and visitorId.
app.post('/queue/finish', (req, res) => {
  const { clinicId, visitorId } = req.body;
  const visitor = findVisitor(clinicId, visitorId);
  if (!visitor) {
    return res.status(404).json({ error: 'Visitor not found' });
  }
  visitor.status = 'finished';
  visitor.finishedAt = Date.now();
  // remove from queue and push into history
  removeVisitor(clinicId, visitorId);
  history.push(visitor);
  res.json(visitor);
});

// GET /queue/status
// Returns the current queue for a clinic, including each visitor's status.
// Optionally accepts visitorId to filter the response.
app.get('/queue/status', (req, res) => {
  const { clinicId, visitorId } = req.query;
  if (!clinicId) {
    return res.status(400).json({ error: 'clinicId is required' });
  }
  let queue = queues[clinicId] || [];
  if (visitorId) {
    queue = queue.filter(v => v.id === visitorId);
  }
  res.json(queue);
});

// GET /stats/overview
// Returns aggregated statistics per clinic, including current queue length
// and the number of completed sessions for today.
app.get('/stats/overview', (req, res) => {
  const stats = Object.keys(queues).map(clinicId => {
    const queue = queues[clinicId] || [];
    const finishedToday = history.filter(h => h.clinicId === clinicId &&
      new Date(h.finishedAt).toDateString() === new Date().toDateString()
    ).length;
    return {
      clinicId,
      waiting: queue.length,
      finishedToday,
    };
  });
  res.json(stats);
});

// GET /reports
// Returns a simple report of all sessions.  For brevity, this endpoint
// returns JSON; in a production app you might generate a CSV or PDF.
app.get('/reports', (req, res) => {
  res.json(history);
});

// Start the server if this file is executed directly.  When deployed as
// Vercel Edge Functions or Supabase functions, the framework will handle
// invocation.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Queue server listening on port ${PORT}`);
  });
}

module.exports = app;
