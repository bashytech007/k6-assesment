import http from 'k6/http';
import { check, group, sleep } from 'k6';

// Base URL from environment variable
const BASE_URL = __ENV.BASE_URL || 'https://ternny.com';

// ── Traffic Distribution Model (Section 3.4) ──────────────────────────────────

const TRAFFIC_SPLIT = {
  auth:    0.15,  
  plan:    0.35, 
  addTrip: 0.20,  
  persona: 0.15,  
  profile: 0.15, 
};

export const options = {
  // Load profile for user journey testing
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 50 },
    { duration: '2m',  target: 50 },
    { duration: '30s', target: 0  },
  ],

  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'http_req_failed':   ['rate<0.01'],
    'checks':            ['rate>0.99'],

    // Per-endpoint thresholds
    'http_req_duration{url:${BASE_URL}/auth}':    ['p(95)<500'],
    'http_req_duration{url:${BASE_URL}/add-trip}':['p(95)<700'],
    'http_req_duration{url:${BASE_URL}/plan}':    ['p(95)<600'],
  },
};

// ── Probabilistic Traffic Routing ─────────────────────────────────────────────
// Math.random() produces a uniform [0,1) value each iteration.
// We accumulate cumulative thresholds to route to each endpoint proportionally.
export default function () {
  const random = Math.random();

  if (random < TRAFFIC_SPLIT.auth) {
    // ── Auth (15%) ─────────────────────────────────────────────────────────
    group('Auth', () => {
      const res = http.get(`${BASE_URL}/auth`);
      check(res, {
        '/auth: status is 200':            (r) => r.status === 200,
        '/auth: body is not empty':        (r) => r.body && r.body.length > 0,
        '/auth: content-type present':     (r) => r.headers['Content-Type'] !== undefined,
        '/auth: response under SLA 500ms': (r) => r.timings.duration < 500,
      });
      sleep(1); // Simulate user think time after auth
    });

  } else if (random < TRAFFIC_SPLIT.auth + TRAFFIC_SPLIT.plan) {
    // ── Plan (35%) ─────────────────────────────────────────────────────────
    group('Plan', () => {
      const res = http.get(`${BASE_URL}/plan`);
      check(res, {
        '/plan: status is 200':            (r) => r.status === 200,
        '/plan: body is not empty':        (r) => r.body && r.body.length > 0,
        '/plan: content-type present':     (r) => r.headers['Content-Type'] !== undefined,
        '/plan: response under SLA 600ms': (r) => r.timings.duration < 600,
      });
      sleep(1); // Simulate user browsing their itinerary
    });

  } else if (random < TRAFFIC_SPLIT.auth + TRAFFIC_SPLIT.plan + TRAFFIC_SPLIT.addTrip) {
    // ── Add Trip (20%) ─────────────────────────────────────────────────────
    group('Add Trip', () => {
      const res = http.get(`${BASE_URL}/add-trip`);
      check(res, {
        '/add-trip: status is 200':            (r) => r.status === 200,
        '/add-trip: body is not empty':        (r) => r.body && r.body.length > 0,
        '/add-trip: content-type present':     (r) => r.headers['Content-Type'] !== undefined,
        '/add-trip: response under SLA 700ms': (r) => r.timings.duration < 700,
      });
      sleep(1); // Simulate user filling in trip details
    });

  } else if (random < TRAFFIC_SPLIT.auth + TRAFFIC_SPLIT.plan + TRAFFIC_SPLIT.addTrip + TRAFFIC_SPLIT.persona) {
    // ── Travel Persona (15%) ───────────────────────────────────────────────
    group('Travel Persona', () => {
      const res = http.get(`${BASE_URL}/travel-persona`);
      check(res, {
        '/travel-persona: status is 200':            (r) => r.status === 200,
        '/travel-persona: body is not empty':        (r) => r.body && r.body.length > 0,
        '/travel-persona: content-type present':     (r) => r.headers['Content-Type'] !== undefined,
        '/travel-persona: response under SLA 500ms': (r) => r.timings.duration < 500,
      });
      sleep(1); // Simulate user reviewing travel preferences
    });

  } else {
    // ── Profile (15%) ──────────────────────────────────────────────────────
    group('Profile', () => {
      const res = http.get(`${BASE_URL}/profile`);
      check(res, {
        '/profile: status is 200':            (r) => r.status === 200,
        '/profile: body is not empty':        (r) => r.body && r.body.length > 0,
        '/profile: content-type present':     (r) => r.headers['Content-Type'] !== undefined,
        '/profile: response under SLA 450ms': (r) => r.timings.duration < 450,
      });
      sleep(1); // Simulate user viewing their profile
    });
  }
}

