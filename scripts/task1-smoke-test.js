import http from 'k6/http';
import { check, sleep } from 'k6';

// Base URL from environment variable (set with --env BASE_URL=https://ternny.com)
const BASE_URL = __ENV.BASE_URL || 'https://ternny.com';

// Task 1: Smoke Test — 1 VU, 30 seconds
// Purpose: Verify all five Ternny endpoints respond correctly with minimal load
export const options = {
  vus: 1,
  duration: '30s',
};

export default function () {

  // ── 1. /auth ──────────────────────────────────────────────────────────────
  const authRes = http.get(`${BASE_URL}/auth`);
  check(authRes, {
    '/auth: status is 200':        (r) => r.status === 200,
    '/auth: body is not empty':    (r) => r.body && r.body.length > 0,
  });
  sleep(1);

  // ── 2. /add-trip ──────────────────────────────────────────────────────────
  const addTripRes = http.get(`${BASE_URL}/add-trip`);
  check(addTripRes, {
    '/add-trip: status is 200':     (r) => r.status === 200,
    '/add-trip: body is not empty': (r) => r.body && r.body.length > 0,
  });
  sleep(1);

  // ── 3. /travel-persona ────────────────────────────────────────────────────
  const personaRes = http.get(`${BASE_URL}/travel-persona`);
  check(personaRes, {
    '/travel-persona: status is 200':     (r) => r.status === 200,
    '/travel-persona: body is not empty': (r) => r.body && r.body.length > 0,
  });
  sleep(1);

  // ── 4. /plan ──────────────────────────────────────────────────────────────
  const planRes = http.get(`${BASE_URL}/plan`);
  check(planRes, {
    '/plan: status is 200':     (r) => r.status === 200,
    '/plan: body is not empty': (r) => r.body && r.body.length > 0,
  });
  sleep(1);

  // ── 5. /profile ───────────────────────────────────────────────────────────
  const profileRes = http.get(`${BASE_URL}/profile`);
  check(profileRes, {
    '/profile: status is 200':     (r) => r.status === 200,
    '/profile: body is not empty': (r) => r.body && r.body.length > 0,
  });
  sleep(1);
}
