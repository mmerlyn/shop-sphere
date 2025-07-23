CREATE DATABASE IF NOT EXISTS shopsphere_users;
CREATE DATABASE IF NOT EXISTS shopsphere_cart;
CREATE DATABASE IF NOT EXISTS shopsphere_orders;
CREATE DATABASE IF NOT EXISTS shopsphere_payments;

CREATE USER IF NOT EXISTS cart_user WITH PASSWORD 'cart_password';
GRANT ALL PRIVILEGES ON DATABASE shopsphere_cart TO cart_user;
 
CREATE USER IF NOT EXISTS order_user WITH PASSWORD 'order_password';
GRANT ALL PRIVILEGES ON DATABASE shopsphere_orders TO order_user;

CREATE USER IF NOT EXISTS payment_user WITH PASSWORD 'payment_password';
GRANT ALL PRIVILEGES ON DATABASE shopsphere_payments TO payment_user;

GRANT ALL PRIVILEGES ON DATABASE shopsphere_users TO postgres;
GRANT ALL PRIVILEGES ON DATABASE shopsphere_cart TO postgres;
GRANT ALL PRIVILEGES ON DATABASE shopsphere_orders TO postgres;
GRANT ALL PRIVILEGES ON DATABASE shopsphere_payments TO postgres;