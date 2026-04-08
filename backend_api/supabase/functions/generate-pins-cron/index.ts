// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Cron Job: Generate PINs for all active clinics
 * Schedule: Daily at 5:00 AM (0 5 * * *)
 * 
 * This function:
 * 1. Fetches all active clinics from Supabase
 * 2. Generates a random 2-digit PIN for each clinic
 * 3. Stores the PIN in the 'pins' table
 * 4. Updates the clinic record with the new PIN
 */

serve(async (req) => {
  try {
    // Initialize Supabase client with service role key for admin access
    const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? ''
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SB_SERVICE_ROLE_KEY') ?? ''
    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for generate-pins-cron')
    }
    const supabaseClient = createClient(url, key)

    // Get all active clinics (include code/slug for canonical clinic_code)
    const { data: clinics, error: clinicsError } = await supabaseClient
      .from('clinics')
      .select('id, code, slug, name_ar')
      .eq('is_active', true)

    if (clinicsError) {
      throw new Error(`Failed to fetch clinics: ${clinicsError.message}`)
    }

    if (!clinics || clinics.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active clinics found',
          results: []
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // Generate PIN for each clinic
    const results = await Promise.all(
      (clinics as Array<{ id: string; code?: string | null; slug?: string | null; name_ar: string | null }>).map(async (clinic) => {
        // Generate random 2-digit PIN (10-99)
        const pin = String(Math.floor(Math.random() * 90) + 10)
        
        // Set expiration to end of day
        const expiresAt = new Date()
        expiresAt.setHours(23, 59, 59, 999)

        // Insert into pins table (canonical schema)
        const { error: pinError } = await supabaseClient
          .from('pins')
          .insert({
            // Use clinic code if available; fallback to slug; finally id
            clinic_code: (clinic.code && String(clinic.code).trim()) || (clinic.slug && String(clinic.slug).trim()) || clinic.id,
            pin: pin,
            is_active: true,
            generated_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            created_at: new Date().toISOString()
          })

        if (pinError) {
          console.error(`Failed to insert PIN for clinic ${clinic.id}:`, pinError)
          return {
            clinic_id: clinic.id,
            clinic_name: clinic.name_ar,
            success: false,
            error: pinError.message
          }
        }

        // Update clinic with new PIN (optional, for dashboard display)
        const { error: updateError } = await supabaseClient
          .from('clinics')
          .update({
            pin_code: pin,
            pin_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', clinic.id)

        if (updateError) {
          console.error(`Failed to update clinic ${clinic.id}:`, updateError)
          return {
            clinic_id: clinic.id,
            clinic_name: clinic.name_ar,
            success: false,
            error: updateError.message
          }
        }

        return {
          clinic_id: clinic.id,
          clinic_name: clinic.name_ar,
          pin: pin,
          success: true
        }
      })
    )

    // Count successes and failures
    const successCount = results.filter((r: any) => r.success).length
    const failureCount = results.filter((r: any) => !r.success).length

    return new Response(
      JSON.stringify({
        success: true,
        message: `PINs generated successfully for ${successCount} clinics`,
        total: results.length,
        successful: successCount,
        failed: failureCount,
        results: results,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" } 
      }
    )
  } catch (error: any) {
    console.error('Error in generate-pins-cron:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    )
  }
})
