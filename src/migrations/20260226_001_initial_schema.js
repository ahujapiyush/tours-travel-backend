/**
 * Tours & Travel - Database Schema
 * Full migration with all tables
 */
exports.up = async function (knex) {
  // ── States ──
  await knex.schema.createTable('states', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable().unique();
    t.string('code', 10).notNullable().unique();
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // ── Cities ──
  await knex.schema.createTable('cities', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable();
    t.integer('state_id').unsigned().references('id').inTable('states').onDelete('CASCADE');
    t.decimal('latitude', 10, 7);
    t.decimal('longitude', 10, 7);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
    t.unique(['name', 'state_id']);
  });

  // ── Users ──
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 100).notNullable();
    t.string('email', 255).notNullable().unique();
    t.string('phone', 20);
    t.string('password', 255).notNullable();
    t.enum('role', ['admin', 'customer', 'driver']).defaultTo('customer');
    t.string('avatar_url', 500);
    t.text('address');
    t.integer('city_id').unsigned().references('id').inTable('cities');
    t.integer('state_id').unsigned().references('id').inTable('states');
    t.string('push_token', 255);
    t.boolean('is_active').defaultTo(true);
    t.boolean('email_verified').defaultTo(false);
    t.timestamp('last_login');
    t.timestamps(true, true);
  });

  // ── Car Categories ──
  await knex.schema.createTable('car_categories', (t) => {
    t.increments('id').primary();
    t.string('name', 50).notNullable().unique(); // sedan, SUV, hatchback, luxury, minivan
    t.text('description');
    t.string('icon_url', 500);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // ── Cars ──
  await knex.schema.createTable('cars', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable();
    t.string('brand', 50).notNullable();
    t.string('model', 50).notNullable();
    t.integer('year').notNullable();
    t.string('color', 30).notNullable();
    t.string('registration_number', 20).notNullable().unique();
    t.integer('seats').notNullable().defaultTo(4);
    t.enum('fuel_type', ['petrol', 'diesel', 'electric', 'hybrid', 'cng']).defaultTo('petrol');
    t.enum('transmission', ['manual', 'automatic']).defaultTo('manual');
    t.decimal('mileage', 5, 1); // km/l
    t.boolean('ac').defaultTo(true);
    t.text('features'); // JSON string of features
    t.string('image_url', 500);
    t.text('images'); // JSON array of image URLs
    t.integer('category_id').unsigned().references('id').inTable('car_categories');
    t.integer('city_id').unsigned().references('id').inTable('cities');
    t.integer('state_id').unsigned().references('id').inTable('states');
    t.decimal('price_per_km', 10, 2).notNullable();
    t.decimal('price_per_hour', 10, 2);
    t.decimal('base_price', 10, 2).notNullable(); // Minimum fare
    t.enum('status', ['available', 'booked', 'maintenance', 'inactive']).defaultTo('available');
    t.decimal('current_lat', 10, 7);
    t.decimal('current_lng', 10, 7);
    t.float('rating').defaultTo(0);
    t.integer('total_trips').defaultTo(0);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // ── Drivers ──
  await knex.schema.createTable('drivers', (t) => {
    t.increments('id').primary();
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.string('license_number', 50).notNullable().unique();
    t.date('license_expiry').notNullable();
    t.integer('experience_years').defaultTo(0);
    t.float('rating').defaultTo(0);
    t.integer('total_trips').defaultTo(0);
    t.enum('status', ['available', 'on_trip', 'offline']).defaultTo('offline');
    t.decimal('current_lat', 10, 7);
    t.decimal('current_lng', 10, 7);
    t.integer('assigned_car_id').unsigned().references('id').inTable('cars');
    t.integer('city_id').unsigned().references('id').inTable('cities');
    t.integer('state_id').unsigned().references('id').inTable('states');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // ── Bookings ──
  await knex.schema.createTable('bookings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('booking_number', 20).notNullable().unique();
    t.uuid('customer_id').references('id').inTable('users').onDelete('SET NULL');
    t.integer('car_id').unsigned().references('id').inTable('cars');
    t.integer('driver_id').unsigned().references('id').inTable('drivers');

    // Pickup
    t.text('pickup_address').notNullable();
    t.decimal('pickup_lat', 10, 7).notNullable();
    t.decimal('pickup_lng', 10, 7).notNullable();
    t.integer('pickup_city_id').unsigned().references('id').inTable('cities');

    // Drop
    t.text('drop_address').notNullable();
    t.decimal('drop_lat', 10, 7).notNullable();
    t.decimal('drop_lng', 10, 7).notNullable();
    t.integer('drop_city_id').unsigned().references('id').inTable('cities');

    // Time
    t.timestamp('pickup_time').notNullable();
    t.timestamp('drop_time');
    t.timestamp('actual_pickup_time');
    t.timestamp('actual_drop_time');

    // Trip
    t.decimal('distance_km', 10, 2);
    t.integer('estimated_duration_minutes');
    t.integer('actual_duration_minutes');

    // Pricing
    t.decimal('base_fare', 10, 2).notNullable();
    t.decimal('distance_fare', 10, 2);
    t.decimal('time_fare', 10, 2);
    t.decimal('tax', 10, 2);
    t.decimal('discount', 10, 2).defaultTo(0);
    t.decimal('total_amount', 10, 2).notNullable();

    // Status
    t.enum('status', [
      'pending', 'confirmed', 'driver_assigned', 'driver_en_route',
      'arrived', 'in_progress', 'completed', 'cancelled', 'refunded'
    ]).defaultTo('pending');
    t.text('cancellation_reason');
    t.enum('payment_status', ['pending', 'paid', 'refunded', 'failed']).defaultTo('pending');
    t.enum('payment_method', ['cash', 'card', 'upi', 'wallet']).defaultTo('cash');

    t.text('notes');
    t.float('customer_rating');
    t.text('customer_review');
    t.float('driver_rating');

    t.timestamps(true, true);
  });

  // ── Booking Tracking (location history during trip) ──
  await knex.schema.createTable('booking_tracking', (t) => {
    t.increments('id').primary();
    t.uuid('booking_id').references('id').inTable('bookings').onDelete('CASCADE');
    t.decimal('latitude', 10, 7).notNullable();
    t.decimal('longitude', 10, 7).notNullable();
    t.float('speed');
    t.float('heading');
    t.timestamp('recorded_at').defaultTo(knex.fn.now());
  });

  // ── Notifications ──
  await knex.schema.createTable('notifications', (t) => {
    t.increments('id').primary();
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.string('title', 200).notNullable();
    t.text('body').notNullable();
    t.string('type', 50); // booking, promotion, system, alert
    t.jsonb('data'); // additional data
    t.boolean('is_read').defaultTo(false);
    t.timestamps(true, true);
  });

  // ── Reviews ──
  await knex.schema.createTable('reviews', (t) => {
    t.increments('id').primary();
    t.uuid('booking_id').references('id').inTable('bookings').onDelete('CASCADE');
    t.uuid('customer_id').references('id').inTable('users').onDelete('CASCADE');
    t.integer('car_id').unsigned().references('id').inTable('cars');
    t.integer('driver_id').unsigned().references('id').inTable('drivers');
    t.float('rating').notNullable();
    t.text('comment');
    t.timestamps(true, true);
  });

  // ── Pricing Rules ──
  await knex.schema.createTable('pricing_rules', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable();
    t.integer('category_id').unsigned().references('id').inTable('car_categories');
    t.integer('city_id').unsigned().references('id').inTable('cities');
    t.decimal('base_price', 10, 2);
    t.decimal('price_per_km', 10, 2);
    t.decimal('price_per_hour', 10, 2);
    t.decimal('surge_multiplier', 4, 2).defaultTo(1.0);
    t.decimal('night_charge_multiplier', 4, 2).defaultTo(1.0);
    t.time('night_start').defaultTo('22:00');
    t.time('night_end').defaultTo('06:00');
    t.decimal('min_fare', 10, 2);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // ── Coupons ──
  await knex.schema.createTable('coupons', (t) => {
    t.increments('id').primary();
    t.string('code', 20).notNullable().unique();
    t.text('description');
    t.enum('discount_type', ['percentage', 'flat']).defaultTo('percentage');
    t.decimal('discount_value', 10, 2).notNullable();
    t.decimal('max_discount', 10, 2);
    t.decimal('min_order_value', 10, 2).defaultTo(0);
    t.integer('usage_limit');
    t.integer('used_count').defaultTo(0);
    t.date('valid_from');
    t.date('valid_until');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // ── Favorites ──
  await knex.schema.createTable('favorites', (t) => {
    t.increments('id').primary();
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.integer('car_id').unsigned().references('id').inTable('cars').onDelete('CASCADE');
    t.timestamps(true, true);
    t.unique(['user_id', 'car_id']);
  });

  // ── Payments ──
  await knex.schema.createTable('payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('booking_id').references('id').inTable('bookings').onDelete('CASCADE');
    t.uuid('user_id').references('id').inTable('users');
    t.decimal('amount', 10, 2).notNullable();
    t.enum('method', ['cash', 'card', 'upi', 'wallet']).defaultTo('cash');
    t.enum('status', ['pending', 'completed', 'failed', 'refunded']).defaultTo('pending');
    t.string('transaction_id', 100);
    t.jsonb('gateway_response');
    t.timestamps(true, true);
  });

  // ── Support Tickets ──
  await knex.schema.createTable('support_tickets', (t) => {
    t.increments('id').primary();
    t.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.uuid('booking_id').references('id').inTable('bookings');
    t.string('subject', 200).notNullable();
    t.text('description').notNullable();
    t.enum('status', ['open', 'in_progress', 'resolved', 'closed']).defaultTo('open');
    t.enum('priority', ['low', 'medium', 'high', 'urgent']).defaultTo('medium');
    t.timestamps(true, true);
  });

  // ── Indexes for performance ──
  await knex.schema.raw('CREATE INDEX idx_cars_city ON cars(city_id)');
  await knex.schema.raw('CREATE INDEX idx_cars_state ON cars(state_id)');
  await knex.schema.raw('CREATE INDEX idx_cars_status ON cars(status)');
  await knex.schema.raw('CREATE INDEX idx_bookings_customer ON bookings(customer_id)');
  await knex.schema.raw('CREATE INDEX idx_bookings_status ON bookings(status)');
  await knex.schema.raw('CREATE INDEX idx_bookings_date ON bookings(pickup_time)');
  await knex.schema.raw('CREATE INDEX idx_notifications_user ON notifications(user_id, is_read)');
  await knex.schema.raw('CREATE INDEX idx_tracking_booking ON booking_tracking(booking_id, recorded_at)');
};

exports.down = async function (knex) {
  const tables = [
    'support_tickets', 'payments', 'favorites', 'coupons', 'pricing_rules',
    'reviews', 'notifications', 'booking_tracking', 'bookings', 'drivers',
    'cars', 'car_categories', 'users', 'cities', 'states',
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
};
