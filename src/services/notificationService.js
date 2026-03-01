/**
 * Unified Notification Service
 * Orchestrates WhatsApp + Brevo + in-app notifications for booking lifecycle events.
 */
const db = require('../config/database');
const whatsapp = require('./whatsapp');
const brevo = require('./brevo');

/**
 * Fetch enriched booking data with customer, car, driver info
 */
const getBookingDetails = async (bookingId) => {
  const booking = await db('bookings')
    .select(
      'bookings.*',
      'users.name as customer_name',
      'users.phone as customer_phone',
      'users.email as customer_email',
      'cars.name as car_name',
      'cars.brand as car_brand',
      'd_user.name as driver_name',
      'd_user.phone as driver_phone'
    )
    .leftJoin('users', 'bookings.customer_id', 'users.id')
    .leftJoin('cars', 'bookings.car_id', 'cars.id')
    .leftJoin('drivers', 'bookings.driver_id', 'drivers.id')
    .leftJoin('users as d_user', 'drivers.user_id', 'd_user.id')
    .where('bookings.id', bookingId)
    .first();

  return booking;
};

/**
 * Called when a booking status changes to in_progress (ride started)
 */
const onBookingStarted = async (bookingId) => {
  try {
    const booking = await getBookingDetails(bookingId);
    if (!booking) {
      console.error(`notificationService.onBookingStarted: booking ${bookingId} not found`);
      return;
    }

    const data = {
      customerName: booking.customer_name,
      bookingNumber: booking.booking_number,
      carName: `${booking.car_brand} ${booking.car_name}`,
      driverName: booking.driver_name,
      pickupAddress: booking.pickup_address,
      pickupTime: booking.actual_pickup_time || booking.pickup_time,
    };

    // 1. In-app notification (already created by bookingController)

    // 2. WhatsApp
    if (booking.customer_phone) {
      whatsapp.sendBookingStarted(booking.customer_phone, data).catch((e) =>
        console.error('WhatsApp booking-started error:', e.message)
      );
    }

    // 3. Brevo email
    if (booking.customer_email) {
      brevo.sendBookingStartedEmail(booking.customer_email, data).catch((e) =>
        console.error('Brevo booking-started error:', e.message)
      );
    }

    console.log(`📢 Booking started notifications dispatched for #${booking.booking_number}`);
  } catch (error) {
    console.error('notificationService.onBookingStarted error:', error.message);
  }
};

/**
 * Called when a booking status changes to completed (ride ended)
 */
const onBookingCompleted = async (bookingId) => {
  try {
    const booking = await getBookingDetails(bookingId);
    if (!booking) {
      console.error(`notificationService.onBookingCompleted: booking ${bookingId} not found`);
      return;
    }

    const data = {
      customerName: booking.customer_name,
      bookingNumber: booking.booking_number,
      carName: `${booking.car_brand} ${booking.car_name}`,
      totalAmount: booking.total_amount,
      dropAddress: booking.drop_address,
      distance: booking.distance_km,
      duration: booking.actual_duration_minutes || booking.estimated_duration_minutes,
    };

    // 1. WhatsApp
    if (booking.customer_phone) {
      whatsapp.sendBookingCompleted(booking.customer_phone, data).catch((e) =>
        console.error('WhatsApp booking-completed error:', e.message)
      );
    }

    // 2. Brevo email
    if (booking.customer_email) {
      brevo.sendBookingCompletedEmail(booking.customer_email, data).catch((e) =>
        console.error('Brevo booking-completed error:', e.message)
      );
    }

    // 3. Schedule review request for 60 minutes later (stored in DB)
    await scheduleReviewReminder(bookingId);

    console.log(`📢 Booking completed notifications dispatched for #${booking.booking_number}`);
  } catch (error) {
    console.error('notificationService.onBookingCompleted error:', error.message);
  }
};

/**
 * Schedule a review reminder 60 minutes after ride completion.
 * Stores a row in `scheduled_notifications` table (created by migration)
 * or falls back to in-memory setTimeout.
 */
const scheduleReviewReminder = async (bookingId) => {
  try {
    // Try DB-backed schedule first
    const tableExists = await db.schema.hasTable('scheduled_notifications');
    if (tableExists) {
      const sendAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes from now
      await db('scheduled_notifications').insert({
        booking_id: bookingId,
        type: 'review_request',
        send_at: sendAt,
        status: 'pending',
      });
      console.log(`⏰ Review reminder scheduled for booking ${bookingId} at ${sendAt.toISOString()}`);
    } else {
      // Fallback: in-memory timer (lost on restart — acceptable for dev)
      console.log(`⏰ Review reminder (in-memory) for booking ${bookingId} in 60 min`);
      setTimeout(() => sendReviewReminder(bookingId), 60 * 60 * 1000);
    }
  } catch (error) {
    console.error('scheduleReviewReminder error:', error.message);
    // Fallback to in-memory
    setTimeout(() => sendReviewReminder(bookingId), 60 * 60 * 1000);
  }
};

/**
 * Actually dispatch review reminder via WhatsApp + Brevo
 */
const sendReviewReminder = async (bookingId) => {
  try {
    const booking = await getBookingDetails(bookingId);
    if (!booking) return;

    // Skip if customer already rated
    if (booking.customer_rating) {
      console.log(`⭐ Customer already rated booking #${booking.booking_number}, skipping reminder`);
      return;
    }

    const data = {
      customerName: booking.customer_name,
      bookingNumber: booking.booking_number,
      carName: `${booking.car_brand} ${booking.car_name}`,
    };

    // WhatsApp
    if (booking.customer_phone) {
      whatsapp.sendReviewRequest(booking.customer_phone, data).catch((e) =>
        console.error('WhatsApp review-request error:', e.message)
      );
    }

    // Brevo email
    if (booking.customer_email) {
      brevo.sendReviewRequestEmail(booking.customer_email, data).catch((e) =>
        console.error('Brevo review-request error:', e.message)
      );
    }

    // In-app notification
    await db('notifications').insert({
      user_id: booking.customer_id,
      title: 'Rate Your Ride ⭐',
      body: `How was your ride #${booking.booking_number}? Tap to rate and review!`,
      type: 'review',
      data: JSON.stringify({ booking_id: bookingId, booking_number: booking.booking_number }),
    });

    console.log(`📢 Review reminder sent for booking #${booking.booking_number}`);
  } catch (error) {
    console.error('sendReviewReminder error:', error.message);
  }
};

module.exports = {
  onBookingStarted,
  onBookingCompleted,
  sendReviewReminder,
  scheduleReviewReminder,
};
