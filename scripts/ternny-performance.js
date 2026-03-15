

import http from 'k6/http';
import { check, group, sleep } from 'k6';

// ── Environment Configuration ─────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'https://ternny.com';
const PROFILE  = __ENV.PROFILE  || 'load'; // smoke | load | stress | spike

// ── Traffic Distribution Model (Section 3.4) ──────────────────────────────────

const TRAFFIC_SPLIT = {
  auth:    0.15, 
  plan:    0.35,  
  addTrip: 0.20,
  persona: 0.15,  
  profile: 0.15,  
};

// ── Load Profile Definitions ──────────────────────────────────────────────────

// SMOKE: Minimal validation — 1 VU for 30 seconds. Zero errors expected.
const SMOKE_OPTIONS = {
  vus:      1,
  duration: '30s',
};

// LOAD: Ramp-up → steady → scale → peak → ramp-down (Section 4.2)
const LOAD_STAGES = [
  { duration: '30s', target: 10 }, 
  { duration: '1m',  target: 10 }, 
  { duration: '30s', target: 50 }, 
  { duration: '2m',  target: 50 }, 
  { duration: '1m',  target: 0  }, 
];

// STRESS: Progressive overload to find the breaking point (Section 4.3)
const STRESS_STAGES = [
  { duration: '1m',  target: 50  }, 
  { duration: '2m',  target: 50  }, 
  { duration: '1m',  target: 100 }, 
  { duration: '2m',  target: 100 }, 
  { duration: '1m',  target: 200 }, 
  { duration: '2m',  target: 200 }, 
  { duration: '2m',  target: 0   }, 
];

// SPIKE: Sudden burst traffic (Section 4.4) — simulates a viral travel deal
const SPIKE_STAGES = [
  { duration: '30s', target: 5   }, // Baseline: calm pre-spike state
  { duration: '10s', target: 150 }, // Spike: jump to 150 VUs in 10s — sudden burst
  { duration: '2m',  target: 150 }, // Spike hold: observe system under sustained burst
  { duration: '10s', target: 5   }, // Recovery: drop quickly — test self-healing speed
  { duration: '2m',  target: 5   }, // Baseline resume: confirm normal behaviour resumes
  { duration: '30s', target: 0   }, // Graceful ramp down to 0
];

// ── Select profile based on PROFILE env var ───────────────────────────────────
function getOptions() {
  switch (PROFILE) {
    case 'smoke':
      return { ...SMOKE_OPTIONS, ...COMMON_THRESHOLDS };
    case 'stress':
      return { stages: STRESS_STAGES, ...COMMON_THRESHOLDS };
    case 'spike':
      return { stages: SPIKE_STAGES,  ...COMMON_THRESHOLDS };
    default: // 'load'
      return { stages: LOAD_STAGES,   ...COMMON_THRESHOLDS };
  }
}

// ── Thresholds (Part 1, Sections 5.1 & 5.2) ──────────────────────────────────
// A breached threshold causes K6 to exit with a non-zero code.
const COMMON_THRESHOLDS = {
  thresholds: {
    // ── Global thresholds ──────────────────────────────────────────────────
    // 95% of ALL requests must complete under 500ms
    'http_req_duration':             ['p(95)<500'],

    // 99th percentile must stay under 1 second
    'http_req_duration{percentile:99}': ['p(99)<1000'],

    // Error rate below 1%
    'http_req_failed':               ['rate<0.01'],

    // All check assertions must pass at ≥ 99%
    'checks':                        ['rate>0.99'],

    // ── Endpoint-specific thresholds ──────────────────────────────────────
    // /auth — stricter error tolerance (authentication is critical)
    [`http_req_duration{url:${BASE_URL}/auth}`]:           ['p(95)<500'],
    [`http_req_failed{url:${BASE_URL}/auth}`]:             ['rate<0.01'],

    // /add-trip — tightest error threshold (data loss is unacceptable)
    [`http_req_duration{url:${BASE_URL}/add-trip}`]:       ['p(95)<700'],
    [`http_req_failed{url:${BASE_URL}/add-trip}`]:         ['rate<0.005'],

    // /travel-persona — high criticality SLA
    [`http_req_duration{url:${BASE_URL}/travel-persona}`]: ['p(95)<500'],
    [`http_req_failed{url:${BASE_URL}/travel-persona}`]:   ['rate<0.01'],

    // /plan — core feature SLA
    [`http_req_duration{url:${BASE_URL}/plan}`]:           ['p(95)<600'],
    [`http_req_failed{url:${BASE_URL}/plan}`]:             ['rate<0.01'],

    // /profile — medium criticality
    [`http_req_duration{url:${BASE_URL}/profile}`]:        ['p(95)<450'],
    [`http_req_failed{url:${BASE_URL}/profile}`]:          ['rate<0.01'],
  },
};

