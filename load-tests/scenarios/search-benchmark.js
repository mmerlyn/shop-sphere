import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const searchLatency = new Trend('search_latency');
const esSearchLatency = new Trend('es_search_latency');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';

const searchTerms = [
  'laptop', 'phone', 'camera', 'headphones', 'tablet',
  'watch', 'speaker', 'monitor', 'keyboard', 'mouse',
  'wireless', 'bluetooth', 'gaming', 'professional', 'ultra',
  'portable', 'compact', 'premium', 'budget', 'refurbished',
];

const brands = ['Apple', 'Samsung', 'Sony', 'Dell', 'HP', 'Lenovo', 'LG', 'Asus'];

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    search_latency: ['p(95)<50', 'avg<30'],
    es_search_latency: ['p(95)<50', 'avg<30'],
    errors: ['rate<0.01'],
  },
};

export default function () {
  // Text search
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  const textStart = Date.now();
  const textRes = http.get(`${BASE_URL}/api/products?q=${term}&limit=20`);
  const textDuration = Date.now() - textStart;
  searchLatency.add(textDuration);
  esSearchLatency.add(textDuration);
  check(textRes, {
    'text search 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.3);

  // Filtered search
  const brand = brands[Math.floor(Math.random() * brands.length)];
  const filterStart = Date.now();
  const filterRes = http.get(`${BASE_URL}/api/products?brand=${brand}&limit=20`);
  const filterDuration = Date.now() - filterStart;
  searchLatency.add(filterDuration);
  check(filterRes, {
    'filtered search 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.3);

  // Price range search
  const minPrice = Math.floor(Math.random() * 500);
  const maxPrice = minPrice + Math.floor(Math.random() * 1000) + 100;
  const priceStart = Date.now();
  const priceRes = http.get(`${BASE_URL}/api/products?minPrice=${minPrice}&maxPrice=${maxPrice}&limit=20`);
  const priceDuration = Date.now() - priceStart;
  searchLatency.add(priceDuration);
  check(priceRes, {
    'price search 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.3);

  // Combined search
  const combinedStart = Date.now();
  const combinedRes = http.get(
    `${BASE_URL}/api/products?q=${term}&brand=${brand}&minPrice=50&maxPrice=2000&sortBy=price&sortOrder=asc&limit=20`
  );
  const combinedDuration = Date.now() - combinedStart;
  searchLatency.add(combinedDuration);
  check(combinedRes, {
    'combined search 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.5);
}
