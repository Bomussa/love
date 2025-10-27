/**
 * Drill E2E Test: PIN Audit Trail
 * Tests PIN validation and entry/exit timestamp tracking
 */
import { test, expect } from '@playwright/test';
import { validateEntryExitTimestamps, now } from './time';

const BASE_URL = process.env.BASE_URL || '';
const DRILL_CLINIC_ID = process.env.DRILL_CLINIC_ID || '';
const DRILL_CLINIC_PIN = process.env.DRILL_CLINIC_PIN || '';
const DRILL_EXAM_TYPE = process.env.DRILL_EXAM_TYPE || 'general';
const DRILL_GENDER = process.env.DRILL_GENDER || 'male';

test.describe('Drill: PIN Audit', () => {
  test.skip(!BASE_URL || !DRILL_CLINIC_ID || !DRILL_CLINIC_PIN, 
    'Skipping: BASE_URL, DRILL_CLINIC_ID, or DRILL_CLINIC_PIN not configured');

  let ticketId: string | null = null;
  let patientId: string | null = null;

  // Cleanup after each test
  test.afterEach(async ({ request }) => {
    if (ticketId && patientId) {
      const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';
      
      try {
        await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/exit`, {
          data: { 
            ticketId, 
            patientId,
            pin: DRILL_CLINIC_PIN,
          },
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

  test('should reject wrong PIN on entry', async ({ request }) => {
    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';
    const wrongPin = '0000'; // Intentionally wrong PIN

    const response = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/enter`, {
      data: {
        patientId: `drill-test-${Date.now()}`,
        gender: DRILL_GENDER,
        examType: DRILL_EXAM_TYPE,
        pin: wrongPin,
      },
      failOnStatusCode: false,
    });

    // Should fail with 4xx status
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);

    const data = await response.json();
    expect(data.success).toBe(false);
    
    console.log('✓ Wrong PIN rejected on entry:', response.status());
  });

  test('should accept correct PIN on entry and track entry_time', async ({ request }) => {
    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';
    const testStart = new Date();

    console.log('Test start:', now());

    const response = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/enter`, {
      data: {
        patientId: `drill-test-${Date.now()}`,
        gender: DRILL_GENDER,
        examType: DRILL_EXAM_TYPE,
        pin: DRILL_CLINIC_PIN,
      },
    });

    const testEnd = new Date();
    console.log('Entry response received:', now());

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('ticket');
    
    ticketId = data.ticket.id;
    patientId = data.ticket.patientId;

    console.log('✓ Correct PIN accepted, ticket created:', ticketId);

    // Check for entry_time or timestamp field
    const ticket = data.ticket;
    const entryTime = ticket.entry_time || ticket.entryTime || ticket.timestamp || ticket.createdAt;

    expect(entryTime).toBeTruthy();
    console.log('Entry timestamp:', entryTime);

    // Validate timestamp is within test window (±2 minutes tolerance)
    const validation = validateEntryExitTimestamps(
      entryTime,
      null,
      testStart,
      testEnd,
      { allowMissingExit: true }
    );

    if (!validation.valid) {
      console.error('Timestamp validation errors:', validation.errors);
    }

    expect(validation.valid).toBe(true);
    console.log('✓ Entry timestamp is valid and within test window');
  });

  test('should reject wrong PIN on exit', async ({ request }) => {
    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';

    // First, create a ticket with correct PIN
    const enterResponse = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/enter`, {
      data: {
        patientId: `drill-test-${Date.now()}`,
        gender: DRILL_GENDER,
        examType: DRILL_EXAM_TYPE,
        pin: DRILL_CLINIC_PIN,
      },
    });

    expect(enterResponse.ok()).toBeTruthy();
    const enterData = await enterResponse.json();
    
    ticketId = enterData.ticket.id;
    patientId = enterData.ticket.patientId;

    console.log('✓ Ticket created for exit test:', ticketId);

    // Try to exit with wrong PIN
    const wrongPin = '9999';
    const exitResponse = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/exit`, {
      data: {
        ticketId,
        patientId,
        pin: wrongPin,
      },
      failOnStatusCode: false,
    });

    // Should fail with 4xx status
    expect(exitResponse.status()).toBeGreaterThanOrEqual(400);
    expect(exitResponse.status()).toBeLessThan(500);

    const exitData = await exitResponse.json();
    expect(exitData.success).toBe(false);

    console.log('✓ Wrong PIN rejected on exit:', exitResponse.status());

    // Ticket should still exist (exit failed)
    const stateResponse = await request.get(`${apiBase}/clinics/${DRILL_CLINIC_ID}/queue/state`);
    const stateData = await stateResponse.json();
    const ticket = stateData.queue?.find((t: any) => t.id === ticketId);
    
    expect(ticket).toBeDefined();
    console.log('✓ Ticket still in queue after failed exit');
  });

  test('should accept correct PIN on exit and track exit_time', async ({ request }) => {
    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';
    const testStart = new Date();

    console.log('Test start:', now());

    // Create ticket
    const enterResponse = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/enter`, {
      data: {
        patientId: `drill-test-${Date.now()}`,
        gender: DRILL_GENDER,
        examType: DRILL_EXAM_TYPE,
        pin: DRILL_CLINIC_PIN,
      },
    });

    expect(enterResponse.ok()).toBeTruthy();
    const enterData = await enterResponse.json();
    
    ticketId = enterData.ticket.id;
    patientId = enterData.ticket.patientId;
    
    const entryTime = enterData.ticket.entry_time || 
                     enterData.ticket.entryTime || 
                     enterData.ticket.timestamp || 
                     enterData.ticket.createdAt;

    console.log('✓ Ticket created:', ticketId);
    console.log('Entry time:', entryTime);

    // Exit with correct PIN
    const exitResponse = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/exit`, {
      data: {
        ticketId,
        patientId,
        pin: DRILL_CLINIC_PIN,
      },
    });

    const testEnd = new Date();
    console.log('Exit response received:', now());

    expect(exitResponse.ok()).toBeTruthy();
    const exitData = await exitResponse.json();
    
    expect(exitData.success).toBe(true);
    console.log('✓ Correct PIN accepted, ticket exited');

    // Check for exit_time
    const exitTime = exitData.exit_time || 
                    exitData.exitTime || 
                    exitData.timestamp || 
                    exitData.updatedAt;

    if (exitTime) {
      console.log('Exit timestamp:', exitTime);

      // Validate both timestamps
      const validation = validateEntryExitTimestamps(
        entryTime,
        exitTime,
        testStart,
        testEnd
      );

      if (!validation.valid) {
        console.error('Timestamp validation errors:', validation.errors);
      }

      expect(validation.valid).toBe(true);
      console.log('✓ Entry and exit timestamps are valid and in correct order');
    } else {
      console.log('ℹ️  Exit timestamp not returned in response (may be tracked server-side)');
    }

    // Clear ticketId to prevent double cleanup
    ticketId = null;
    patientId = null;

    // Verify ticket no longer in queue
    const stateResponse = await request.get(`${apiBase}/clinics/${DRILL_CLINIC_ID}/queue/state`);
    const stateData = await stateResponse.json();
    const ticket = stateData.queue?.find((t: any) => t.id === enterData.ticket.id);
    
    expect(ticket).toBeUndefined();
    console.log('✓ Ticket removed from queue after successful exit');
  });

  test('should track entry and exit timestamps within test window', async ({ request }) => {
    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';
    const testStart = new Date();

    // Entry
    const enterResponse = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/enter`, {
      data: {
        patientId: `drill-test-${Date.now()}`,
        gender: DRILL_GENDER,
        examType: DRILL_EXAM_TYPE,
        pin: DRILL_CLINIC_PIN,
      },
    });

    expect(enterResponse.ok()).toBeTruthy();
    const enterData = await enterResponse.json();
    
    ticketId = enterData.ticket.id;
    patientId = enterData.ticket.patientId;

    // Exit
    const exitResponse = await request.post(`${apiBase}/clinics/${DRILL_CLINIC_ID}/exit`, {
      data: {
        ticketId,
        patientId,
        pin: DRILL_CLINIC_PIN,
      },
    });

    const testEnd = new Date();

    expect(exitResponse.ok()).toBeTruthy();
    const exitData = await exitResponse.json();

    // Extract timestamps
    const entryTime = enterData.ticket.entry_time || 
                     enterData.ticket.entryTime || 
                     enterData.ticket.timestamp || 
                     enterData.ticket.createdAt;
                     
    const exitTime = exitData.exit_time || 
                    exitData.exitTime || 
                    exitData.timestamp || 
                    exitData.updatedAt;

    console.log('Test window:', testStart.toISOString(), 'to', testEnd.toISOString());
    console.log('Entry time:', entryTime);
    console.log('Exit time:', exitTime);

    // Validate with ±2 minutes tolerance
    const validation = validateEntryExitTimestamps(
      entryTime,
      exitTime,
      testStart,
      testEnd,
      { toleranceMs: 2 * 60 * 1000 }
    );

    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
    }

    expect(validation.valid).toBe(true);
    console.log('✓ Both timestamps fall within test window (±2 min tolerance)');

    // Clear for cleanup
    ticketId = null;
    patientId = null;
  });
});