// Export the resolved options
export const options = getOptions();

// ── Default Function — Probabilistic User Journey ─────────────────────────────
// Each VU iteration randomly picks one endpoint weighted by TRAFFIC_SPLIT.
// This models realistic user behaviour rather than hitting all endpoints equally.
export default function () {
  const random = Math.random(); // Uniform [0,1) random value

  if (random < TRAFFIC_SPLIT.auth) {
    // ── Auth (15%) ─────────────────────────────────────────────────────────
    // Users authenticate once at the start of a session
    group('Auth', () => {
      const res = http.get(`${BASE_URL}/auth`);
      check(res, {
        '/auth: status is 200':            (r) => r.status === 200,
        '/auth: body is not empty':        (r) => r.body && r.body.length > 0,
        '/auth: content-type present':     (r) => r.headers['Content-Type'] !== undefined,
        '/auth: response under SLA 500ms': (r) => r.timings.duration < 500,
      });
      sleep(1); // Think time: user reads login screen
    });

  } else if (random < TRAFFIC_SPLIT.auth + TRAFFIC_SPLIT.plan) {
    // ── Plan (35%) ─────────────────────────────────────────────────────────
    // Most visited endpoint — users spend the most time planning trips
    group('Plan', () => {
      const res = http.get(`${BASE_URL}/plan`);
      check(res, {
        '/plan: status is 200':            (r) => r.status === 200,
        '/plan: body is not empty':        (r) => r.body && r.body.length > 0,
        '/plan: content-type present':     (r) => r.headers['Content-Type'] !== undefined,
        '/plan: response under SLA 600ms': (r) => r.timings.duration < 600,
      });
      sleep(1); // Think time: user reviews itinerary
    });

  } else if (random < TRAFFIC_SPLIT.auth + TRAFFIC_SPLIT.plan + TRAFFIC_SPLIT.addTrip) {
    // ── Add Trip (20%) ─────────────────────────────────────────────────────
    // Content creation flow — moderately frequent, critical for data integrity
    group('Add Trip', () => {
      const res = http.get(`${BASE_URL}/add-trip`);
      check(res, {
        '/add-trip: status is 200':            (r) => r.status === 200,
        '/add-trip: body is not empty':        (r) => r.body && r.body.length > 0,
        '/add-trip: content-type present':     (r) => r.headers['Content-Type'] !== undefined,
        '/add-trip: response under SLA 700ms': (r) => r.timings.duration < 700,
      });
      sleep(1); // Think time: user fills in trip details
    });

  } else if (random < TRAFFIC_SPLIT.auth + TRAFFIC_SPLIT.plan + TRAFFIC_SPLIT.addTrip + TRAFFIC_SPLIT.persona) {
    // ── Travel Persona (15%) ───────────────────────────────────────────────
    // Configuration endpoint — set up once, revisited occasionally
    group('Travel Persona', () => {
      const res = http.get(`${BASE_URL}/travel-persona`);
      check(res, {
        '/travel-persona: status is 200':            (r) => r.status === 200,
        '/travel-persona: body is not empty':        (r) => r.body && r.body.length > 0,
        '/travel-persona: content-type present':     (r) => r.headers['Content-Type'] !== undefined,
        '/travel-persona: response under SLA 500ms': (r) => r.timings.duration < 500,
      });
      sleep(1); // Think time: user reads travel preferences
    });

  } else {
    // ── Profile (15%) ──────────────────────────────────────────────────────
    // Social feature — users view their own and others' profiles
    group('Profile', () => {
      const res = http.get(`${BASE_URL}/profile`);
      check(res, {
        '/profile: status is 200':            (r) => r.status === 200,
        '/profile: body is not empty':        (r) => r.body && r.body.length > 0,
        '/profile: content-type present':     (r) => r.headers['Content-Type'] !== undefined,
        '/profile: response under SLA 450ms': (r) => r.timings.duration < 450,
      });
      sleep(1); // Think time: user browses profile
    });
  }
}

