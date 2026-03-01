const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  // Clean all tables in reverse dependency order
  await knex('support_tickets').del();
  await knex('payments').del();
  await knex('favorites').del();
  await knex('coupons').del();
  await knex('pricing_rules').del();
  await knex('reviews').del();
  await knex('notifications').del();
  await knex('booking_tracking').del();
  await knex('bookings').del();
  await knex('drivers').del();
  await knex('cars').del();
  await knex('car_categories').del();
  await knex('users').del();
  await knex('cities').del();
  await knex('states').del();

  // ── States ──
  const [maharashtra, karnataka, delhi, tamilnadu, rajasthan, goa, kerala] = await knex('states')
    .insert([
      { name: 'Maharashtra', code: 'MH' },
      { name: 'Karnataka', code: 'KA' },
      { name: 'Delhi', code: 'DL' },
      { name: 'Tamil Nadu', code: 'TN' },
      { name: 'Rajasthan', code: 'RJ' },
      { name: 'Goa', code: 'GA' },
      { name: 'Kerala', code: 'KL' },
    ])
    .returning('id');

  // ── Cities ──
  const cities = await knex('cities')
    .insert([
      { name: 'Mumbai', state_id: maharashtra.id, latitude: 19.076, longitude: 72.8777 },
      { name: 'Pune', state_id: maharashtra.id, latitude: 18.5204, longitude: 73.8567 },
      { name: 'Nagpur', state_id: maharashtra.id, latitude: 21.1458, longitude: 79.0882 },
      { name: 'Bangalore', state_id: karnataka.id, latitude: 12.9716, longitude: 77.5946 },
      { name: 'Mysore', state_id: karnataka.id, latitude: 12.2958, longitude: 76.6394 },
      { name: 'New Delhi', state_id: delhi.id, latitude: 28.6139, longitude: 77.209 },
      { name: 'Chennai', state_id: tamilnadu.id, latitude: 13.0827, longitude: 80.2707 },
      { name: 'Jaipur', state_id: rajasthan.id, latitude: 26.9124, longitude: 75.7873 },
      { name: 'Udaipur', state_id: rajasthan.id, latitude: 24.5854, longitude: 73.7125 },
      { name: 'Panaji', state_id: goa.id, latitude: 15.4909, longitude: 73.8278 },
      { name: 'Kochi', state_id: kerala.id, latitude: 9.9312, longitude: 76.2673 },
      { name: 'Thiruvananthapuram', state_id: kerala.id, latitude: 8.5241, longitude: 76.9366 },
    ])
    .returning('*');

  const cityMap = {};
  cities.forEach((c) => (cityMap[c.name] = c));

  // ── Users ──
  const hashedPassword = await bcrypt.hash('password123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);

  const [adminUser] = await knex('users')
    .insert([
      {
        name: 'Admin User',
        email: 'admin@tours.com',
        phone: '+919876543210',
        password: adminPassword,
        role: 'admin',
        city_id: cityMap['Mumbai'].id,
        state_id: maharashtra.id,
        is_active: true,
        email_verified: true,
      },
    ])
    .returning('*');

  const customers = await knex('users')
    .insert([
      {
        name: 'Rahul Sharma',
        email: 'rahul@gmail.com',
        phone: '+919876543211',
        password: hashedPassword,
        role: 'customer',
        city_id: cityMap['Mumbai'].id,
        state_id: maharashtra.id,
        email_verified: true,
      },
      {
        name: 'Priya Patel',
        email: 'priya@example.com',
        phone: '+919876543212',
        password: hashedPassword,
        role: 'customer',
        city_id: cityMap['Bangalore'].id,
        state_id: karnataka.id,
        email_verified: true,
      },
      {
        name: 'Amit Kumar',
        email: 'amit@example.com',
        phone: '+919876543213',
        password: hashedPassword,
        role: 'customer',
        city_id: cityMap['New Delhi'].id,
        state_id: delhi.id,
        email_verified: true,
      },
    ])
    .returning('*');

  const driverUsers = await knex('users')
    .insert([
      {
        name: 'Vijay Singh',
        email: 'vijay.driver@example.com',
        phone: '+919876543220',
        password: hashedPassword,
        role: 'driver',
        city_id: cityMap['Mumbai'].id,
        state_id: maharashtra.id,
        email_verified: true,
      },
      {
        name: 'Raju Yadav',
        email: 'raju.driver@example.com',
        phone: '+919876543221',
        password: hashedPassword,
        role: 'driver',
        city_id: cityMap['Bangalore'].id,
        state_id: karnataka.id,
        email_verified: true,
      },
    ])
    .returning('*');

  // ── Car Categories ──
  const categories = await knex('car_categories')
    .insert([
      { name: 'Hatchback', description: 'Compact cars perfect for city rides' },
      { name: 'Sedan', description: 'Comfortable mid-size cars for all occasions' },
      { name: 'SUV', description: 'Spacious vehicles for family trips and rough terrain' },
      { name: 'Luxury', description: 'Premium cars for a luxurious experience' },
      { name: 'Minivan', description: 'Large vehicles perfect for group travel' },
      { name: 'Tempo Traveller', description: 'For large groups and tour packages' },
    ])
    .returning('*');

  const catMap = {};
  categories.forEach((c) => (catMap[c.name] = c));

  // ── Cars ──
  await knex('cars').insert([
    {
      name: 'Swift',
      brand: 'Maruti Suzuki',
      model: 'Swift VXi',
      year: 2024,
      color: 'White',
      registration_number: 'MH01AB1234',
      seats: 5,
      fuel_type: 'petrol',
      transmission: 'manual',
      mileage: 22.0,
      ac: true,
      features: JSON.stringify(['Bluetooth', 'Power Windows', 'ABS', 'Airbags']),
      category_id: catMap['Hatchback'].id,
      city_id: cityMap['Mumbai'].id,
      state_id: maharashtra.id,
      price_per_km: 12,
      price_per_hour: 150,
      base_price: 500,
      status: 'available',
      current_lat: 19.076,
      current_lng: 72.8777,
      rating: 4.2,
    },
    {
      name: 'City',
      brand: 'Honda',
      model: 'City ZX',
      year: 2024,
      color: 'Silver',
      registration_number: 'MH01CD5678',
      seats: 5,
      fuel_type: 'petrol',
      transmission: 'automatic',
      mileage: 18.0,
      ac: true,
      features: JSON.stringify(['Sunroof', 'Leather Seats', 'Cruise Control', 'Reverse Camera']),
      category_id: catMap['Sedan'].id,
      city_id: cityMap['Mumbai'].id,
      state_id: maharashtra.id,
      price_per_km: 16,
      price_per_hour: 250,
      base_price: 800,
      status: 'available',
      current_lat: 19.082,
      current_lng: 72.881,
      rating: 4.5,
    },
    {
      name: 'Creta',
      brand: 'Hyundai',
      model: 'Creta SX(O)',
      year: 2025,
      color: 'Black',
      registration_number: 'KA01EF9012',
      seats: 5,
      fuel_type: 'diesel',
      transmission: 'automatic',
      mileage: 17.0,
      ac: true,
      features: JSON.stringify(['Panoramic Sunroof', 'ADAS', 'Wireless Charging', 'Ventilated Seats']),
      category_id: catMap['SUV'].id,
      city_id: cityMap['Bangalore'].id,
      state_id: karnataka.id,
      price_per_km: 18,
      price_per_hour: 300,
      base_price: 1000,
      status: 'available',
      current_lat: 12.9716,
      current_lng: 77.5946,
      rating: 4.7,
    },
    {
      name: 'Fortuner',
      brand: 'Toyota',
      model: 'Fortuner Legender',
      year: 2025,
      color: 'Pearl White',
      registration_number: 'DL01GH3456',
      seats: 7,
      fuel_type: 'diesel',
      transmission: 'automatic',
      mileage: 14.0,
      ac: true,
      features: JSON.stringify(['4x4', 'JBL Audio', 'Leader Seats', '360 Camera', 'TPMS']),
      category_id: catMap['SUV'].id,
      city_id: cityMap['New Delhi'].id,
      state_id: delhi.id,
      price_per_km: 25,
      price_per_hour: 500,
      base_price: 1500,
      status: 'available',
      current_lat: 28.6139,
      current_lng: 77.209,
      rating: 4.8,
    },
    {
      name: 'Mercedes E-Class',
      brand: 'Mercedes-Benz',
      model: 'E 200',
      year: 2025,
      color: 'Obsidian Black',
      registration_number: 'MH01LX7890',
      seats: 5,
      fuel_type: 'petrol',
      transmission: 'automatic',
      mileage: 12.0,
      ac: true,
      features: JSON.stringify(['MBUX', 'Ambient Lighting', 'Air Suspension', 'Burmester Audio']),
      category_id: catMap['Luxury'].id,
      city_id: cityMap['Mumbai'].id,
      state_id: maharashtra.id,
      price_per_km: 40,
      price_per_hour: 800,
      base_price: 2500,
      status: 'available',
      current_lat: 19.06,
      current_lng: 72.87,
      rating: 4.9,
    },
    {
      name: 'Innova Crysta',
      brand: 'Toyota',
      model: 'Innova Crysta GX',
      year: 2024,
      color: 'Grey',
      registration_number: 'RJ01MN2345',
      seats: 7,
      fuel_type: 'diesel',
      transmission: 'manual',
      mileage: 15.0,
      ac: true,
      features: JSON.stringify(['Captain Seats', 'Touchscreen', 'Rear AC', 'Cruise Control']),
      category_id: catMap['Minivan'].id,
      city_id: cityMap['Jaipur'].id,
      state_id: rajasthan.id,
      price_per_km: 16,
      price_per_hour: 280,
      base_price: 900,
      status: 'available',
      current_lat: 26.9124,
      current_lng: 75.7873,
      rating: 4.4,
    },
    {
      name: 'Tempo Traveller 12-Seater',
      brand: 'Force',
      model: 'Traveller 3700',
      year: 2023,
      color: 'White',
      registration_number: 'GA01TT6789',
      seats: 12,
      fuel_type: 'diesel',
      transmission: 'manual',
      mileage: 10.0,
      ac: true,
      features: JSON.stringify(['Push-back Seats', 'LCD TV', 'Music System', 'Curtains', 'Large Luggage']),
      category_id: catMap['Tempo Traveller'].id,
      city_id: cityMap['Panaji'].id,
      state_id: goa.id,
      price_per_km: 22,
      price_per_hour: 400,
      base_price: 2000,
      status: 'available',
      current_lat: 15.4909,
      current_lng: 73.8278,
      rating: 4.1,
    },
    {
      name: 'Baleno',
      brand: 'Maruti Suzuki',
      model: 'Baleno Alpha',
      year: 2024,
      color: 'Blue',
      registration_number: 'TN01PQ4567',
      seats: 5,
      fuel_type: 'petrol',
      transmission: 'automatic',
      mileage: 22.5,
      ac: true,
      features: JSON.stringify(['Head-up Display', '360 View Camera', 'Smart Hybrid', 'LED DRLs']),
      category_id: catMap['Hatchback'].id,
      city_id: cityMap['Chennai'].id,
      state_id: tamilnadu.id,
      price_per_km: 11,
      price_per_hour: 140,
      base_price: 450,
      status: 'available',
      current_lat: 13.0827,
      current_lng: 80.2707,
      rating: 4.3,
    },
  ]);

  // ── Drivers ──
  await knex('drivers').insert([
    {
      user_id: driverUsers[0].id,
      license_number: 'MH0120230001234',
      license_expiry: '2028-06-15',
      experience_years: 8,
      rating: 4.6,
      status: 'available',
      current_lat: 19.076,
      current_lng: 72.8777,
      city_id: cityMap['Mumbai'].id,
      state_id: maharashtra.id,
    },
    {
      user_id: driverUsers[1].id,
      license_number: 'KA0120240005678',
      license_expiry: '2029-03-20',
      experience_years: 5,
      rating: 4.4,
      status: 'available',
      current_lat: 12.9716,
      current_lng: 77.5946,
      city_id: cityMap['Bangalore'].id,
      state_id: karnataka.id,
    },
  ]);

  // ── Coupons ──
  await knex('coupons').insert([
    {
      code: 'WELCOME50',
      description: 'Get 50% off on your first ride',
      discount_type: 'percentage',
      discount_value: 50,
      max_discount: 200,
      min_order_value: 300,
      usage_limit: 1000,
      valid_from: '2026-01-01',
      valid_until: '2026-12-31',
    },
    {
      code: 'FLAT100',
      description: 'Flat ₹100 off on rides above ₹500',
      discount_type: 'flat',
      discount_value: 100,
      min_order_value: 500,
      usage_limit: 5000,
      valid_from: '2026-01-01',
      valid_until: '2026-06-30',
    },
  ]);

  console.log('✅ Seed data inserted successfully!');
};