// ── handleSummary — Export results as HTML report ─────────────────────────────
// Generates HTMLReport1.html in the current directory after the test run.
export function handleSummary(data) {
  const now = new Date().toISOString();

  const endpointRows = [
    { name: '/auth',           sla: 500,  errorSla: '< 1%'   },
    { name: '/add-trip',       sla: 700,  errorSla: '< 0.5%' },
    { name: '/travel-persona', sla: 500,  errorSla: '< 1%'   },
    { name: '/plan',           sla: 600,  errorSla: '< 1%'   },
    { name: '/profile',        sla: 450,  errorSla: '< 1%'   },
  ].map(({ name, sla, errorSla }) => {
    const key = `http_req_duration{url:${BASE_URL}${name}}`;
    const durationData = data.metrics[key] || data.metrics['http_req_duration'];
    const errorData    = data.metrics[`http_req_failed{url:${BASE_URL}${name}}`] || data.metrics['http_req_failed'];

    const p95     = durationData ? (durationData.values['p(95)'] || 0).toFixed(2) : 'N/A';
    const p99     = durationData ? (durationData.values['p(99)'] || 0).toFixed(2) : 'N/A';
    const errRate = errorData    ? (errorData.values.rate * 100).toFixed(3)        : 'N/A';
    const passed  = durationData ? parseFloat(p95) < sla                          : false;

    return `
      <tr>
        <td>${name}</td>
        <td>${p95} ms</td>
        <td>${sla} ms</td>
        <td class="${passed ? 'pass' : 'fail'}">${passed ? '✅ PASS' : '❌ FAIL'}</td>
        <td>${errRate}%</td>
        <td>${errorSla}</td>
        <td>${p99} ms</td>
      </tr>`;
  }).join('');

  const totalReqs  = data.metrics.http_reqs         ? data.metrics.http_reqs.values.count          : 'N/A';
  const checksRate = data.metrics.checks            ? (data.metrics.checks.values.rate * 100).toFixed(2) : 'N/A';
  const globalP95  = data.metrics.http_req_duration ? (data.metrics.http_req_duration.values['p(95)'] || 0).toFixed(2) : 'N/A';
  const globalErr  = data.metrics.http_req_failed   ? (data.metrics.http_req_failed.values.rate * 100).toFixed(3) : 'N/A';
  const peakVUs    = data.metrics.vus_max           ? data.metrics.vus_max.values.max              : 'N/A';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Ternny Performance Test Report — ${now}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #1a1a1a; line-height: 1.6; }
    .header { background: #1a1a2e; color: #e8e8e8; padding: 2rem 3rem; }
    .header h1 { font-size: 1.8rem; font-weight: 600; margin-bottom: 0.25rem; }
    .header p  { font-size: 0.9rem; color: #9999bb; }
    .container { max-width: 960px; margin: 2rem auto; padding: 0 1.5rem; }
    .card { background: #fff; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); padding: 1.5rem; margin-bottom: 1.5rem; }
    .card h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; color: #333; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; }
    .metric { background: #f8f9ff; border-radius: 8px; padding: 1rem; text-align: center; }
    .metric .value { font-size: 1.6rem; font-weight: 700; color: #1a1a2e; }
    .metric .label { font-size: 0.75rem; color: #666; margin-top: 0.25rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th { background: #f0f0f8; text-align: left; padding: 0.6rem 0.75rem; font-weight: 600; color: #444; }
    td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #f0f0f0; }
    tr:last-child td { border-bottom: none; }
    .pass { color: #2e7d32; font-weight: 600; }
    .fail { color: #c62828; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
    .badge-pass { background: #e8f5e9; color: #2e7d32; }
    .badge-fail { background: #ffebee; color: #c62828; }
    .footer { text-align: center; padding: 2rem; font-size: 0.8rem; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Ternny Travel App — Performance Test Report</h1>
    <p>QualityTechies 5-Day K6 Challenge &nbsp;|&nbsp; Generated: ${now} &nbsp;|&nbsp; Target: ${BASE_URL}</p>
  </div>

  <div class="container">

    <div class="card">
      <h2>Summary Metrics</h2>
      <div class="metrics-grid">
        <div class="metric"><div class="value">${totalReqs}</div><div class="label">Total Requests</div></div>
        <div class="metric"><div class="value">${globalP95} ms</div><div class="label">Global p(95)</div></div>
        <div class="metric"><div class="value">${globalErr}%</div><div class="label">Error Rate</div></div>
        <div class="metric"><div class="value">${checksRate}%</div><div class="label">Checks Passed</div></div>
        <div class="metric"><div class="value">${peakVUs}</div><div class="label">Peak VUs</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Endpoint SLA Results</h2>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>p(95) Actual</th>
            <th>p(95) Target</th>
            <th>SLA Status</th>
            <th>Error Rate</th>
            <th>Error SLA</th>
            <th>p(99) Actual</th>
          </tr>
        </thead>
        <tbody>${endpointRows}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>Traffic Distribution (Expected vs Actual)</h2>
      <table>
        <thead>
          <tr><th>Group</th><th>Expected Weight</th><th>Expected %</th></tr>
        </thead>
        <tbody>
          <tr><td>Auth</td><td>0.15</td><td>15%</td></tr>
          <tr><td>Plan</td><td>0.35</td><td>35%</td></tr>
          <tr><td>Add Trip</td><td>0.20</td><td>20%</td></tr>
          <tr><td>Travel Persona</td><td>0.15</td><td>15%</td></tr>
          <tr><td>Profile</td><td>0.15</td><td>15%</td></tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Threshold Definitions</h2>
      <table>
        <thead><tr><th>Threshold</th><th>Target</th></tr></thead>
        <tbody>
          <tr><td>http_req_duration p(95) — global</td><td>&lt; 500ms</td></tr>
          <tr><td>http_req_failed — global</td><td>&lt; 1%</td></tr>
          <tr><td>checks pass rate</td><td>&gt; 99%</td></tr>
          <tr><td>http_req_duration{/auth} p(95)</td><td>&lt; 500ms</td></tr>
          <tr><td>http_req_failed{/auth}</td><td>&lt; 1%</td></tr>
          <tr><td>http_req_duration{/add-trip} p(95)</td><td>&lt; 700ms</td></tr>
          <tr><td>http_req_failed{/add-trip}</td><td>&lt; 0.5%</td></tr>
          <tr><td>http_req_duration{/plan} p(95)</td><td>&lt; 600ms</td></tr>
          <tr><td>http_req_failed{/plan}</td><td>&lt; 1%</td></tr>
        </tbody>
      </table>
    </div>

  </div>

  <div class="footer">
    Ternny K6 Performance Testing &nbsp;•&nbsp; QualityTechies Programme &nbsp;•&nbsp; qualitytechies.com
  </div>
</body>
</html>`;

  return {
    'HTMLReport1.html': html,
    'stdout': `\nReport saved: HTMLReport1.html\nTest completed at: ${now}\nTarget: ${BASE_URL}\n`,
  };
}
