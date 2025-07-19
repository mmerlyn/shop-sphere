db = db.getSiblingDB('admin');

db.auth('admin', 'password');

db = db.getSiblingDB('shopsphere_products');

db.createUser({
  user: 'shopsphere_user',
  pwd: 'ShopSphere2024',
  roles: [
    {
      role: 'readWrite',
      db: 'shopsphere_products'
    }
  ]
});

print('User shopsphere_user created successfully!');