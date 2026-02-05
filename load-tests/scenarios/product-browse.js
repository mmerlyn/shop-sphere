import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const productListLatency = new Trend('product_list_latency');
const productDetailLatency = new Trend('product_detail_latency');
const searchLatency = new Trend('search_latency');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'],
    errors: ['rate<0.01'],
    product_list_latency: ['p(95)<100'],
    product_detail_latency: ['p(95)<80'],
    search_latency: ['p(95)<50'],
  },
};

export default function () {
  // Product listing
  const listStart = Date.now();
  const listRes = http.get(`${BASE_URL}/api/products?page=1&limit=20`);
  productListLatency.add(Date.now() - listStart);
  check(listRes, {
    'product list status 200': (r) => r.status === 200,
    'product list has data': (r) => JSON.parse(r.body).data.length > 0,
  }) || errorRate.add(1);

  sleep(0.5);

  // Product search
  const searchTerms = ['laptop', 'phone', 'camera', 'headphones', 'tablet', 'watch', 'speaker', 'monitor'];
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  const searchStart = Date.now();
  const searchRes = http.get(`${BASE_URL}/api/products?q=${term}`);
  searchLatency.add(Date.now() - searchStart);
  check(searchRes, {
    'search status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.5);

  // Product detail (using first product from list)
  try {
    const products = JSON.parse(listRes.body).data;
    if (products.length > 0) {
      const productId = products[Math.floor(Math.random() * products.length)].id;
      const detailStart = Date.now();
      const detailRes = http.get(`${BASE_URL}/api/products/${productId}`);
      productDetailLatency.add(Date.now() - detailStart);
      check(detailRes, {
        'product detail status 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    }
  } catch (e) {
    errorRate.add(1);
  }

  sleep(1);
}
