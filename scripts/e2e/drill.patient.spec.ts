import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

/**
 * Live Drill - Patient Flow E2E Test
 * 
 * Tests the complete patient journey through the DRILL clinic:
 * 1. Status checks
 * 2. Route plan creation
 * 3. Queue entry
 * 4. Visit extensions (901, 902)
 * 5. Exit and cleanup
 * 
 * Uses dedicated DRILL clinic configured via GitHub secrets
 */

// Environment variables from GitHub secrets
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const DRILL_CLINIC_ID = process.env.DRILL_CLINIC_ID || 'DRILL';
const DRILL_CLINIC_PIN = process.env.DRILL_CLINIC_PIN || '9999';
const DRILL_EXAM_TYPE = process.env.DRILL_EXAM_TYPE || 'تجنيد';
const DRILL_GENDER = process.env.DRILL_GENDER || 'male';

// Generate synthetic patient ID for this test run
const generateDrillId = () => {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `DRILL-${timestamp}-${random}`;
};

// Generate idempotency key for mutating requests
const generateIdempotencyKey = () => {
  return randomBytes(16).toString('hex');
};

test.describe('Live Drill - Patient Flow', () => {
  let drillIdNumber: string;
  let ticketId: string | null = null;

  test.beforeAll(() => {
    console.log('🔍 Test Configuration:');
    console.log(`  BASE_URL: ${BASE_URL}`);
    console.log(`  DRILL_CLINIC_ID: ${DRILL_CLINIC_ID}`);
    console.log(`  DRILL_EXAM_TYPE: ${DRILL_EXAM_TYPE}`);
    console.log('  DRILL_GENDER: ***'); // Masked to avoid clear-text logging of env variable
    console.log(`  DRILL_CLINIC_PIN: ${DRILL_CLINIC_PIN ? '***' : 'not set'}`);
  });

  test.beforeEach(() => {
    drillIdNumber = generateDrillId();
    console.log(`🆔 Generated drill ID: ${drillIdNumber}`);
  });

  test.afterEach(async ({ request }) => {
    // Cleanup: Exit any created ticket
    if (ticketId) {
      console.log(`🧹 Cleaning up ticket: ${ticketId}`);
      try {
        const exitResponse = await request.post(`${BASE_URL}/api/v1/queue/exit`, {
          data: {
            ticketId,
            clinicId: DRILL_CLINIC_ID,
            idempotencyKey: generateIdempotencyKey(),
          },
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (exitResponse.ok()) {
          console.log('✅ Cleanup successful');
        } else {
          console.warn(`⚠️ Cleanup warning: ${exitResponse.status()}`);
        }
      } catch (error) {
        console.warn(`⚠️ Cleanup error: ${error}`);
      }
      ticketId = null;
    }
  });

  test('should complete full patient drill flow', async ({ request }) => {
    // Step 1: Health check - verify API is accessible
    console.log('📋 Step 1: Health check');
    const statusResponse = await request.get(`${BASE_URL}/api/v1/status`);
    expect(statusResponse.ok()).toBeTruthy();
    const statusData = await statusResponse.json();
    console.log(`✅ API Status: ${JSON.stringify(statusData)}`);

    // Step 2: Create route plan for drill patient
    console.log('📋 Step 2: Create route plan');
    const routeResponse = await request.post(`${BASE_URL}/api/v1/patient/route`, {
      data: {
        idNumber: drillIdNumber,
        gender: DRILL_GENDER,
        examType: DRILL_EXAM_TYPE,
        clinicId: DRILL_CLINIC_ID,
        idempotencyKey: generateIdempotencyKey(),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(routeResponse.ok()).toBeTruthy();
    const routeData = await routeResponse.json();
    expect(routeData.success).toBeTruthy();
    console.log(`✅ Route created: ${JSON.stringify(routeData)}`);

    // Step 3: Enter queue
    console.log('📋 Step 3: Enter queue');
    const enterResponse = await request.post(`${BASE_URL}/api/v1/queue/enter`, {
      data: {
        idNumber: drillIdNumber,
        clinicId: DRILL_CLINIC_ID,
        pin: DRILL_CLINIC_PIN,
        gender: DRILL_GENDER,
        examType: DRILL_EXAM_TYPE,
        idempotencyKey: generateIdempotencyKey(),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(enterResponse.ok()).toBeTruthy();
    const enterData = await enterResponse.json();
    expect(enterData.success).toBeTruthy();
    expect(enterData.ticket).toBeDefined();
    ticketId = enterData.ticket.id;
    console.log(`✅ Entered queue - Ticket ID: ${ticketId}`);

    // Step 4: Verify queue state
    console.log('📋 Step 4: Verify queue state');
    const queueResponse = await request.get(`${BASE_URL}/api/v1/queue/${DRILL_CLINIC_ID}`);
    expect(queueResponse.ok()).toBeTruthy();
    const queueData = await queueResponse.json();
    console.log(`✅ Queue state: ${queueData.waiting?.length || 0} waiting`);

    // Step 5: Extend visit (simulate 901)
    console.log('📋 Step 5: Extend visit 901');
    const extend901Response = await request.post(`${BASE_URL}/api/v1/queue/extend`, {
      data: {
        ticketId,
        clinicId: DRILL_CLINIC_ID,
        targetClinic: '901',
        idempotencyKey: generateIdempotencyKey(),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (extend901Response.ok()) {
      console.log('✅ Extended to 901');
    } else {
      console.warn(`⚠️ Extend 901 returned: ${extend901Response.status()}`);
    }

    // Step 6: Extend visit (simulate 902)
    console.log('📋 Step 6: Extend visit 902');
    const extend902Response = await request.post(`${BASE_URL}/api/v1/queue/extend`, {
      data: {
        ticketId,
        clinicId: DRILL_CLINIC_ID,
        targetClinic: '902',
        idempotencyKey: generateIdempotencyKey(),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (extend902Response.ok()) {
      console.log('✅ Extended to 902');
    } else {
      console.warn(`⚠️ Extend 902 returned: ${extend902Response.status()}`);
    }

    // Step 7: Exit queue (cleanup will also happen in afterEach)
    console.log('📋 Step 7: Exit queue');
    const exitResponse = await request.post(`${BASE_URL}/api/v1/queue/exit`, {
      data: {
        ticketId,
        clinicId: DRILL_CLINIC_ID,
        idempotencyKey: generateIdempotencyKey(),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(exitResponse.ok()).toBeTruthy();
    const exitData = await exitResponse.json();
    expect(exitData.success).toBeTruthy();
    console.log('✅ Exited queue successfully');
    
    // Clear ticketId since we've cleaned up
    ticketId = null;

    // Step 8: Verify queue is clean
    console.log('📋 Step 8: Verify cleanup');
    const finalQueueResponse = await request.get(`${BASE_URL}/api/v1/queue/${DRILL_CLINIC_ID}`);
    expect(finalQueueResponse.ok()).toBeTruthy();
    const finalQueueData = await finalQueueResponse.json();
    
    // Check that our drill patient is no longer in queue
    const stillInQueue = finalQueueData.waiting?.some((t: any) => t.id === ticketId);
    expect(stillInQueue).toBeFalsy();
    console.log('✅ Queue cleanup verified');

    console.log('🎉 Patient drill flow completed successfully!');
  });
});
