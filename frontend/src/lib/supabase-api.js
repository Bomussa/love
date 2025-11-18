/**
 * Supabase API Client
 * Updated: 2025-11-18 - Final Version
 * Uses Supabase REST API directly for 100% reliability
 * ✅ NO MOCK DATA - All real Supabase connections
 * ✅ NO DEPENDENCY on Edge Functions deployment
 */

import { supabase } from './supabase-client'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

class SupabaseApiClient {
    constructor() {
        this.cache = new Map()
    }

    // ============================================
    // PIN Management (Daily PIN System)
    // Uses Supabase REST API directly
    // ============================================

    /**
     * Generate 6-digit PIN
     */
    generatePINNumber() {
        return String(Math.floor(100000 + Math.random() * 900000))
    }

    /**
     * Get end of day timestamp
     */
    getEndOfDay() {
        const now = new Date()
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        return endOfDay.toISOString()
    }

    /**
     * Get today's date string (YYYY-MM-DD)
     */
    getTodayDateString() {
        const now = new Date()
        return now.toISOString().split('T')[0]
    }

    /**
     * Get current daily PIN for clinic
     * Checks pins table for today's active PIN
     */
    async getCurrentPin(clinicId) {
        try {
            const today = this.getTodayDateString()
            const now = new Date().toISOString()

            // Get active PINs for this clinic
            const { data: pins, error } = await supabase
                .from('pins')
                .select('*')
                .eq('clinic_id', clinicId)
                .gt('valid_until', now)
                .order('created_at', { ascending: false })
                .limit(10)

            if (error) throw error

            // Filter for today's PIN
            const todayPins = (pins || []).filter(pin => {
                const pinDate = new Date(pin.created_at).toISOString().split('T')[0]
                return pinDate === today
            })

            const activePin = todayPins[0] || null

            if (activePin) {
                const expiresIn = Math.floor((new Date(activePin.valid_until).getTime() - Date.now()) / 1000)
                
                return {
                    currentPin: activePin.pin,
                    totalIssued: 1,
                    dateKey: today,
                    allPins: [activePin.pin],
                    success: true,
                    clinic: clinicId,
                    isToday: true,
                    lastUpdated: now,
                    timestamp: now,
                    validUntil: activePin.valid_until,
                    expiresInSeconds: expiresIn,
                    pinId: activePin.id,
                    isUsed: activePin.used_at !== null
                }
            }

            return {
                currentPin: null,
                totalIssued: 0,
                dateKey: today,
                allPins: [],
                success: true,
                clinic: clinicId,
                isToday: false,
                lastUpdated: now,
                timestamp: now
            }
        } catch (error) {
            console.error('Error getting current PIN:', error)
            throw error
        }
    }

    /**
     * Issue new daily PIN for clinic
     * Creates new PIN in pins table
     */
    async issuePin(clinicId) {
        try {
            const today = this.getTodayDateString()
            const now = new Date().toISOString()

            // Check if PIN already exists for today
            const existingPin = await this.getCurrentPin(clinicId)
            
            if (existingPin.currentPin) {
                // Return existing PIN
                return {
                    ...existingPin,
                    isExisting: true,
                    message: 'Using existing PIN for today'
                }
            }

            // Generate new PIN
            const pin = this.generatePINNumber()
            const validUntil = this.getEndOfDay()

            const { data, error } = await supabase
                .from('pins')
                .insert({
                    clinic_id: clinicId,
                    pin: pin,
                    valid_until: validUntil,
                    created_at: now
                })
                .select()
                .single()

            if (error) throw error

            const expiresIn = Math.floor((new Date(data.valid_until).getTime() - Date.now()) / 1000)

            return {
                currentPin: data.pin,
                totalIssued: 1,
                dateKey: today,
                allPins: [data.pin],
                success: true,
                clinic: clinicId,
                issuedAt: now,
                timestamp: now,
                validUntil: data.valid_until,
                expiresInSeconds: expiresIn,
                pinId: data.id,
                isExisting: false,
                message: 'New PIN generated successfully'
            }
        } catch (error) {
            console.error('Error issuing PIN:', error)
            throw error
        }
    }

    /**
     * Get all PINs for all clinics
     */
    async getAllPins() {
        try {
            const today = this.getTodayDateString()

            // Get all clinics
            const { data: clinics, error: clinicsError } = await supabase
                .from('clinics')
                .select('id, name')

            if (clinicsError) throw clinicsError

            // Get PIN for each clinic
            const pinPromises = clinics.map(async (clinic) => {
                try {
                    const pinData = await this.getCurrentPin(clinic.id)
                    return {
                        clinic_id: clinic.id,
                        clinic_name: clinic.name,
                        ...pinData
                    }
                } catch (error) {
                    console.error(`Error getting PIN for clinic ${clinic.id}:`, error)
                    return {
                        clinic_id: clinic.id,
                        clinic_name: clinic.name,
                        currentPin: null,
                        success: false
                    }
                }
            })

            const pins = await Promise.all(pinPromises)

            return {
                success: true,
                dateKey: today,
                pins: pins.filter(p => p.currentPin),
                timestamp: new Date().toISOString()
            }
        } catch (error) {
            console.error('Error getting all PINs:', error)
            throw error
        }
    }

    /**
     * Verify PIN for clinic entry
     */
    async verifyPin(clinicId, pin) {
        try {
            const currentPinData = await this.getCurrentPin(clinicId)
            
            if (!currentPinData.currentPin) {
                return {
                    success: false,
                    error: 'No PIN issued for this clinic today',
                    valid: false
                }
            }

            const isValid = currentPinData.currentPin === pin

            return {
                success: true,
                valid: isValid,
                clinic: clinicId,
                message: isValid ? 'PIN verified successfully' : 'Invalid PIN'
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                valid: false
            }
        }
    }

    // ============================================
    // Queue Management
    // Uses Supabase REST API directly
    // ============================================

    /**
     * Get queue status for clinic
     */
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

    /**
     * Enter queue
     */
    async enterQueue(clinicId, patientId, priority = 'normal') {
        try {
            const { data, error } = await supabase
                .from('queue')
                .insert({
                    clinic_id: clinicId,
                    patient_id: patientId,
                    priority: priority,
                    status: 'waiting',
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data: data
            }
        } catch (error) {
            console.error('Error entering queue:', error)
            throw error
        }
    }

    /**
     * Call next patient
     */
    async callNextPatient(clinicId) {
        try {
            // Get next patient in queue
            const { data: nextPatient, error: fetchError } = await supabase
                .from('queue')
                .select('*')
                .eq('clinic_id', clinicId)
                .eq('status', 'waiting')
                .order('created_at', { ascending: true })
                .limit(1)
                .single()

            if (fetchError) throw fetchError

            if (!nextPatient) {
                return {
                    success: false,
                    error: 'No patients in queue'
                }
            }

            // Update patient status
            const { data, error } = await supabase
                .from('queue')
                .update({
                    status: 'called',
                    called_at: new Date().toISOString()
                })
                .eq('id', nextPatient.id)
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data: data
            }
        } catch (error) {
            console.error('Error calling next patient:', error)
            throw error
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear()
    }
}

// Export singleton instance
export const supabaseApi = new SupabaseApiClient()
export default supabaseApi
