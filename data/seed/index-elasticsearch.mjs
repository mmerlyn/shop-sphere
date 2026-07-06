// Bulk-index N products into Elasticsearch — the Catalog read model (CQRS).
// Documents mirror the catalog Postgres rows exactly (same 'prod-<n>' ids,
// same name/brand/price vocabulary) so search results line up with the DB.
//
// Usage: ES_URL=http://localhost:9200 node index-elasticsearch.mjs 1000000
const ES_URL = process.env.ES_URL || 'http://localhost:9200';
const INDEX = 'products';
const TOTAL = parseInt(process.argv[2] || process.env.N || '1000000', 10);
const BATCH = parseInt(process.env.BATCH || '5000', 10);

const NOUNS = ['Laptop','Phone','Headphones','Camera','Watch','Shoes','Backpack','Keyboard','Monitor','Chair','Desk','Tablet','Speaker','Drone','Printer','Router','Microphone','Charger','Lamp','Bottle'];
const BRANDS = ['Acme','Globex','Umbrella','Initech','Soylent','Stark','Wayne','Wonka','Hooli','Pied'];

// Same index settings/mappings the product-service uses, created up-front so
// the analyzer is correct even if the seeder runs before the service boots.
const INDEX_BODY = {
  settings: {
    analysis: {
      analyzer: {
        product_analyzer: { type: 'custom', tokenizer: 'standard', filter: ['lowercase', 'asciifolding'] },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      name: { type: 'text', analyzer: 'product_analyzer' },
      description: { type: 'text', analyzer: 'product_analyzer' },
      sku: { type: 'keyword' },
      slug: { type: 'keyword' },
      price: { type: 'float' },
      categoryId: { type: 'keyword' },
      categoryName: { type: 'text' },
      brand: { type: 'keyword' },
      tags: { type: 'keyword' },
      isActive: { type: 'boolean' },
      isFeatured: { type: 'boolean' },
      inventory: { type: 'integer' },
      createdAt: { type: 'date' },
    },
  },
};

async function req(method, path, body, isNdjson = false) {
  const res = await fetch(`${ES_URL}${path}`, {
    method,
    headers: { 'Content-Type': isNdjson ? 'application/x-ndjson' : 'application/json' },
    body: body == null ? undefined : (isNdjson ? body : JSON.stringify(body)),
  });
  return res;
}

async function ensureIndex() {
  const exists = await req('HEAD', `/${INDEX}`);
  if (exists.status === 200) {
    console.log(`index '${INDEX}' already exists — reusing`);
    return;
  }
  const res = await req('PUT', `/${INDEX}`, INDEX_BODY);
  if (!res.ok) throw new Error(`create index failed: ${res.status} ${await res.text()}`);
  console.log(`created index '${INDEX}'`);
}

function buildDoc(n) {
  const noun = NOUNS[n % 20];
  const brand = BRANDS[n % 10];
  const price = Math.round((Math.abs(Math.sin(n)) * 490 + 10) * 100) / 100;
  return {
    id: `prod-${n}`,
    name: `${noun} ${brand} ${n}`,
    description: `High quality ${noun} built for everyday use.`,
    sku: `SKU-${n}`,
    slug: `product-${n}`,
    price,
    categoryId: `cat-${n % 10}`,
    categoryName: `Category ${n % 10}`,
    brand,
    tags: [noun.toLowerCase(), brand.toLowerCase()],
    isActive: true,
    isFeatured: n % 50 === 0,
    inventory: 1000000,
    createdAt: new Date(Date.now() - (n % 1000000) * 1000).toISOString(),
  };
}

async function run() {
  console.log(`Indexing ${TOTAL} docs into ${ES_URL}/${INDEX} (batch ${BATCH})`);
  await ensureIndex();
  // Speed up bulk load: disable refresh while indexing.
  await req('PUT', `/${INDEX}/_settings`, { index: { refresh_interval: '-1' } });

  const t0 = Date.now();
  for (let start = 1; start <= TOTAL; start += BATCH) {
    const end = Math.min(start + BATCH - 1, TOTAL);
    let ndjson = '';
    for (let n = start; n <= end; n++) {
      ndjson += `{"index":{"_id":"prod-${n}"}}\n` + JSON.stringify(buildDoc(n)) + '\n';
    }
    const res = await req('POST', `/${INDEX}/_bulk`, ndjson, true);
    if (!res.ok) throw new Error(`bulk failed at ${start}: ${res.status} ${await res.text()}`);
    const body = await res.json();
    if (body.errors) {
      const firstErr = body.items.find((i) => i.index && i.index.error);
      throw new Error(`bulk had errors: ${JSON.stringify(firstErr)}`);
    }
    if (end % 100000 === 0 || end === TOTAL) {
      const rate = Math.round(end / ((Date.now() - t0) / 1000));
      console.log(`  ${end}/${TOTAL} indexed (${rate}/s)`);
    }
  }

  // Restore refresh + force a refresh so docs are searchable immediately.
  await req('PUT', `/${INDEX}/_settings`, { index: { refresh_interval: '1s' } });
  await req('POST', `/${INDEX}/_refresh`);
  const count = await (await req('GET', `/${INDEX}/_count`)).json();
  console.log(`DONE. ${INDEX} now holds ${count.count} docs in ${Math.round((Date.now() - t0) / 1000)}s`);
}

run().catch((e) => { console.error(e); process.exit(1); });
