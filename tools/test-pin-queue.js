/*
 Internal smoke test for Queue + PIN + Route + SSE
 Usage:
   node tools/test-pin-queue.js
 Optional env:
   BASE_URL=http://127.0.0.1:8096
*/
import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';

const ROOT = process.cwd();
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;

function log(msg) { process.stdout.write(msg + '\n'); }
async function http(method, url, body) {
    const res = await fetch(url, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null; try { data = JSON.parse(text); } catch { /* keep text */ }
    if (!res.ok) throw new Error(`${method} ${url} => ${res.status}: ${text}`);
    return data ?? text;
}

async function main() {
    const report = [];
    const add = (line) => { report.push(line); log(line); };

    // Health
    try {
        const health = await http('GET', `${BASE_URL}/healthz`);
        add(`✅ /healthz ok tz=${health.tz} pinTime=${health.pinTime}`);
    } catch (e) {
        add(`❌ /healthz failed: ${e.message}`);
    }

    // Clinics from route map
    const routeMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/routeMap.json'), 'utf8'));
    const clinics = new Set();
    for (const key of Object.keys(routeMap.routes || {})) {
        for (const step of routeMap.routes[key]) {
            if (step && step.clinicId) clinics.add(step.clinicId);
        }
    }
    add(`ℹ️ Clinics detected: ${Array.from(clinics).join(', ')}`);

    // Pin issue/peek
    for (const c of clinics) {
        try {
            const out = await http('POST', `${BASE_URL}/api/pin/assign-first`, { visitId: 'smoke-v', clinicId: c });
            add(`✅ PIN assigned for clinic ${c}: ${out.pin}`);
            const peek = await http('GET', `${BASE_URL}/api/pin/peek?clinicId=${encodeURIComponent(c)}`);
            add(`✅ PIN peek for ${c}: next=${peek.nextPin ?? 'null'}`);
        } catch (e) {
            add(`❌ PIN ops failed for ${c}: ${e.message}`);
        }
    }

    // Queue enter/complete for first clinic
    const firstClinic = Array.from(clinics)[0];
    if (firstClinic) {
        try {
            const ent = await http('POST', `${BASE_URL}/api/queue/enter`, { clinicId: firstClinic, visitId: 'smoke-v' });
            add(`✅ Queue enter ${firstClinic}: ticket=${ent.ticket}`);
            const comp = await http('POST', `${BASE_URL}/api/queue/complete`, { clinicId: firstClinic, ticket: ent.ticket });
            add(`✅ Queue complete ${firstClinic}: ok=${comp.ok === true}`);
        } catch (e) {
            add(`❌ Queue ops failed for ${firstClinic}: ${e.message}`);
        }
    }

    // Route assign and next
    try {
        const route = await http('POST', `${BASE_URL}/api/route/assign`, { visitId: 'smoke-route', examType: 'training', gender: 'M' });
        add(`✅ Route assigned with ${route?.route?.steps?.length ?? 0} steps`);
        // Generate a doctor PIN for first step clinic
        const nextClinic = route?.route?.steps?.find(s => !s.womenOnly)?.clinicId;
        if (nextClinic) {
            const gen = await http('POST', `${BASE_URL}/api/admin/generate-pin`, { stationId: nextClinic });
            add(`✅ Admin PIN generated for ${nextClinic}: ${gen.pin}`);
            const adv = await http('POST', `${BASE_URL}/api/route/next`, { visitId: 'smoke-route', clinicId: nextClinic, pin: gen.pin });
            add(`✅ Route next advanced to: ${adv?.next?.clinicId ?? 'completed'}`);
        }
    } catch (e) {
        add(`❌ Route ops failed: ${e.message}`);
    }

    fs.writeFileSync(path.join(ROOT, 'TEST_REPORT.md'), report.join('\n'));
}

main().catch(err => { console.error(err); process.exit(1); });
