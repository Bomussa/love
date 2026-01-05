/**
 * Supabase API Client - Frontend Library
 * Updated: Auto-Generate PIN if missing (Lazy Loading)
 */

import { supabase } from './supabase-client'

class SupabaseApiClient {
    constructor() {
        this.cache = new Map()
    }

    async getCurrentPin(clinicId) {
        try {
            const { data: clinic, error } = await supabase
                .from('clinics')
                .select('id, name, name_ar, name_en, pin_code, pin_expires_at')
                .eq('id', clinicId)
                .single()

            if (error) throw error
            if (!clinic) throw new Error(`Clinic ${clinicId} not found`)

            // AUTO-GENERATE Logic:
            // If PIN is missing OR expired, generate a new one immediately.
            const now = new Date()
            const expires = clinic.pin_expires_at ? new Date(clinic.pin_expires_at) : null
            
            if (!clinic.pin_code || (expires && expires < now)) {
                 console.log(`[PIN] Auto-generating for ${clinicId} (Expired/Missing)`);
                 return await this.issuePin(clinicId);
            }

            return {
                currentPin: clinic.pin_code,
                dateKey: new Date().toISOString().split('T')[0],
                clinicNameAr: clinic.name_ar || clinic.name,
                clinicNameEn: clinic.name_en || clinic.name,
                isToday: true,
                lastUpdated: new Date().toISOString(),
                validUntil: clinic.pin_expires_at,
                expiresInSeconds: Math.floor((new Date(clinic.pin_expires_at).getTime() - Date.now()) / 1000)
            }
        } catch (error) {
            console.error('[supabase-api] getCurrentPin error:', error)
            throw error
        }
    }

    async issuePin(clinicId) {
        try {
            const newPin = String(Math.floor(1000 + Math.random() * 9000))
            const today = new Date()
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

            const { data, error } = await supabase
                .from('clinics')
                .update({
                    pin_code: newPin,
                    pin_expires_at: endOfDay.toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', clinicId)
                .select()
                .single()

            if (error) throw error

            return {
                pinId: data.id,
                currentPin: data.pin_code,
                validUntil: data.pin_expires_at,
                expiresInSeconds: Math.floor((new Date(data.pin_expires_at).getTime() - Date.now()) / 1000),
                success: true,
                message: 'New PIN generated successfully'
            }
        } catch (error) {
            console.error('[supabase-api] issuePin error:', error)
            throw error
        }
    }

    // ... (Keep verifyPin and getQueueStatus same as before) ...
    async verifyPin(clinicId, pin) {
        try {
            const pinData = await this.getCurrentPin(clinicId)
            return {
                success: pinData.currentPin === pin,
                message: pinData.currentPin === pin ? 'PIN verified' : 'Invalid PIN'
            }
        } catch (error) {
            return { success: false, message: error.message }
        }
    }

    async getQueueStatus(clinicId) {
        try {
            const { data, error } = await supabase
                .from('queue')
                .select('*')
                .eq('clinic_id', clinicId)
                .eq('status', 'waiting')
                .order('created_at', { ascending: true })

            if (error) throw error

            return {
                success: true,
                data: {
                    clinic_id: clinicId,
                    waiting_count: data.length,
                    queue: data
                }
            }
        } catch (error) {
            console.error('Error getting queue status:', error)
            throw error
        }
    }
    
    async getAllPins() {
        return { success: true, pins: [] }; // Legacy/Not used in new monitor
    }
}

export const supabaseApi = new SupabaseApiClient()
export default supabaseApi
