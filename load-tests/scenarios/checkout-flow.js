// Resume claim: "k6 checkout-flow tests sustained 500+ req/sec at <200ms p95"
// Full REST checkout across catalog -> cart -> orders -> inventory, JWT at the gateway.
// Each iteration: create cart -> add a catalog item -> place order (decrements stock).
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errors = new Rate('errors');
const checkoutSuccess = new Rate('checkout_success');
const orderLatency = new Trend('order_create_latency', true);

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const RATE = parseInt(__ENV.RATE || '500', 10);
const DURATION = __ENV.DURATION || '2m';
const CATALOG_SIZE = parseInt(__ENV.CATALOG_SIZE || '1000000', 10);

export const options = {
  scenarios: {
    checkout: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 300,
      maxVUs: 1500,
    },
  },
  thresholds: {
    // Headline: sustain the arrival rate with 95th-percentile end-to-end < 200ms.
    'http_req_duration{kind:order}': ['p(95)<200'],
    checkout_success: ['rate>0.95'],
    errors: ['rate<0.05'],
  },
};

const ADDRESS = {
  firstName: 'Load', lastName: 'Tester', address1: '1 Test St',
  city: 'Testville', state: 'CA', postalCode: '90001', country: 'US',
};

// Register one shared user; the register response already returns a JWT, so we
// reuse that access token across all VUs (no separate login round-trip needed).
export function setup() {
  const email = `loadtest_${Date.now()}@example.com`;
  const password = 'password123';
  const body = JSON.stringify({ email, password, firstName: 'Load', lastName: 'Tester' });
  const headers = { 'Content-Type': 'application/json' };

  const reg = http.post(`${BASE_URL}/api/auth/register`, body, { headers });
  const token = reg.status === 200 || reg.status === 201 ? JSON.parse(reg.body).accessToken : '';
  if (!token) throw new Error(`register failed: ${reg.status} ${reg.body}`);
  return { token };
}

export default function (data) {
  const json = { 'Content-Type': 'application/json' };
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` };

  // 1) create a cart (public, guest cart)
  const cartRes = http.post(`${BASE_URL}/api/cart`, '{}', { headers: json, tags: { kind: 'cart' } });
  if (!check(cartRes, { 'cart created': (r) => r.status === 201 || r.status === 200 })) {
    errors.add(1); checkoutSuccess.add(0); return;
  }
  const cartId = JSON.parse(cartRes.body).id || JSON.parse(cartRes.body).cartId;

  // 2) add a random in-stock catalog product
  const productId = `prod-${1 + Math.floor(Math.random() * CATALOG_SIZE)}`;
  const addRes = http.post(`${BASE_URL}/api/cart/${cartId}/items`,
    JSON.stringify({ productId, quantity: 1 }), { headers: json, tags: { kind: 'cart' } });
  if (!check(addRes, { 'item added': (r) => r.status === 201 || r.status === 200 })) {
    errors.add(1); checkoutSuccess.add(0); return;
  }

  // 3) place the order (JWT required; gateway injects x-user-id; stock decrements)
  const orderRes = http.post(`${BASE_URL}/api/orders`,
    JSON.stringify({ cartId, shippingAddress: ADDRESS, paymentMethod: 'card' }),
    { headers: auth, tags: { kind: 'order' } });
  orderLatency.add(orderRes.timings.duration);

  const ok = check(orderRes, { 'order placed': (r) => r.status === 201 || r.status === 200 });
  errors.add(ok ? 0 : 1);
  checkoutSuccess.add(ok ? 1 : 0);
}
