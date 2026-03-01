const db = require('../config/database');
const { randomUUID: uuidv4 } = require('crypto');
const notificationService = require('../services/notificationService');

// Generate booking number
const generateBookingNumber = () => {
  const prefix = 'TT';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

// POST /api/bookings
exports.createBooking = async (req, res, next) => {
  try {
    const {
      car_id, pickup_address, pickup_lat, pickup_lng, pickup_city_id,
      drop_address, drop_lat, drop_lng, drop_city_id,
      pickup_time, distance_km, estimated_duration_minutes,
      payment_method = 'cash', coupon_code, notes,
    } = req.body;

    // Validate car availability
    const car = await db('cars').where({ id: car_id, status: 'available', is_active: true }).first();
    if (!car) {
      return res.status(400).json({ error: 'Car is not available for booking' });
    }

    // Calculate pricing
    let base_fare = parseFloat(car.base_price);
    let distance_fare = distance_km ? parseFloat(car.price_per_km) * parseFloat(distance_km) : 0;
    let time_fare = estimated_duration_minutes && car.price_per_hour
      ? (parseFloat(car.price_per_hour) / 60) * parseInt(estimated_duration_minutes)
      : 0;
    let tax = (base_fare + distance_fare + time_fare) * 0.05; // 5% GST
    let discount = 0;

    // Apply coupon if provided
    if (coupon_code) {
      const coupon = await db('coupons')
        .where({ code: coupon_code, is_active: true })
        .where('valid_from', '<=', db.fn.now())
        .where('valid_until', '>=', db.fn.now())
        .first();

      if (coupon && (coupon.usage_limit === null || coupon.used_count < coupon.usage_limit)) {
        const subtotal = base_fare + distance_fare + time_fare;
        if (subtotal >= (coupon.min_order_value || 0)) {
          if (coupon.discount_type === 'percentage') {
            discount = Math.min(subtotal * (coupon.discount_value / 100), coupon.max_discount || Infinity);
          } else {
            discount = coupon.discount_value;
          }
          await db('coupons').where({ id: coupon.id }).increment('used_count', 1);
        }
      }
    }

    const total_amount = Math.max(0, base_fare + distance_fare + time_fare + tax - discount);

    const booking_number = generateBookingNumber();

    const [booking] = await db('bookings')
      .insert({
        booking_number,
        customer_id: req.user.id,
        car_id,
        pickup_address,
        pickup_lat,
        pickup_lng,
        pickup_city_id,
        drop_address,
        drop_lat,
        drop_lng,
        drop_city_id,
        pickup_time,
        distance_km,
        estimated_duration_minutes,
        base_fare,
        distance_fare,
        time_fare,
        tax,
        discount,
        total_amount,
        payment_method,
        notes,
        status: 'pending',
      })
      .returning('*');

    // Update car status
    await db('cars').where({ id: car_id }).update({ status: 'booked' });

    // Create notification for admin
    const admins = await db('users').where({ role: 'admin', is_active: true }).select('id');
    const notifications = admins.map((admin) => ({
      user_id: admin.id,
      title: 'New Booking',
      body: `New booking #${booking_number} received from ${req.user.name}`,
      type: 'booking',
      data: JSON.stringify({ booking_id: booking.id, booking_number }),
    }));
    if (notifications.length) await db('notifications').insert(notifications);

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('new_booking', {
        booking,
        customer_name: req.user.name,
      });
    }

    res.status(201).json({ booking });
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings (Customer: own bookings | Admin: all bookings)
exports.getBookings = async (req, res, next) => {
  try {
    const { status, city_id, state_id, from_date, to_date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('bookings')
      .select(
        'bookings.*',
        'users.name as customer_name',
        'users.phone as customer_phone',
        'cars.name as car_name',
        'cars.brand as car_brand',
        'cars.registration_number',
        'c1.name as pickup_city_name',
        'c2.name as drop_city_name'
      )
      .leftJoin('users', 'bookings.customer_id', 'users.id')
      .leftJoin('cars', 'bookings.car_id', 'cars.id')
      .leftJoin('cities as c1', 'bookings.pickup_city_id', 'c1.id')
      .leftJoin('cities as c2', 'bookings.drop_city_id', 'c2.id');

    // Customers see only their bookings
    if (req.user.role === 'customer') {
      query = query.where('bookings.customer_id', req.user.id);
    }

    if (status) query = query.where('bookings.status', status);
    if (city_id) query = query.where('bookings.pickup_city_id', city_id);
    if (from_date) query = query.where('bookings.pickup_time', '>=', from_date);
    if (to_date) query = query.where('bookings.pickup_time', '<=', to_date);

    const countResult = await query.clone().clearSelect().clearOrder().count('bookings.id as total').first();
    const total = parseInt(countResult.total);

    const bookings = await query.orderBy('bookings.created_at', 'desc').limit(limit).offset(offset);

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings/:id
exports.getBookingById = async (req, res, next) => {
  try {
    const booking = await db('bookings')
      .select(
        'bookings.*',
        'users.name as customer_name',
        'users.phone as customer_phone',
        'users.email as customer_email',
        'cars.name as car_name',
        'cars.brand as car_brand',
        'cars.model as car_model',
        'cars.registration_number',
        'cars.image_url as car_image',
        'c1.name as pickup_city_name',
        'c2.name as drop_city_name',
        'd_user.name as driver_name',
        'd_user.phone as driver_phone'
      )
      .leftJoin('users', 'bookings.customer_id', 'users.id')
      .leftJoin('cars', 'bookings.car_id', 'cars.id')
      .leftJoin('cities as c1', 'bookings.pickup_city_id', 'c1.id')
      .leftJoin('cities as c2', 'bookings.drop_city_id', 'c2.id')
      .leftJoin('drivers', 'bookings.driver_id', 'drivers.id')
      .leftJoin('users as d_user', 'drivers.user_id', 'd_user.id')
      .where('bookings.id', req.params.id)
      .first();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Authorization check for customers
    if (req.user.role === 'customer' && booking.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this booking' });
    }

    // Get tracking data
    const tracking = await db('booking_tracking')
      .where({ booking_id: booking.id })
      .orderBy('recorded_at', 'desc')
      .limit(100);

    res.json({ booking, tracking });
  } catch (error) {
    next(error);
  }
};

// PUT /api/bookings/:id/status (Admin)
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status, driver_id, cancellation_reason } = req.body;
    const updates = { status, updated_at: db.fn.now() };

    if (driver_id) updates.driver_id = driver_id;
    if (cancellation_reason) updates.cancellation_reason = cancellation_reason;

    if (status === 'in_progress') updates.actual_pickup_time = db.fn.now();
    if (status === 'completed') updates.actual_drop_time = db.fn.now();

    const [booking] = await db('bookings')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*');

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Update car status based on booking status
    if (['completed', 'cancelled'].includes(status)) {
      await db('cars').where({ id: booking.car_id }).update({ status: 'available' });
    }

    // Update driver status
    if (driver_id) {
      const driverStatus = status === 'completed' ? 'available' : 'on_trip';
      await db('drivers').where({ id: driver_id }).update({ status: driverStatus });
    }

    // Notify customer
    await db('notifications').insert({
      user_id: booking.customer_id,
      title: 'Booking Update',
      body: `Your booking #${booking.booking_number} status: ${status.replace(/_/g, ' ')}`,
      type: 'booking',
      data: JSON.stringify({ booking_id: booking.id, status }),
    });

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`booking_${booking.id}`).emit('booking_status_update', { booking });
      io.to(`user_${booking.customer_id}`).emit('booking_status_update', { booking });
      io.to('admins').emit('booking_updated', { booking });
    }

    // ── WhatsApp + Brevo notifications ──
    if (status === 'in_progress') {
      notificationService.onBookingStarted(booking.id).catch((e) =>
        console.error('onBookingStarted error:', e.message)
      );
    }
    if (status === 'completed') {
      notificationService.onBookingCompleted(booking.id).catch((e) =>
        console.error('onBookingCompleted error:', e.message)
      );
    }

    res.json({ booking });
  } catch (error) {
    next(error);
  }
};

