/**
 * Drill E2E Test: Dynamic Routing
 * Tests that the routing/plan endpoint respects weights and returns a valid route
 */
import { test, expect } from '@playwright/test';

// Environment variables for drill clinic
const BASE_URL = process.env.BASE_URL || '';
const DRILL_CLINIC_ID = process.env.DRILL_CLINIC_ID || '';
const DRILL_EXAM_TYPE = process.env.DRILL_EXAM_TYPE || 'general';
const DRILL_GENDER = process.env.DRILL_GENDER || 'male';
const ADMIN_COOKIE = process.env.ADMIN_COOKIE || '';
const ADMIN_AUTH_HEADER = process.env.ADMIN_AUTH_HEADER || '';

test.describe('Drill: Dynamic Routing', () => {
  test.skip(!BASE_URL || !DRILL_CLINIC_ID, 'Skipping: BASE_URL or DRILL_CLINIC_ID not configured');

  test('should return a valid routing plan', async ({ request }) => {
    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';

    // Request a routing plan
    const response = await request.get(`${apiBase}/route/plan`, {
      params: {
        examType: DRILL_EXAM_TYPE,
        gender: DRILL_GENDER,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('success');
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('plan');
    expect(Array.isArray(data.plan)).toBe(true);
    expect(data.plan.length).toBeGreaterThan(0);

    // Log the plan for verification
    console.log('Routing plan:', JSON.stringify(data.plan, null, 2));

    // Verify each clinic in plan has required fields
    for (const clinic of data.plan) {
      expect(clinic).toHaveProperty('clinicId');
      expect(clinic).toHaveProperty('name');
      expect(typeof clinic.clinicId).toBe('string');
      expect(typeof clinic.name).toBe('string');
    }
  });

  test('should respect routing weights if admin can set them', async ({ request }) => {
    // Skip if no admin credentials
    if (!ADMIN_COOKIE && !ADMIN_AUTH_HEADER) {
      test.skip(true, 'Admin credentials not provided - skipping weight test');
      return;
    }

    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';

    // Prepare admin headers
    const headers: Record<string, string> = {};
    if (ADMIN_COOKIE) {
      headers['Cookie'] = ADMIN_COOKIE;
    }
    if (ADMIN_AUTH_HEADER) {
      headers['Authorization'] = ADMIN_AUTH_HEADER;
    }

    // Try to set weights (endpoint might not exist, that's OK)
    const weightsEndpoint = `${apiBase}/admin/route/weights`;
    const setWeightsResponse = await request.post(weightsEndpoint, {
      headers,
      data: {
        examType: DRILL_EXAM_TYPE,
        weights: {
          [DRILL_CLINIC_ID]: 1000, // Very high weight to ensure DRILL is first
        },
      },
      failOnStatusCode: false,
    });

    // If endpoint doesn't exist (404), skip weight assertion
    if (setWeightsResponse.status() === 404) {
      console.log('⚠️  Weight setting endpoint not available - skipping weight assertion');
      
      // Just verify plan is returned
      const planResponse = await request.get(`${apiBase}/route/plan`, {
        params: {
          examType: DRILL_EXAM_TYPE,
          gender: DRILL_GENDER,
        },
      });
      
      expect(planResponse.ok()).toBeTruthy();
      const planData = await planResponse.json();
      expect(planData.success).toBe(true);
      expect(planData.plan.length).toBeGreaterThan(0);
      
      console.log('✓ Plan returned (weight test skipped):', planData.plan[0]);
      return;
    }

    // If we got here, the endpoint exists - verify weights were set
    expect(setWeightsResponse.ok()).toBeTruthy();
    console.log('✓ Weights set successfully');

    // Now request a plan and verify DRILL clinic is first
    const planResponse = await request.get(`${apiBase}/route/plan`, {
      params: {
        examType: DRILL_EXAM_TYPE,
        gender: DRILL_GENDER,
      },
    });

    expect(planResponse.ok()).toBeTruthy();
    const planData = await planResponse.json();
    
    expect(planData.success).toBe(true);
    expect(planData.plan.length).toBeGreaterThan(0);
    
    // Verify DRILL clinic is first in the plan
    const firstClinic = planData.plan[0];
    expect(firstClinic.clinicId).toBe(DRILL_CLINIC_ID);
    
    console.log('✓ DRILL clinic is first in plan as expected');
  });

  test('should return consistent plans for same parameters', async ({ request }) => {
    const apiBase = BASE_URL.replace(/\/$/, '') + '/api/v1';

    // Request plan twice with same parameters
    const response1 = await request.get(`${apiBase}/route/plan`, {
      params: {
        examType: DRILL_EXAM_TYPE,
        gender: DRILL_GENDER,
      },
    });

    const response2 = await request.get(`${apiBase}/route/plan`, {
      params: {
        examType: DRILL_EXAM_TYPE,
        gender: DRILL_GENDER,
      },
    });

    expect(response1.ok()).toBeTruthy();
    expect(response2.ok()).toBeTruthy();

    const data1 = await response1.json();
    const data2 = await response2.json();

    // Plans should be identical for same parameters
    expect(data1.plan).toEqual(data2.plan);
    
    console.log('✓ Plans are consistent across requests');
  });
});
