import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const crudLatency = new Trend('crud_latency');
const readLatency = new Trend('read_latency');
const writeLatency = new Trend('write_latency');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '2m', target: 300 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    crud_latency: ['p(95)<80'],
    read_latency: ['p(95)<50'],
    write_latency: ['p(95)<100'],
    errors: ['rate<0.01'],
  },
};

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: 'admin@example.com',
      password: 'password123',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status === 200) {
    return { token: JSON.parse(loginRes.body).accessToken };
  }
  return { token: '' };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  // READ - Get products (most common operation)
  const readStart = Date.now();
  const readRes = http.get(`${BASE_URL}/api/products?page=${Math.floor(Math.random() * 50) + 1}&limit=20`);
  const readDuration = Date.now() - readStart;
  readLatency.add(readDuration);
  crudLatency.add(readDuration);
  check(readRes, {
    'read status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.5);

  // READ - Get categories
  const catStart = Date.now();
  const catRes = http.get(`${BASE_URL}/api/categories`);
  const catDuration = Date.now() - catStart;
  readLatency.add(catDuration);
  crudLatency.add(catDuration);
  check(catRes, {
    'categories status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.5);

  // READ - Get single product
  try {
    const products = JSON.parse(readRes.body).data;
    if (products.length > 0) {
      const product = products[Math.floor(Math.random() * products.length)];
      const detailStart = Date.now();
      const detailRes = http.get(`${BASE_URL}/api/products/${product.id}`);
      const detailDuration = Date.now() - detailStart;
      readLatency.add(detailDuration);
      crudLatency.add(detailDuration);
      check(detailRes, {
        'product detail status 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    }
  } catch (e) {
    // ignore parse errors
  }

  sleep(0.5);

  // READ - Get user profile
  const profileStart = Date.now();
  const profileRes = http.get(`${BASE_URL}/api/auth/profile`, { headers });
  const profileDuration = Date.now() - profileStart;
  readLatency.add(profileDuration);
  crudLatency.add(profileDuration);

  sleep(0.5);
}
