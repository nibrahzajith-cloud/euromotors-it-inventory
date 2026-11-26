/**
 * Standardized Read-Only Deployment Smoke Test
 * Usage:
 *   node scripts/verify_deployment.mjs --api=http://127.0.0.1:5000/api --web=http://localhost:5173
 *   node scripts/verify_deployment.mjs --api=https://euromotors-it-inventory.onrender.com/api --web=https://euromotors-it-inventory.vercel.app
 */

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const idx = a.indexOf('=');
      return idx === -1 ? [a.slice(2), 'true'] : [a.slice(2, idx), a.slice(idx + 1)];
    })
);

const API_BASE = (args.api || 'http://127.0.0.1:5000/api').replace(/\/$/, '');
const WEB_BASE = (args.web || 'http://localhost:5173').replace(/\/$/, '');
const EXPECTED_CONTRACT = 'helpdesk-v1';

async function checkEndpoint(name, url, acceptedStatuses) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const ok = acceptedStatuses.includes(res.status);
    return { name, url, status: res.status, ok, json };
  } catch (err) {
    return { name, url, status: 'NETWORK_ERROR', ok: false, error: err.message };
  }
}

(async () => {
  console.log(`\nEuro Motors Production / Localhost Smoke Verification`);
  console.log(`Web Base: ${WEB_BASE}`);
  console.log(`API Base: ${API_BASE}\n`);

  const webRes = await checkEndpoint('Frontend Entry HTML', `${WEB_BASE}/`, [200]);
  const healthRes = await checkEndpoint('API Health & Version', `${API_BASE}/health`, [200]);
  const portalRes = await checkEndpoint('Smart Portal Public Status', `${API_BASE}/portal/status`, [200]);
  const dashRes = await checkEndpoint('Dashboard Advanced (Auth Guarded)', `${API_BASE}/dashboard/advanced`, [401]);
  const hdSummaryRes = await checkEndpoint('Help Desk Employee Summary (Auth Guarded)', `${API_BASE}/helpdesk/my-summary`, [401]);
  const hdMgmtRes = await checkEndpoint('Help Desk Management Dashboard (Auth Guarded)', `${API_BASE}/helpdesk/management/dashboard`, [401]);
  const hdFormRes = await checkEndpoint('Help Desk Form Options (Auth Guarded)', `${API_BASE}/helpdesk/form-options`, [401]);
  const notifRes = await checkEndpoint('Notifications Endpoint (Auth Guarded)', `${API_BASE}/notifications`, [401]);
  const verRes = await checkEndpoint('System Version Endpoint (Auth Guarded)', `${API_BASE}/settings/version`, [401]);

  const results = [webRes, healthRes, portalRes, dashRes, hdSummaryRes, hdMgmtRes, hdFormRes, notifRes, verRes];
  let failures = 0;

  for (const r of results) {
    const badge = r.ok ? 'PASS' : 'FAIL';
    if (!r.ok) failures++;
    console.log(`[${badge}] ${r.name} -> HTTP ${r.status} (${r.url})`);
    if (r.error) console.log(`       Error: ${r.error}`);
  }

  if (healthRes.ok && healthRes.json) {
    console.log('\nBackend Health Metadata:');
    console.log(JSON.stringify(healthRes.json, null, 2));
    if (healthRes.json.apiContract !== EXPECTED_CONTRACT) {
      failures++;
      console.log(`[FAIL] API contract mismatch: expected ${EXPECTED_CONTRACT}, got ${healthRes.json.apiContract || 'legacy'}`);
    }
  } else {
    failures++;
    console.log('\n[FAIL] Missing structured version/contract fields in /api/health');
  }

  console.log(`\nSmoke Test Result: ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
