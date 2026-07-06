-- Seed the Inventory Postgres with one stock row per product (IDs mirror catalog).
-- High availability so the checkout load test never runs a SKU to zero mid-run.
\set ON_ERROR_STOP on

INSERT INTO inventory_items ("productId", available, reserved, "updatedAt")
SELECT 'prod-' || n, 1000000, 0, now()
FROM generate_series(1, :n) AS n
ON CONFLICT ("productId") DO NOTHING;

SELECT count(*) AS inventory_rows FROM inventory_items;
