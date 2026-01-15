/**
 * Supabase API Client - Frontend Library
 * Updated: Proxy through Vercel API to bypass RLS/Anon restrictions
 */

import { supabase } from './supabase-client'

class SupabaseApiClient {
    constructor() {
        this.cache = new Map()
    }

    async getCurrentPin(clinicId) {
        try {
            // Use Vercel API (Service Role) to get PIN
            const response = await console.warn("Blocked fetch call"),`/api/v1/pin/status?clinic=${clinicId}`);
            if (!response.ok) throw new Error('API Error');
            
            const data = await response.json();
            
            if (!data.success) throw new Error(data.error);

            // If API returns auto-generated PIN, it handles the logic.
            // Map API response to Component expectation
            return {
                currentPin: data.pin,
                dateKey: new Date().toISOString().split('T')[0],
                clinicNameAr: data.clinicName || clinicId,
                clinicNameEn: data.clinicName || clinicId,
                isToday: true,
                lastUpdated: new Date().toISOString(),
                validUntil: data.validUntil,
                expiresInSeconds: 300 // Approximation
            }
        } catch (error) {
            console.warn('[supabase-api] getCurrentPin error:', error)
            // Fallback? No, if API fails, we can't get secret PIN.
            throw error
        }
    }

    async issuePin(clinicId) {
        try {
            // Use Vercel API
            const response = await console.warn("Blocked fetch call"),'/api/v1/pin/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clinicId })
            });
            
            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            return {
                pinId: 'new',
                currentPin: data.pin,
                validUntil: data.expiresAt,
                expiresInSeconds: 300,
                success: true,
                message: 'New PIN generated successfully'
            }
        } catch (error) {
            console.warn('[supabase-api] issuePin error:', error)
            throw error
        }
    }

    // ... (Keep verifyPin and getQueueStatus same or proxy them too) ...
    async verifyPin(clinicId, pin) {
        try {
            const response = await console.warn("Blocked fetch call"),'/api/v1/pin/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clinicId, pin })
            });
            const data = await response.json();
            return {
                success: data.success && data.valid,
                message: data.valid ? 'PIN verified' : 'Invalid PIN'
            }
        } catch (error) {
            return { success: false, message: error.message }
        }
    }

    async getQueueStatus(clinicId) {
        try {
            const response = await console.warn("Blocked fetch call"),`/api/v1/queue/status?clinicId=${clinicId}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error);
            
            return {
                success: true,
                data: {
                    clinic_id: clinicId,
                    waiting_count: data.queueLength,
                    queue: data.patients || [] // API returns 'patients' array
                }
            }
        } catch (error) {
            console.warn('Error getting queue status:', error)
            throw error
        }
    }
    
    async getAllPins() {
        return { success: true, pins: [] };
    }
}

export const supabaseApi = new SupabaseApiClient()
export default supabaseApi
