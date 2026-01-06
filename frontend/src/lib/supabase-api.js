/**
 * Supabase API Client - Frontend Library
 * Updated: Direct Supabase connection for PIN logic
 */
import { supabase } from './supabase-client'

class SupabaseApiClient {
    constructor() {
        this.cache = new Map()
    }

    async getCurrentPin(clinicId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('pins')
                .select('pin_code')
                .eq('clinic_id', clinicId)
                .gte('created_at', `${today}T00:00:00Z`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            return {
                currentPin: data ? data.pin_code : null,
                success: true
            };
        } catch (error) {
            console.error('[supabase-api] getCurrentPin error:', error);
            throw error;
        }
    }

    async issuePin(clinicId) {
        try {
            const newPin = Math.floor(10 + Math.random() * 90).toString();
            
            const { data, error } = await supabase
                .from('pins')
                .insert([{
                    clinic_id: clinicId,
                    pin_code: newPin,
                }])
                .select()
                .single();

            if (error) throw error;

            return {
                currentPin: data.pin_code,
                success: true,
                message: 'New PIN generated successfully'
            };
        } catch (error) {
            console.error('[supabase-api] issuePin error:', error);
            throw error;
        }
    }

    async verifyPin(clinicId, pin) {
        try {
            const { data, error } = await supabase
                .from('pins')
                .select('id')
                .eq('clinic_id', clinicId)
                .eq('pin_code', pin)
                .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Valid for 5 minutes
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            return {
                success: !!data,
                valid: !!data
            };
        } catch (error) {
            console.error('[supabase-api] verifyPin error:', error);
            return { success: false, error: error.message };
        }
    }

    async getAllPins() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('pins')
                .select('id, pin_code, clinic_id, created_at, status')
                .gte('created_at', `${today}T00:00:00Z`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return {
                success: true,
                pins: data.map(p => ({
                    pinId: p.id,
                    currentPin: p.pin_code,
                    clinic_id: p.clinic_id,
                    status: p.status,
                    created_at: p.created_at
                }))
            };
        } catch (error) {
            console.error('[supabase-api] getAllPins error:', error);
            return { success: false, error: error.message };
        }
    }
}

export const supabaseApi = new SupabaseApiClient()
export default supabaseApi
