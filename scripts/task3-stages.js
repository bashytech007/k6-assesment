import http from 'k6/http';
import { check, sleep } from 'k6';

// Base URL from environment variable
const BASE_URL = __ENV.BASE_URL || 'https://ternny.com';

// Task 3: Load Test with Ramp-Up / Ramp-Down Stages

const TEST_TYPE = __ENV.TEST_TYPE || 'load';

// ── Load Test profile (Section 4.2) 
// Models expected traffic with a gradual warm-up and graceful cool-down.
const LOAD_STAGES = [
  // Stage 1: Warm up — ramp from 0 to 10 VUs over 30s.

  { duration: '30s', target: 10 },

  // Stage 2: Steady state — hold 10 VUs for 1 minute.

  { duration: '1m', target: 10 },

  // Stage 3: Scale up — ramp to 50 VUs over 30s.

  { duration: '30s', target: 50 },

  // Stage 4: Peak hold — sustain 50 VUs for 2 minutes.
 
  { duration: '2m', target: 50 },

  // Stage 5: Ramp down — drop gracefully from 50 VUs back to 0 over 1 minute.

  { duration: '1m', target: 0 },
];


const SPIKE_STAGES = [
  // Establish a calm baseline before the spike.
  { duration: '30s', target: 5 },

  { duration: '10s', target: 150 },

  
  { duration: '2m', target: 150 },

 
  { duration: '10s', target: 5 },

  
  { duration: '2m', target: 5 },


  { duration: '30s', target: 0 },
];

export const options = {
  stages: TEST_TYPE === 'spike' ? SPIKE_STAGES : LOAD_STAGES,

  thresholds: {
    // 95th percentile response time across all endpoints must stay under 500ms
    'http_req_duration': ['p(95)<500'],

    // Error rate must not exceed 1%
    'http_req_failed': ['rate<0.01'],

    // All custom check assertions must pass at 99%+ rate
    'checks': ['rate>0.99'],

    // Per-endpoint SLA thresholds (from Part 1, Section 5.2)
    'http_req_duration{url:${BASE_URL}/auth}':           ['p(95)<500'],
    'http_req_failed{url:${BASE_URL}/auth}':             ['rate<0.01'],
    'http_req_duration{url:${BASE_URL}/add-trip}':       ['p(95)<700'],
    'http_req_failed{url:${BASE_URL}/add-trip}':         ['rate<0.005'],
    'http_req_duration{url:${BASE_URL}/plan}':           ['p(95)<600'],
    'http_req_failed{url:${BASE_URL}/plan}':             ['rate<0.01'],
  },
};

export default function () {

  // ── /auth ──────────────────────────────────────────────────────────────────
  const authRes = http.get(`${BASE_URL}/auth`);
  check(authRes, {
    '/auth: status is 200':        (r) => r.status === 200,
    '/auth: body is not empty':    (r) => r.body && r.body.length > 0,
    '/auth: response under 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);

  // ── /add-trip ──────────────────────────────────────────────────────────────
  const addTripRes = http.get(`${BASE_URL}/add-trip`);
  check(addTripRes, {
    '/add-trip: status is 200':        (r) => r.status === 200,
    '/add-trip: body is not empty':    (r) => r.body && r.body.length > 0,
    '/add-trip: response under 700ms': (r) => r.timings.duration < 700,
  });
  sleep(1);

  // ── /travel-persona ────────────────────────────────────────────────────────
  const personaRes = http.get(`${BASE_URL}/travel-persona`);
  check(personaRes, {
    '/travel-persona: status is 200':        (r) => r.status === 200,
    '/travel-persona: body is not empty':    (r) => r.body && r.body.length > 0,
    '/travel-persona: response under 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);

  // ── /plan ──────────────────────────────────────────────────────────────────
  const planRes = http.get(`${BASE_URL}/plan`);
  check(planRes, {
    '/plan: status is 200':        (r) => r.status === 200,
    '/plan: body is not empty':    (r) => r.body && r.body.length > 0,
    '/plan: response under 600ms': (r) => r.timings.duration < 600,
  });
  sleep(1);

  // ── /profile ───────────────────────────────────────────────────────────────
  const profileRes = http.get(`${BASE_URL}/profile`);
  check(profileRes, {
    '/profile: status is 200':        (r) => r.status === 200,
    '/profile: body is not empty':    (r) => r.body && r.body.length > 0,
    '/profile: response under 450ms': (r) => r.timings.duration < 450,
  });
  sleep(1);
}
