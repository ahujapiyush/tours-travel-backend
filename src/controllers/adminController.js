const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// GET /api/admin/customers?search=&page=&limit=
exports.getCustomers = async (req, res, next) => {
  try {
    const { search, city_id, state_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('users')
      .select(
        'users.id', 'users.name', 'users.email', 'users.phone', 'users.role',
        'users.is_active', 'users.created_at', 'users.last_login',
        'cities.name as city_name', 'states.name as state_name'
      )
      .leftJoin('cities', 'users.city_id', 'cities.id')
      .leftJoin('states', 'users.state_id', 'states.id')
      .where('users.role', 'customer');

    if (search) {
      query = query.where(function () {
        this.where('users.name', 'ilike', `%${search}%`)
          .orWhere('users.email', 'ilike', `%${search}%`)
          .orWhere('users.phone', 'ilike', `%${search}%`);
      });
    }
    if (city_id) query = query.where('users.city_id', city_id);
    if (state_id) query = query.where('users.state_id', state_id);

    const countResult = await query.clone().clearSelect().clearOrder().count('users.id as total').first();
    const total = parseInt(countResult.total);

    const customers = await query.orderBy('users.created_at', 'desc').limit(limit).offset(offset);

    // Get booking count for each customer
    for (const customer of customers) {
      const bookingCount = await db('bookings')
        .where({ customer_id: customer.id })
        .count('id as count')
        .first();
      customer.total_bookings = parseInt(bookingCount.count);
    }

    res.json({
      customers,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCustomers,
      totalCars,
      totalBookings,
      todayBookings,
      activeBookings,
      totalRevenue,
      todayRevenue,
      pendingBookings,
    ] = await Promise.all([
      db('users').where({ role: 'customer', is_active: true }).count('id as count').first(),
      db('cars').where({ is_active: true }).count('id as count').first(),
      db('bookings').count('id as count').first(),
      db('bookings').where('created_at', '>=', today).count('id as count').first(),
      db('bookings').whereIn('status', ['confirmed', 'driver_assigned', 'in_progress']).count('id as count').first(),
      db('bookings').where('payment_status', 'paid').sum('total_amount as total').first(),
      db('bookings').where('payment_status', 'paid').where('created_at', '>=', today).sum('total_amount as total').first(),
      db('bookings').where('status', 'pending').count('id as count').first(),
    ]);

    // Recent bookings
    const recentBookings = await db('bookings')
      .select('bookings.*', 'users.name as customer_name', 'cars.name as car_name')
      .leftJoin('users', 'bookings.customer_id', 'users.id')
      .leftJoin('cars', 'bookings.car_id', 'cars.id')
      .orderBy('bookings.created_at', 'desc')
      .limit(10);

    // Booking status breakdown
    const statusBreakdown = await db('bookings')
      .select('status')
      .count('id as count')
      .groupBy('status');

    // Revenue by city
    const revenueByCity = await db('bookings')
      .select('cities.name as city_name')
      .sum('bookings.total_amount as revenue')
      .count('bookings.id as bookings')
      .leftJoin('cities', 'bookings.pickup_city_id', 'cities.id')
      .where('bookings.payment_status', 'paid')
      .groupBy('cities.name')
      .orderBy('revenue', 'desc')
      .limit(10);

    // Cars by status
    const carsByStatus = await db('cars')
      .select('status')
      .count('id as count')
      .where('is_active', true)
      .groupBy('status');

    res.json({
      stats: {
        totalCustomers: parseInt(totalCustomers.count),
        totalCars: parseInt(totalCars.count),
        totalBookings: parseInt(totalBookings.count),
        todayBookings: parseInt(todayBookings.count),
        activeBookings: parseInt(activeBookings.count),
        totalRevenue: parseFloat(totalRevenue.total) || 0,
        todayRevenue: parseFloat(todayRevenue.total) || 0,
        pendingBookings: parseInt(pendingBookings.count),
      },
      recentBookings,
      statusBreakdown,
      revenueByCity,
      carsByStatus,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/reports?from=&to=&group_by=day|week|month
exports.getReports = async (req, res, next) => {
  try {
    const { from_date, to_date, group_by = 'day' } = req.query;

    let dateFormat;
    switch (group_by) {
      case 'week': dateFormat = 'IYYY-IW'; break;
      case 'month': dateFormat = 'YYYY-MM'; break;
      default: dateFormat = 'YYYY-MM-DD';
    }

    let query = db('bookings')
      .select(
        db.raw(`to_char(created_at, '${dateFormat}') as period`),
        db.raw('COUNT(*) as total_bookings'),
        db.raw("SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed"),
        db.raw("SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled"),
        db.raw("SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as revenue")
      )
      .groupByRaw(`to_char(created_at, '${dateFormat}')`)
      .orderByRaw(`to_char(created_at, '${dateFormat}')`);

    if (from_date) query = query.where('created_at', '>=', from_date);
    if (to_date) query = query.where('created_at', '<=', to_date);

    const report = await query;

    // Location-wise booking stats
    const locationStats = await db('bookings')
      .select(
        'cities.name as city_name',
        'states.name as state_name'
      )
      .count('bookings.id as total_bookings')
      .sum('bookings.total_amount as total_revenue')
      .leftJoin('cities', 'bookings.pickup_city_id', 'cities.id')
      .leftJoin('states', 'cities.state_id', 'states.id')
      .groupBy('cities.name', 'states.name')
      .orderBy('total_bookings', 'desc');

    // Top cars
    const topCars = await db('bookings')
      .select('cars.name as car_name', 'cars.brand')
      .count('bookings.id as total_bookings')
      .avg('bookings.customer_rating as avg_rating')
      .leftJoin('cars', 'bookings.car_id', 'cars.id')
      .groupBy('cars.name', 'cars.brand')
      .orderBy('total_bookings', 'desc')
      .limit(10);

    res.json({ report, locationStats, topCars });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/drivers
exports.getDrivers = async (req, res, next) => {
  try {
    const drivers = await db('drivers')
      .select(
        'drivers.*',
        'users.name', 'users.email', 'users.phone',
        'cars.name as car_name', 'cars.registration_number',
        'cities.name as city_name', 'states.name as state_name'
      )
      .leftJoin('users', 'drivers.user_id', 'users.id')
      .leftJoin('cars', 'drivers.assigned_car_id', 'cars.id')
      .leftJoin('cities', 'drivers.city_id', 'cities.id')
      .leftJoin('states', 'drivers.state_id', 'states.id')
      .where('drivers.is_active', true)
      .orderBy('drivers.rating', 'desc');

    res.json({ drivers });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/drivers/:id/assign-car
exports.assignCarToDriver = async (req, res, next) => {
  try {
    const { car_id } = req.body;

    const [driver] = await db('drivers')
      .where({ id: req.params.id })
      .update({ assigned_car_id: car_id, updated_at: db.fn.now() })
      .returning('*');

    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    res.json({ driver });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/drivers — Admin creates a driver (user + driver record)
exports.createDriver = async (req, res, next) => {
  try {
    const {
      name, email, phone, password,
      license_number, license_expiry, experience_years,
      city_id, state_id,
    } = req.body;

    if (!name || !email || !phone || !license_number || !license_expiry) {
      return res.status(400).json({ error: 'Name, email, phone, license number, and license expiry are required' });
    }

    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const existingLicense = await db('drivers').where({ license_number }).first();
    if (existingLicense) {
      return res.status(409).json({ error: 'License number already exists' });
    }

    const hashedPassword = await bcrypt.hash(password || 'Driver@123', 10);

    // Create user with role 'driver'
    const [user] = await db('users')
      .insert({
        name,
        email,
        phone,
        password: hashedPassword,
        role: 'driver',
        city_id: city_id || null,
        state_id: state_id || null,
        is_active: true,
        email_verified: true,
      })
      .returning(['id', 'name', 'email', 'phone', 'role']);

    // Create driver record
    const [driver] = await db('drivers')
      .insert({
        user_id: user.id,
        license_number,
        license_expiry,
        experience_years: experience_years || 0,
        city_id: city_id || null,
        state_id: state_id || null,
        status: 'offline',
        is_active: true,
      })
      .returning('*');

    res.status(201).json({ driver: { ...driver, name: user.name, email: user.email, phone: user.phone } });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/customers — Admin creates a customer
exports.createCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, password, city_id, state_id } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Name, email, and phone are required' });
    }

    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password || 'Welcome@123', 10);

    const [customer] = await db('users')
      .insert({
        name,
        email,
        phone,
        password: hashedPassword,
        role: 'customer',
        city_id: city_id || null,
        state_id: state_id || null,
        is_active: true,
        email_verified: true,
      })
      .returning(['id', 'name', 'email', 'phone', 'role', 'city_id', 'state_id', 'created_at']);

    res.status(201).json({ customer });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/bookings — Admin creates a booking on behalf of a customer
exports.createBookingForCustomer = async (req, res, next) => {
  try {
    const {
      customer_id, car_id, pickup_address, pickup_city_id,
      drop_address, drop_city_id, pickup_time,
      distance_km, notes, payment_method = 'cash',
    } = req.body;

    if (!customer_id || !car_id || !pickup_address || !drop_address || !pickup_time) {
      return res.status(400).json({ error: 'customer_id, car_id, pickup_address, drop_address, and pickup_time are required' });
    }

    // Validate customer
    const customer = await db('users').where({ id: customer_id, role: 'customer', is_active: true }).first();
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Validate car
    const car = await db('cars').where({ id: car_id, status: 'available', is_active: true }).first();
    if (!car) {
      return res.status(400).json({ error: 'Car is not available for booking' });
    }

    // Calculate pricing
    const base_fare = parseFloat(car.base_price);
    const distance_fare = distance_km ? parseFloat(car.price_per_km) * parseFloat(distance_km) : 0;
    const tax = (base_fare + distance_fare) * 0.05;
    const total_amount = Math.max(0, base_fare + distance_fare + tax);

    const booking_number = 'TT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

    const [booking] = await db('bookings')
      .insert({
        booking_number,
        customer_id,
        car_id,
        pickup_address,
        pickup_lat: 0,
        pickup_lng: 0,
        pickup_city_id: pickup_city_id || null,
        drop_address,
        drop_lat: 0,
        drop_lng: 0,
        drop_city_id: drop_city_id || null,
        pickup_time,
        distance_km: distance_km || 0,
        base_fare,
        distance_fare,
        time_fare: 0,
        tax,
        discount: 0,
        total_amount,
        payment_method,
        notes,
        status: 'confirmed',
      })
      .returning('*');

    // Update car status
    await db('cars').where({ id: car_id }).update({ status: 'booked' });

    res.status(201).json({ booking });
  } catch (error) {
    next(error);
  }
};