// ── handleSummary — HTML Report Generation ────────────────────────────────────
// Automatically called by K6 at the end of the test run.
// Outputs HTMLReport1.html for review and GitHub submission.
export function handleSummary(data) {
  const now      = new Date().toISOString();
  const duration = data.state ? data.state.testRunDuration : 'N/A';

  // Helper: safely retrieve a metric value
  const m = (name, path) => {
    const parts = path.split('.');
    let val = (data.metrics[name] || {}).values;
    if (!val) return 'N/A';
    for (const p of parts) val = val[p] || val;
    return typeof val === 'number' ? val.toFixed(2) : 'N/A';
  };

  const mRaw = (name, path) => {
    const parts = path.split('.');
    let val = (data.metrics[name] || {}).values;
    if (!val) return null;
    for (const p of parts) val = val[p] || val;
    return typeof val === 'number' ? val : null;
  };

  // Build endpoint rows
  const endpoints = [
    { name: '/auth',           p95Sla: 500,  errSla: 0.01  },
    { name: '/plan',           p95Sla: 600,  errSla: 0.01  },
    { name: '/add-trip',       p95Sla: 700,  errSla: 0.005 },
    { name: '/travel-persona', p95Sla: 500,  errSla: 0.01  },
    { name: '/profile',        p95Sla: 450,  errSla: 0.01  },
  ];

  const rows = endpoints.map(ep => {
    const durKey = `http_req_duration{url:${BASE_URL}${ep.name}}`;
    const errKey = `http_req_failed{url:${BASE_URL}${ep.name}}`;
    const p95val = mRaw(durKey, 'p(95)') || mRaw('http_req_duration', 'p(95)');
    const errVal = mRaw(errKey, 'rate')  || mRaw('http_req_failed', 'rate');
    const p99val = mRaw(durKey, 'p(99)') || mRaw('http_req_duration', 'p(99)');
    const slaPassed  = p95val !== null && p95val < ep.p95Sla;
    const errPassed  = errVal !== null && errVal < ep.errSla;

    return `<tr>
      <td><code>${ep.name}</code></td>
      <td>${p95val !== null ? p95val.toFixed(1) + ' ms' : 'N/A'}</td>
      <td>${ep.p95Sla} ms</td>
      <td class="${slaPassed ? 'pass' : 'fail'}">${slaPassed ? '✅ PASS' : '❌ FAIL'}</td>
      <td>${errVal !== null ? (errVal * 100).toFixed(3) + '%' : 'N/A'}</td>
      <td>${(ep.errSla * 100).toFixed(1)}%</td>
      <td class="${errPassed ? 'pass' : 'fail'}">${errPassed ? '✅ PASS' : '❌ FAIL'}</td>
      <td>${p99val !== null ? p99val.toFixed(1) + ' ms' : 'N/A'}</td>
    </tr>`;
  }).join('\n');

  const globalP95  = m('http_req_duration', 'p(95)');
  const globalP99  = m('http_req_duration', 'p(99)');
  const globalErr  = mRaw('http_req_failed', 'rate');
  const totalReqs  = mRaw('http_reqs', 'count');
  const checksRate = mRaw('checks', 'rate');
  const peakVUs    = mRaw('vus_max', 'max');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Ternny K6 Performance Report</title>
  <style>
    :root {
      --bg: #f4f5f7; --card: #ffffff; --border: #e2e4e9;
      --text: #1c1e26; --muted: #6b7280; --accent: #1a1a2e;
      --pass-bg: #ecfdf5; --pass-fg: #065f46;
      --fail-bg: #fef2f2; --fail-fg: #991b1b;
      --blue: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.6; }
    header { background: var(--accent); color: #e8e8f0; padding: 2rem 3rem; }
    header h1 { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.5px; }
    header p  { font-size: 0.85rem; color: #9999cc; margin-top: 0.3rem; }
    main { max-width: 1000px; margin: 2rem auto; padding: 0 1.5rem; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px;
            padding: 1.5rem; margin-bottom: 1.5rem; }
    .card h2 { font-size: 1rem; font-weight: 600; color: var(--accent); margin-bottom: 1.25rem;
               padding-bottom: 0.6rem; border-bottom: 1px solid var(--border); }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; }
    .metric { background: #f8f9ff; border: 1px solid var(--border); border-radius: 8px;
              padding: 1rem; text-align: center; }
    .metric .val { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
    .metric .lbl { font-size: 0.72rem; color: var(--muted); margin-top: 4px; text-transform: uppercase;
                   letter-spacing: 0.04em; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    th { background: #f0f1f5; text-align: left; padding: 8px 10px; font-weight: 600;
         color: var(--muted); text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.05em; }
    td { padding: 9px 10px; border-bottom: 1px solid #f0f1f5; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    code { font-size: 0.8rem; background: #f0f1f5; padding: 2px 6px; border-radius: 4px; }
    .pass { color: var(--pass-fg); font-weight: 600; }
    .fail { color: var(--fail-fg); font-weight: 600; }
    .traffic-bar { height: 6px; background: var(--blue); border-radius: 3px; }
    footer { text-align: center; color: var(--muted); font-size: 0.78rem; padding: 2rem 0; }
  </style>
</head>
<body>

<header>
  <h1>Ternny Travel App — Performance Test Report</h1>
  <p>QualityTechies 5-Day K6 Challenge &nbsp;|&nbsp;
     Profile: <strong>${PROFILE.toUpperCase()}</strong> &nbsp;|&nbsp;
     Target: <strong>${BASE_URL}</strong> &nbsp;|&nbsp;
     Generated: ${now}</p>
</header>

<main>

  <div class="card">
    <h2>Executive Summary</h2>
    <div class="metrics">
      <div class="metric">
        <div class="val">${totalReqs !== null ? totalReqs.toLocaleString() : 'N/A'}</div>
        <div class="lbl">Total Requests</div>
      </div>
      <div class="metric">
        <div class="val">${globalP95} ms</div>
        <div class="lbl">Global p(95)</div>
      </div>
      <div class="metric">
        <div class="val">${globalP99} ms</div>
        <div class="lbl">Global p(99)</div>
      </div>
      <div class="metric">
        <div class="val">${globalErr !== null ? (globalErr * 100).toFixed(3) + '%' : 'N/A'}</div>
        <div class="lbl">Error Rate</div>
      </div>
      <div class="metric">
        <div class="val">${checksRate !== null ? (checksRate * 100).toFixed(1) + '%' : 'N/A'}</div>
        <div class="lbl">Checks Passed</div>
      </div>
      <div class="metric">
        <div class="val">${peakVUs !== null ? peakVUs : 'N/A'}</div>
        <div class="lbl">Peak VUs</div>
      </div>
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
          <th>p(95) Status</th>
          <th>Error Rate</th>
          <th>Error Target</th>
          <th>Error Status</th>
          <th>p(99) Actual</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Traffic Distribution</h2>
    <table>
      <thead><tr><th>Group</th><th>Expected</th><th>Distribution</th></tr></thead>
      <tbody>
        <tr><td><code>/auth</code></td><td>15%</td><td><div class="traffic-bar" style="width:15%"></div></td></tr>
        <tr><td><code>/plan</code></td><td>35%</td><td><div class="traffic-bar" style="width:35%"></div></td></tr>
        <tr><td><code>/add-trip</code></td><td>20%</td><td><div class="traffic-bar" style="width:20%"></div></td></tr>
        <tr><td><code>/travel-persona</code></td><td>15%</td><td><div class="traffic-bar" style="width:15%"></div></td></tr>
        <tr><td><code>/profile</code></td><td>15%</td><td><div class="traffic-bar" style="width:15%"></div></td></tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>How to Run</h2>
    <table>
      <thead><tr><th>Profile</th><th>Command</th></tr></thead>
      <tbody>
        <tr><td>Load (default)</td><td><code>k6 run --env BASE_URL=https://ternny.com ternny-performance.js</code></td></tr>
        <tr><td>Smoke</td><td><code>k6 run --env BASE_URL=https://ternny.com --env PROFILE=smoke ternny-performance.js</code></td></tr>
        <tr><td>Stress</td><td><code>k6 run --env BASE_URL=https://ternny.com --env PROFILE=stress ternny-performance.js</code></td></tr>
        <tr><td>Spike</td><td><code>k6 run --env BASE_URL=https://ternny.com --env PROFILE=spike ternny-performance.js</code></td></tr>
      </tbody>
    </table>
  </div>

</main>

<footer>
  Ternny K6 Performance Testing &nbsp;•&nbsp; QualityTechies Programme &nbsp;•&nbsp;
  <a href="https://qualitytechies.com" style="color: var(--muted);">qualitytechies.com</a>
</footer>

</body>
</html>`;

  return {
    'HTMLReport1.html': html,
    'stdout': `\n✅ Report saved: HTMLReport1.html\n📊 Profile: ${PROFILE}\n🌐 Target:  ${BASE_URL}\n⏱  Generated: ${now}\n`,
  };
}
