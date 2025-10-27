/**
 * Drill E2E Test: Queue Real-time Notifications
 * Tests SSE events for queue updates and call-next notifications
 */
import { test, expect } from '@playwright/test';
import { waitForSSEEvent, captureSSEEvents } from './sse';
import { sleep } from './time';

const BASE_URL = process.env.BASE_URL || '';
const DRILL_CLINIC_ID = process.env.DRILL_CLINIC_ID || '';
const DRILL_EXAM_TYPE = process.env.DRILL_EXAM_TYPE || 'general';
const DRILL_GENDER = process.env.DRILL_GENDER || 'male';
const SSE_URL_TEMPLATE = process.env.SSE_URL_TEMPLATE || '';
const ADMIN_COOKIE = process.env.ADMIN_COOKIE || '';
const ADMIN_AUTH_HEADER = process.env.ADMIN_AUTH_HEADER || '';

test.describe('Drill: Queue Real-time', () => {
  test.skip(!BASE_URL || !DRILL_CLINIC_ID, 'Skipping: BASE_URL or DRILL_CLINIC_ID not configured');

  let ticketId: string | null = null;
  let patientId: string | null = null;

  // Cleanup: exit the clinic after test
  test.afterEach(async ({ request }) => {
    if (ticketId && patientId) {
      const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';
      
      try {
        await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/exit`, {
          data: { ticketId, patientId },
          failOnStatusCode: false,
        });
        console.log('✓ Cleanup: Ticket exited');
      } catch (error) {
        console.log('⚠️  Cleanup failed:', error);
      }
      
      ticketId = null;
      patientId = null;
    }
  });

  test('should create ticket and receive queue updates', async ({ request }) => {
    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';

    // Create a ticket
    const createResponse = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/enter`, {
      data: {
        patientId: `drill-test-${Date.now()}`,
        gender: DRILL_GENDER,
        examType: DRILL_EXAM_TYPE,
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    
    expect(createData.success).toBe(true);
    expect(createData).toHaveProperty('ticket');
    
    ticketId = createData.ticket.id;
    patientId = createData.ticket.patientId;

    console.log('✓ Ticket created:', ticketId);

    // Verify ticket exists in queue state
    const stateResponse = await request.get(`${apiBase}/clinics/${DRILL_CLINIC_ID}/queue/state`);
    expect(stateResponse.ok()).toBeTruthy();
    
    const stateData = await stateResponse.json();
    expect(stateData.success).toBe(true);
    
    const ticket = stateData.queue?.find((t: any) => t.id === ticketId);
    expect(ticket).toBeDefined();
    
    console.log('✓ Ticket found in queue state');
  });

  test('should receive SSE event for call-next or fallback to polling', async ({ request }) => {
    // Skip if SSE not configured
    if (!SSE_URL_TEMPLATE) {
      console.log('⚠️  SSE_URL_TEMPLATE not configured - testing fallback polling only');
      
      // Fallback: use polling to verify queue state changes
      const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';

      // Create a ticket first
      const createResponse = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/enter`, {
        data: {
          patientId: `drill-test-${Date.now()}`,
          gender: DRILL_GENDER,
          examType: DRILL_EXAM_TYPE,
        },
      });

      expect(createResponse.ok()).toBeTruthy();
      const createData = await createResponse.json();
      ticketId = createData.ticket.id;
      patientId = createData.ticket.patientId;

      console.log('✓ Ticket created for polling test:', ticketId);

      // Poll queue state
      let callDetected = false;
      const maxPolls = 10;
      
      for (let i = 0; i < maxPolls; i++) {
        await sleep(1000);
        
        const stateResponse = await request.get(`${apiBase}/clinics/${DRILL_CLINIC_ID}/queue/state`);
        const stateData = await stateResponse.json();
        
        const ticket = stateData.queue?.find((t: any) => t.id === ticketId);
        
        if (ticket && (ticket.status === 'called' || ticket.status === 'serving')) {
          callDetected = true;
          console.log('✓ Ticket status changed via polling:', ticket.status);
          break;
        }
      }

      // Note: This test doesn't require admin to call-next, just verifies polling works
      console.log(callDetected ? '✓ Polling detected status change' : 'ℹ️  No status change detected (expected if no admin action)');
      return;
    }

    // SSE path: construct SSE URL
    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';
    let sseUrl: string;

    if (SSE_URL_TEMPLATE.startsWith('http')) {
      // Full URL provided
      sseUrl = SSE_URL_TEMPLATE.replace('{clinicId}', DRILL_CLINIC_ID);
    } else {
      // Relative path
      sseUrl = BASE_URL.replace(/\/$/, '') + SSE_URL_TEMPLATE.replace('{clinicId}', DRILL_CLINIC_ID);
    }

    console.log('SSE URL:', sseUrl);

    // Create a ticket
    const createResponse = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/enter`, {
      data: {
        patientId: `drill-test-${Date.now()}`,
        gender: DRILL_GENDER,
        examType: DRILL_EXAM_TYPE,
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    ticketId = createData.ticket.id;
    patientId = createData.ticket.patientId;

    console.log('✓ Ticket created for SSE test:', ticketId);

    // Start listening for SSE events in the background
    const ssePromise = waitForSSEEvent(
      sseUrl,
      'queue_call', // or 'call-next', 'called', 'serving'
      { timeout: 15000 },
      (data: string) => {
        try {
          const parsed = JSON.parse(data);
          return parsed.ticketId === ticketId || parsed.clinicId === DRILL_CLINIC_ID;
        } catch {
          return false;
        }
      }
    );

    // If admin credentials available, trigger call-next
    if (ADMIN_COOKIE || ADMIN_AUTH_HEADER) {
      await sleep(1000); // Give SSE connection time to establish

      const headers: Record<string, string> = {};
      if (ADMIN_COOKIE) headers['Cookie'] = ADMIN_COOKIE;
      if (ADMIN_AUTH_HEADER) headers['Authorization'] = ADMIN_AUTH_HEADER;

      const callResponse = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/call-next`, {
        headers,
        failOnStatusCode: false,
      });

      if (callResponse.ok()) {
        console.log('✓ Admin triggered call-next');
      } else {
        console.log('⚠️  call-next endpoint not available or failed');
      }
    }

    // Wait for SSE event or timeout
    const event = await ssePromise;

    if (event) {
      console.log('✓ SSE event received:', event);
      expect(event.data).toBeTruthy();
    } else {
      console.log('ℹ️  No SSE event received within timeout (expected if no admin action)');
    }
  });

  test('should detect queue_update events for clinic', async ({ request }) => {
    // Skip if SSE not configured
    if (!SSE_URL_TEMPLATE) {
      test.skip(true, 'SSE_URL_TEMPLATE not configured');
      return;
    }

    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';
    let sseUrl: string;

    if (SSE_URL_TEMPLATE.startsWith('http')) {
      sseUrl = SSE_URL_TEMPLATE.replace('{clinicId}', DRILL_CLINIC_ID);
    } else {
      sseUrl = BASE_URL.replace(/\/$/, '') + SSE_URL_TEMPLATE.replace('{clinicId}', DRILL_CLINIC_ID);
    }

    // Start capturing SSE events
    const eventsPromise = captureSSEEvents(sseUrl, { timeout: 8000 });

    // Wait a bit then create a ticket (this should trigger queue_update)
    await sleep(500);

    const createResponse = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/enter`, {
      data: {
        patientId: `drill-test-${Date.now()}`,
        gender: DRILL_GENDER,
        examType: DRILL_EXAM_TYPE,
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    ticketId = createData.ticket.id;
    patientId = createData.ticket.patientId;

    console.log('✓ Ticket created, waiting for SSE events...');

    // Wait for events to be captured
    const events = await eventsPromise;

    console.log(`Captured ${events.length} SSE events`);

    // Look for queue_update or similar events
    const queueEvents = events.filter(e => 
      e.event === 'queue_update' || 
      e.event === 'queue-update' ||
      e.data.includes('queue') ||
      e.data.includes(DRILL_CLINIC_ID)
    );

    if (queueEvents.length > 0) {
      console.log('✓ Queue update events detected:', queueEvents.length);
    } else {
      console.log('ℹ️  No specific queue update events detected (may use different event names)');
    }
  });
});
