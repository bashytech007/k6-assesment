# Ternny K6 Performance Tests

QualityTechies 5-Day K6 Challenge — Complete Assessment Submission

Performance and load testing suite for the [Ternny Travel App](https://ternny.com) covering all five endpoints across four load profiles.

---

## Scripts

| File | Task | Purpose |
|------|------|---------|
| `task1-smoke-test.js` | Task 1 | Smoke test — 1 VU, 30s, all 5 endpoints |
| `task2-thresholds.js` | Task 2 | Threshold-driven test — 10 VUs, 1m, 3+ checks per endpoint |
| `task3-stages.js` | Task 3 | Ramp-up / ramp-down load test + bonus spike test |
| `task4-user-journeys.js` | Task 4 | User journeys, groups, traffic distribution, handleSummary |
| `ternny-performance.js` | Task 5 | **Complete production script** — all concepts combined |

---

## Running the Tests

### Prerequisites

```bash
# Install K6 (macOS)
brew install k6

# Install K6 (Linux)
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

### Task 1 — Smoke Test
```bash
k6 run --env BASE_URL=https://ternny.com task1-smoke-test.js
```

### Task 2 — Thresholds & Checks
```bash
k6 run --env BASE_URL=https://ternny.com task2-thresholds.js
```

### Task 3 — Load Test (Ramp-Up / Ramp-Down)
```bash
# Load test (default)
k6 run --env BASE_URL=https://ternny.com task3-stages.js

# Bonus: Spike test
k6 run --env BASE_URL=https://ternny.com --env TEST_TYPE=spike task3-stages.js
```

### Task 4 — User Journeys & Traffic Distribution
```bash
k6 run --env BASE_URL=https://ternny.com task4-user-journeys.js
# Generates: HTMLReport1.html
```

### Task 5 — Complete Production Script (all profiles)
```bash
# Load test (default)
k6 run --env BASE_URL=https://ternny.com ternny-performance.js

# Smoke test
k6 run --env BASE_URL=https://ternny.com --env PROFILE=smoke ternny-performance.js

# Stress test
k6 run --env BASE_URL=https://ternny.com --env PROFILE=stress ternny-performance.js

# Spike test
k6 run --env BASE_URL=https://ternny.com --env PROFILE=spike ternny-performance.js
```

All runs generate `HTMLReport1.html` in the working directory.

---

## SLA Targets

| Endpoint | p(95) Target | Max Error Rate |
|----------|-------------|----------------|
| `/auth` | < 500ms | < 1% |
| `/add-trip` | < 700ms | < 0.5% |
| `/travel-persona` | < 500ms | < 1% |
| `/plan` | < 600ms | < 1% |
| `/profile` | < 450ms | < 1% |

## Traffic Distribution

| Endpoint | Weight |
|----------|--------|
| `/auth` | 15% |
| `/plan` | 35% |
| `/add-trip` | 20% |
| `/travel-persona` | 15% |
| `/profile` | 15% |

---

## Architecture

The complete script (`ternny-performance.js`) supports four profiles controlled by the `PROFILE` environment variable:

- **smoke** — 1 VU, 30s — basic validation
- **load** — ramp 0→10→50→0 — SLA validation at expected traffic
- **stress** — ramp 0→50→100→200→0 — finds the breaking point
- **spike** — 5→150→5 VUs — simulates viral burst traffic

---

## Report

The `HTMLReport1.html` file is generated automatically at the end of each test run. Open it in any browser to view endpoint SLA results, traffic distribution, and threshold pass/fail summary.

---
## Actual Test Results

Tests were executed from Lagos, Nigeria. Network latency between 
the test machine and ternny.com servers added approximately 600–900ms 
baseline latency, which caused p(95) SLA thresholds to be exceeded. 
All endpoints returned HTTP 200 with 0% application error rate.

| Metric | Result |
|--------|--------|
| Total requests (load test) | 5,197 |
| HTTP error rate | 0.05% |
| p(95) response time | 1.71s |
| Peak VUs reached | 50 |
| Checks passed | 80.55% |

> Note: SLA threshold breaches are attributable to geographic network 
> latency from the test location, not application-level failures. 
> All HTTP requests returned valid responses.
## About

Built as part of the [QualityTechies](https://qualitytechies.com) 5-Day K6 Performance Testing Challenge.

`#K6 #PerformanceTesting #QualityTechies #5DayChallenge`
