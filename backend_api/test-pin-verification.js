import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testPINVerification() {
  console.log('=== Testing PIN Verification ===\n');

  try {
    // 1. Get a clinic
    const { data: clinics } = await supabase
      .from('clinics')
      .select('id, name_ar')
      .limit(1);

    if (!clinics || clinics.length === 0) {
      console.error('❌ No clinics found');
      return;
    }

    const clinic = clinics[0];
    console.log(`✅ Found clinic: ${clinic.name_ar} (${clinic.id})`);

    // 2. Check for existing PIN
    const now = new Date().toISOString();
    const { data: existingPin } = await supabase
      .from('pins')
      .select('*')
      .eq('clinic_code', clinic.id)
      .eq('is_active', true)
      .gte('expires_at', now)
      .maybeSingle();

    if (existingPin) {
      console.log(`✅ Found active PIN: ${existingPin.pin}`);
      console.log(`   - Used count: ${existingPin.used_count || 0}`);
      console.log(`   - Max uses: ${existingPin.max_uses}`);
      console.log(`   - Expires at: ${existingPin.expires_at}`);
    } else {
      console.log('⚠️  No active PIN found, generating one...');
      
      const newPin = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date();
      expiresAt.setHours(23, 59, 59, 999);

      const { data: insertedPin, error: insertError } = await supabase
        .from('pins')
        .insert({
          clinic_code: clinic.id,
          pin: newPin,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          max_uses: 999,
          used_count: 0
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error inserting PIN:', insertError);
        return;
      }

      console.log(`✅ Generated new PIN: ${newPin}`);
    }

    // 3. Test PIN update logic
    const testPin = existingPin || { id: 'test', used_count: 0, max_uses: 999 };
    const newUsedCount = (testPin.used_count || 0) + 1;
    const isStillActive = newUsedCount < (testPin.max_uses || 1);

    console.log(`\n📊 PIN Update Test:`);
    console.log(`   - Current used count: ${testPin.used_count || 0}`);
    console.log(`   - New used count: ${newUsedCount}`);
    console.log(`   - Max uses: ${testPin.max_uses}`);
    console.log(`   - Will remain active: ${isStillActive}`);

    if (existingPin) {
      const { error: updateError } = await supabase
        .from('pins')
        .update({
          last_used_at: now,
          used_count: newUsedCount,
          is_active: isStillActive
        })
        .eq('id', existingPin.id);

      if (updateError) {
        console.error('❌ Error updating PIN:', updateError);
      } else {
        console.log('✅ PIN updated successfully');
      }
    }

    console.log('\n✅ PIN Verification test completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testPINVerification();