// PUT /api/bookings/:id/cancel (Customer)
exports.cancelBooking = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const booking = await db('bookings')
      .where({ id: req.params.id, customer_id: req.user.id })
      .whereIn('status', ['pending', 'confirmed'])
      .first();

    if (!booking) {
      return res.status(400).json({ error: 'Booking cannot be cancelled' });
    }

    const [updated] = await db('bookings')
      .where({ id: req.params.id })
      .update({
        status: 'cancelled',
        cancellation_reason: reason || 'Cancelled by customer',
        updated_at: db.fn.now(),
      })
      .returning('*');

    // Make car available again
    await db('cars').where({ id: booking.car_id }).update({ status: 'available' });

    // Notify admins
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('booking_cancelled', {
        booking: updated,
        cancelled_by: req.user.name,
      });
    }

    res.json({ booking: updated });
  } catch (error) {
    next(error);
  }
};

// POST /api/bookings/:id/rate
exports.rateBooking = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    const booking = await db('bookings')
      .where({ id: req.params.id, customer_id: req.user.id, status: 'completed' })
      .first();

    if (!booking) return res.status(400).json({ error: 'Can only rate completed bookings' });

    // Update booking rating
    await db('bookings')
      .where({ id: req.params.id })
      .update({ customer_rating: rating, customer_review: comment });

    // Create review
    await db('reviews').insert({
      booking_id: req.params.id,
      customer_id: req.user.id,
      car_id: booking.car_id,
      driver_id: booking.driver_id,
      rating,
      comment,
    });

    // Update car average rating
    const avgResult = await db('reviews')
      .where({ car_id: booking.car_id })
      .avg('rating as avg_rating')
      .first();

    await db('cars')
      .where({ id: booking.car_id })
      .update({ rating: parseFloat(avgResult.avg_rating).toFixed(1) });

    res.json({ message: 'Rating submitted successfully' });
  } catch (error) {
    next(error);
  }
};
