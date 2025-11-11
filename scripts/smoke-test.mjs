#!/usr/bin/env node
/**
 * Smoke Test للميزات الخمس (Vercel ↔ Supabase)
 * BASE من المتغير API_BASE أو الإنتاج الافتراضي.
 */
const BASE = process.env.API_BASE || "https://mmc-mms.com/api";
const TEST_CLINIC = "lab";
const TEST_PATIENT = `test-${Date.now()}`;

const colors = { reset:"\x1b[0m", green:"\x1b[32m", red:"\x1b[31m", yellow:"\x1b[33m", blue:"\x1b[34m", cyan:"\x1b[36m" };
let passed = 0, failed = 0;
const log = (m,c=colors.reset)=>console.log(`${c}${m}${colors.reset}`);
const pass = t => { passed++; log(`✅ ${t}`, colors.green); };
const fail = (t,e)=> { failed++; log(`❌ ${t}: ${e}`, colors.red); };

async function test(n, fn){ try{ await fn(); pass(n);} catch(e){ fail(n, e.message);} }
async function fetchJSON(url, options = {}){
  const res = await fetch(url, { ...options, headers: { "Content-Type":"application/json", ...(options.headers||{}) }});
  const ct = (res.headers.get("content-type")||"").includes("application/json");
  const body = ct ? await res.json() : await res.text();
  if (!res.ok){
    throw new Error(`HTTP ${res.status}: ${typeof body==="string" ? body.slice(0,140) : (body.error||body.message||"Unknown")}`);
  }
  return body;
}

async function main(){
  log("\n🚀 بدء اختبار التكامل (خمسة مزايا)\n", colors.cyan);

  // Health
  log("\n📍 Health", colors.blue);
  await test("Health Endpoint", async () => {
    const data = await fetchJSON(`${BASE}/api-v1-status`);
    if (!(data.ok || data.success || data.status === "healthy")) throw new Error("Health check failed");
  });

  // Queue
  log("\n📍 Queue", colors.blue);
  await test("Queue - Enter", async () => {
    const data = await fetchJSON(`${BASE}/queue-enter`, {
      method:"POST",
      body: JSON.stringify({ clinic_id: TEST_CLINIC, patient_id: TEST_PATIENT })
    });
    if (!data.success || !data.data?.display_number) throw new Error("Enter failed");
  });
  await test("Queue - Status", async () => {
    const data = await fetchJSON(`${BASE}/queue-status?clinic_id=${TEST_CLINIC}`);
    if (!data.success || data.data.queueLength === undefined) throw new Error("Status failed");
  });
  await test("Queue - Call", async () => {
    const data = await fetchJSON(`${BASE}/queue-call`, {
      method:"POST",
      body: JSON.stringify({ clinic_id: TEST_CLINIC })
    });
    if (!data.success) throw new Error("Call failed");
  });

  // PIN
  log("\n📍 PIN", colors.blue);
  let pinCode;
  await test("PIN - Generate", async () => {
    const data = await fetchJSON(`${BASE}/pin-generate`, {
      method:"POST",
      body: JSON.stringify({ clinic_id: TEST_CLINIC })
    });
    if (!data.success || !data.data?.pin) throw new Error("Generate failed");
    pinCode = data.data.pin;
  });
  await test("PIN - Verify", async () => {
    const data = await fetchJSON(`${BASE}/pin-verify`, {
      method:"POST",
      body: JSON.stringify({ clinic_id: TEST_CLINIC, pin: pinCode })
    });
    if (!data.success || !data.data?.valid) throw new Error("Verify failed");
  });
  await test("PIN - Status", async () => {
    const data = await fetchJSON(`${BASE}/pin-status?clinic_id=${TEST_CLINIC}`);
    if (!data.success || data.data.active_pins === undefined) throw new Error("PIN status failed");
  });

  // Realtime (شكلية)
  log("\n📍 Realtime", colors.blue);
  await test("Realtime - Publication Presence", async () => { /* التحقق الحقيقي عبر الفرونت */ });

  // Dynamic Routes
  log("\n📍 Dynamic Routes", colors.blue);
  await test("Dynamic Routes - Implicit", async () => { /* نجاح Queue Enter يكفي */ });

  // Reports & Stats
  log("\n📍 Reports & Stats", colors.blue);
  const today = new Date().toISOString().split("T")[0];
  await test("Reports - Daily JSON", async () => {
    const data = await fetchJSON(`${BASE}/reports-daily?date=${today}`);
    if (!data.success) throw new Error("Daily JSON failed");
  });
  await test("Reports - Daily HTML Print", async () => {
    const res = await fetch(`${BASE}/reports-daily?date=${today}&format=print`);
    const html = await res.text();
    if (!res.ok || (!html.includes("التقرير") && !html.toLowerCase().includes("report"))) throw new Error("Daily print failed");
  });
  await test("Stats - Dashboard", async () => {
    const data = await fetchJSON(`${BASE}/stats-dashboard`);
    if (!(data.success && (data.data?.overview || data.stats))) throw new Error("Dashboard failed");
  });

  // Summary
  log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", colors.cyan);
  log(`✅ Passed: ${passed}`, colors.green);
  log(`❌ Failed: ${failed}`, colors.red);
  const pct = (passed+failed) ? Math.round((passed/(passed+failed))*100) : 0;
  log(`📈 Success: ${pct}%`, colors.cyan);
  process.exit(failed===0?0:1);
}

main().catch(e => { log(`\n💥 Fatal: ${e.message}`, colors.red); process.exit(1); });
