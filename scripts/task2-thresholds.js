import http from 'k6/http';
import { check, sleep } from 'k6';

// Base URL from environment variable
const BASE_URL = __ENV.BASE_URL || 'https://ternny.com';

// Task 2: Thresholds & Checks — 10 VUs, 1 minute
// Purpose: Validate SLA thresholds with meaningful assertions per endpoint
export const options = {
  vus: 10,
  duration: '1m',

  thresholds: {
    // Global: 95th percentile must stay under 500ms
    'http_req_duration': ['p(95)<500'],

    // Global: error rate below 1%
    'http_req_failed': ['rate<0.01'],

    // All checks must pass at 99%+ rate
    'checks': ['rate>0.99'],

    // Per-endpoint SLA thresholds (from Part 1, Section 5.2)
    'http_req_duration{url:${BASE_URL}/auth}':           ['p(95)<500'],
    'http_req_failed{url:${BASE_URL}/auth}':             ['rate<0.01'],

    'http_req_duration{url:${BASE_URL}/add-trip}':       ['p(95)<700'],
    'http_req_failed{url:${BASE_URL}/add-trip}':         ['rate<0.005'],

    'http_req_duration{url:${BASE_URL}/travel-persona}': ['p(95)<500'],
    'http_req_failed{url:${BASE_URL}/travel-persona}':   ['rate<0.01'],

    'http_req_duration{url:${BASE_URL}/plan}':           ['p(95)<600'],
    'http_req_failed{url:${BASE_URL}/plan}':             ['rate<0.01'],

    'http_req_duration{url:${BASE_URL}/profile}':        ['p(95)<450'],
    'http_req_failed{url:${BASE_URL}/profile}':          ['rate<0.01'],
  },
};

export default function () {

  // ── 1. /auth ──────────────────────────────────────────────────────────────
  const authRes = http.get(`${BASE_URL}/auth`);
  check(authRes, {
    '/auth: status is 200':                (r) => r.status === 200,
    '/auth: body is not empty':            (r) => r.body && r.body.length > 0,
    '/auth: content-type is html or json': (r) => r.headers['Content-Type'] !== undefined,
    '/auth: response under 500ms':         (r) => r.timings.duration < 500,
  });
  sleep(1);

  // ── 2. /add-trip ──────────────────────────────────────────────────────────
  const addTripRes = http.get(`${BASE_URL}/add-trip`);
  check(addTripRes, {
    '/add-trip: status is 200':               (r) => r.status === 200,
    '/add-trip: body is not empty':           (r) => r.body && r.body.length > 0,
    '/add-trip: content-type header present': (r) => r.headers['Content-Type'] !== undefined,
    '/add-trip: response under 700ms':        (r) => r.timings.duration < 700,
  });
  sleep(1);

  // ── 3. /travel-persona ────────────────────────────────────────────────────
  const personaRes = http.get(`${BASE_URL}/travel-persona`);
  check(personaRes, {
    '/travel-persona: status is 200':               (r) => r.status === 200,
    '/travel-persona: body is not empty':           (r) => r.body && r.body.length > 0,
    '/travel-persona: content-type header present': (r) => r.headers['Content-Type'] !== undefined,
    '/travel-persona: response under 500ms':        (r) => r.timings.duration < 500,
  });
  sleep(1);

  // ── 4. /plan ──────────────────────────────────────────────────────────────
  const planRes = http.get(`${BASE_URL}/plan`);
  check(planRes, {
    '/plan: status is 200':               (r) => r.status === 200,
    '/plan: body is not empty':           (r) => r.body && r.body.length > 0,
    '/plan: content-type header present': (r) => r.headers['Content-Type'] !== undefined,
    '/plan: response under 600ms':        (r) => r.timings.duration < 600,
  });
  sleep(1);

  // ── 5. /profile ───────────────────────────────────────────────────────────
  const profileRes = http.get(`${BASE_URL}/profile`);
  check(profileRes, {
    '/profile: status is 200':               (r) => r.status === 200,
    '/profile: body is not empty':           (r) => r.body && r.body.length > 0,
    '/profile: content-type header present': (r) => r.headers['Content-Type'] !== undefined,
    '/profile: response under 450ms':        (r) => r.timings.duration < 450,
  });
  sleep(1);
}
