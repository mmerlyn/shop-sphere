import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const orderCreateLatency = new Trend('order_create_latency');
const orderListLatency = new Trend('order_list_latency');
const transactionRate = new Rate('transaction_success');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';

export const options = {
  scenarios: {
    transactions: {
      executor: 'constant-arrival-rate',
      rate: 2000,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 500,
      maxVUs: 2000,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<100'],
    errors: ['rate<0.05'],
    order_create_latency: ['p(95)<100'],
    transaction_success: ['rate>0.95'],
  },
};

// Setup: login to get auth token
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: 'test@example.com',
      password: 'password123',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return { token: body.accessToken };
  }
  return { token: '' };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  // List orders
  const listStart = Date.now();
  const listRes = http.get(`${BASE_URL}/api/orders?page=1&limit=10`, { headers });
  orderListLatency.add(Date.now() - listStart);

  const listSuccess = check(listRes, {
    'order list status 200': (r) => r.status === 200,
  });
  if (!listSuccess) errorRate.add(1);
  transactionRate.add(listSuccess ? 1 : 0);

  sleep(0.1);

  // Browse products
  const productsRes = http.get(`${BASE_URL}/api/products?page=1&limit=10`);
  check(productsRes, {
    'products status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.1);
}
