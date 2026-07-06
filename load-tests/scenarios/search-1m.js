// Resume claim: "Elasticsearch-backed catalog search ... <50ms p95 across 1M+ products"
// Measured at a FIXED arrival rate (req/s) so the p95 is reported at a known
// throughput rather than at the saturation knee. Tune RATE to the level the
// cluster sustains under 50ms; report that rate alongside the latency.
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errors = new Rate('errors');
const searchLatency = new Trend('search_latency', true);

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const RATE = parseInt(__ENV.RATE || '300', 10);
const DURATION = __ENV.DURATION || '1m';

const TERMS = ['laptop','phone','headphones','camera','watch','shoes','backpack',
  'keyboard','monitor','chair','desk','tablet','speaker','drone','printer',
  'router','microphone','charger','lamp','bottle'];
const BRANDS = ['acme','globex','umbrella','initech','soylent','stark','wayne','wonka','hooli','pied'];

export const options = {
  scenarios: {
    search: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.max(50, Math.ceil(RATE / 4)),
      maxVUs: RATE * 4,
    },
  },
  thresholds: {
    'http_req_duration{kind:search}': ['p(95)<50'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  const term = TERMS[Math.floor(Math.random() * TERMS.length)];
  const brand = BRANDS[Math.floor(Math.random() * BRANDS.length)];
  const url = `${BASE_URL}/api/products?q=${term}&brand=${brand}&page=1&limit=20`;
  const res = http.get(url, { tags: { kind: 'search' } });
  searchLatency.add(res.timings.duration);
  if (!check(res, { 'search 200': (r) => r.status === 200 })) errors.add(1);
}
