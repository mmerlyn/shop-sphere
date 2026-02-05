import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const successfulRequests = new Counter('successful_requests');
const productListLatency = new Trend('product_list_latency');
const searchLatency = new Trend('search_latency');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';

export const options = {
  scenarios: {
    // Sustained load test - measures actual throughput
    sustained_load: {
      executor: 'constant-arrival-rate',
      rate: 2000,             // 2000 requests per second
      timeUnit: '1s',
      duration: '1m',         // Run for 1 minute
      preAllocatedVUs: 100,
      maxVUs: 300,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200', 'avg<100'],  // 95th percentile < 200ms, avg < 100ms
    errors: ['rate<0.05'],                        // Less than 5% errors
    successful_requests: ['count>25000'],         // At least 25,000 successful requests
  },
};

export default function () {
  const operations = ['list', 'search', 'list', 'search', 'list']; // 60% list, 40% search
  const operation = operations[Math.floor(Math.random() * operations.length)];

  if (operation === 'list') {
    // Product listing - most common operation
    const page = Math.floor(Math.random() * 5) + 1;
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/products?page=${page}&limit=20`);
    productListLatency.add(Date.now() - start);

    const success = check(res, {
      'status 200': (r) => r.status === 200,
    });

    if (success) {
      successfulRequests.add(1);
    } else {
      errorRate.add(1);
    }
  } else {
    // Search operation
    const terms = ['wireless', 'bluetooth', 'cotton', 'premium', 'pro'];
    const term = terms[Math.floor(Math.random() * terms.length)];
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/products?q=${term}`);
    searchLatency.add(Date.now() - start);

    const success = check(res, {
      'search status 200': (r) => r.status === 200,
    });

    if (success) {
      successfulRequests.add(1);
    } else {
      errorRate.add(1);
    }
  }
}

export function handleSummary(data) {
  const duration = data.metrics.iteration_duration?.values?.avg || 0;
  const totalRequests = data.metrics.http_reqs?.values?.count || 0;
  const successCount = data.metrics.successful_requests?.values?.count || 0;
  const avgLatency = data.metrics.http_req_duration?.values?.avg || 0;
  const p95Latency = data.metrics.http_req_duration?.values['p(95)'] || 0;
  const errorRateVal = data.metrics.errors?.values?.rate || 0;

  const throughput = totalRequests / 60; // requests per second over 1 minute

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SHOPSPHERE LOAD TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total Requests:        ${totalRequests.toLocaleString()}`);
  console.log(`  Successful Requests:   ${successCount.toLocaleString()}`);
  console.log(`  Throughput:            ${throughput.toFixed(0)} req/sec`);
  console.log(`  Average Latency:       ${avgLatency.toFixed(2)} ms`);
  console.log(`  95th Percentile:       ${p95Latency.toFixed(2)} ms`);
  console.log(`  Error Rate:            ${(errorRateVal * 100).toFixed(2)}%`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n');

  return {
    stdout: JSON.stringify({
      throughput: throughput.toFixed(0),
      avgLatency: avgLatency.toFixed(2),
      p95Latency: p95Latency.toFixed(2),
      errorRate: (errorRateVal * 100).toFixed(2),
      totalRequests,
      successCount,
    }, null, 2),
  };
}
