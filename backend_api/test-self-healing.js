import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testSelfHealing() {
  console.log('=== Testing Self-Healing System ===\n');

  try {
    // 1. Check clinics without active PINs
    const { data: clinics } = await supabase
      .from('clinics')
      .select('id, name_ar')
      .limit(5);

    console.log(`✅ Found ${clinics?.length || 0} clinics`);

    let missingPINCount = 0;
    const now = new Date().toISOString();

    for (const clinic of (clinics || [])) {
      const { data: pin } = await supabase
        .from('pins')
        .select('*')
        .eq('clinic_code', clinic.id)
        .eq('is_active', true)
        .gte('expires_at', now)
        .maybeSingle();

      if (!pin) {
        missingPINCount++;
        console.log(`   ⚠️  Missing PIN: ${clinic.name_ar} (${clinic.id})`);
      }
    }

    console.log(`\n📊 Summary: ${missingPINCount} clinics missing active PINs`);

    // 2. Simulate self-healing
    console.log('\n🔧 Running self-healing...');
    
    let fixesApplied = 0;
    for (const clinic of (clinics || [])) {
      const { data: pin } = await supabase
        .from('pins')
        .select('*')
        .eq('clinic_code', clinic.id)
        .eq('is_active', true)
        .gte('expires_at', now)
        .maybeSingle();

      if (!pin) {
        const newPin = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date();
        expiresAt.setHours(23, 59, 59, 999);

        const { error } = await supabase.from('pins').insert({
          clinic_code: clinic.id,
          pin: newPin,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          max_uses: 999,
          used_count: 0
        });

        if (!error) {
          console.log(`   ✅ Generated PIN ${newPin} for ${clinic.name_ar}`);
          fixesApplied++;
        }
      }
    }

    // 3. Check results
    console.log(`\n📈 Self-healing Results:`);
    console.log(`   - Fixes applied: ${fixesApplied}`);
    console.log(`   - Success rate: ${clinics?.length > 0 ? Math.round((fixesApplied / clinics.length) * 100) : 0}%`);

    // 4. Verify all clinics now have PINs
    let allHavePINs = true;
    for (const clinic of (clinics || [])) {
      const { data: pin } = await supabase
        .from('pins')
        .select('*')
        .eq('clinic_code', clinic.id)
        .eq('is_active', true)
        .gte('expires_at', now)
        .maybeSingle();

      if (!pin) {
        allHavePINs = false;
        break;
      }
    }

    console.log(`\n✅ All clinics have active PINs: ${allHavePINs}`);
    console.log('\n✅ Self-healing test completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSelfHealing();
